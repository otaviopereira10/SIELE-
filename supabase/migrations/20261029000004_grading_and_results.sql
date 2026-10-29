-- Evaluación docente con rúbricas, publicación de resultados e informe del estudiante.

-- Puntos de una banda según la tabla de la rúbrica (posición de la tarea o "*")
create or replace function public._rubric_points(p_rubric uuid, p_task_position integer, p_criterion text, p_band integer)
returns numeric
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (r.points_table -> p_task_position::text -> p_criterion ->> p_band),
    (r.points_table -> '*' -> p_criterion ->> p_band)
  )::numeric
  from public.rubric_versions r where r.id = p_rubric
$$;

create or replace function public._rubric_max(p_rubric uuid, p_task_position integer)
returns numeric
language sql stable security definer set search_path = public
as $$
  select sum(public._rubric_points(p_rubric, p_task_position, c ->> 'key', 5))
  from public.rubric_versions r, jsonb_array_elements(r.criteria) c
  where r.id = p_rubric
$$;

create or replace function public._default_rubric(p_skill public.exam_skill)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.rubric_versions
  where skill = p_skill and status = 'published'
  order by created_at desc limit 1
$$;

-- Estimación de nivel a partir de una tabla de puntuación activa.
-- raw_to_level solo se aplica si el total de ítems coincide con el de la tabla verificada.
create or replace function public._estimate_level(p_skill public.exam_skill, p_value numeric, p_max numeric)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_table public.scoring_tables;
  v_band jsonb;
  v_source public.sources;
begin
  select * into v_table from public.scoring_tables where skill = p_skill and is_active;
  if not found then
    return jsonb_build_object('applicable', false, 'reason', 'no_table');
  end if;
  select * into v_source from public.sources where id = v_table.source_id;

  if v_table.kind = 'raw_to_level' then
    if v_table.max_raw is distinct from p_max::integer then
      return jsonb_build_object('applicable', false, 'reason', 'item_count_differs', 'table_max_raw', v_table.max_raw);
    end if;
    select b into v_band from jsonb_array_elements(v_table.bands) b
     where (b ->> 'min_raw')::numeric <= p_value order by (b ->> 'min_raw')::numeric desc limit 1;
  else
    if v_table.max_points is distinct from p_max then
      return jsonb_build_object('applicable', false, 'reason', 'max_points_differs', 'table_max_points', v_table.max_points);
    end if;
    select b into v_band from jsonb_array_elements(v_table.bands) b
     where (b ->> 'min_points')::numeric <= p_value order by (b ->> 'min_points')::numeric desc limit 1;
  end if;

  if v_band is null then
    return jsonb_build_object('applicable', false, 'reason', 'no_band');
  end if;
  return jsonb_build_object(
    'applicable', true, 'kind', v_table.kind, 'level', v_band ->> 'level',
    'min_points', (v_band ->> 'min_points')::numeric, 'max_points', (v_band ->> 'max_points')::numeric,
    'verification', v_table.verification, 'source_title', v_source.title, 'source_edition', v_source.edition,
    'source_url', v_source.url, 'notes', v_table.notes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Guardar evaluación (borrador). Se puede repetir sin perder lo guardado.
-- p_scores: [{"criterion": "cohesion", "band": 3, "comment": "..."}]
-- ---------------------------------------------------------------------------
create or replace function public.save_evaluation(
  p_attempt uuid, p_task uuid, p_scores jsonb,
  p_global_comment text default '', p_strengths text default '', p_priorities text default '', p_next_steps text default ''
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_task public.tasks;
  v_skill public.exam_skill;
  v_rubric uuid;
  v_eval public.evaluations;
  s jsonb;
  v_crit jsonb;
  v_band integer;
  v_total_weight numeric;
  v_points numeric;
  v_complete boolean;
  v_percent numeric;
begin
  if not public.staff_can_view_attempt(p_attempt) then perform public._raise('forbidden'); end if;
  select * into v_attempt from public.attempts where id = p_attempt for update;
  if v_attempt.status not in ('submitted', 'published', 'resubmission_requested') then
    perform public._raise('attempt_not_submitted');
  end if;
  select t.* into v_task from public.tasks t where t.id = p_task;
  select s2.skill into v_skill from public.tasks t join public.exam_sections s2 on s2.id = t.section_id where t.id = p_task;
  if v_skill is null or v_skill not in ('writing', 'speaking') then perform public._raise('task_not_productive'); end if;
  if not exists (select 1 from public.attempt_sections ats where ats.attempt_id = p_attempt and ats.section_id = v_task.section_id) then
    perform public._raise('task_not_in_attempt');
  end if;
  if jsonb_typeof(coalesce(p_scores, '[]'::jsonb)) <> 'array' then perform public._raise('invalid_scores'); end if;
  if char_length(coalesce(p_global_comment, '')) > 8000 or char_length(coalesce(p_strengths, '')) > 4000
     or char_length(coalesce(p_priorities, '')) > 4000 or char_length(coalesce(p_next_steps, '')) > 4000 then
    perform public._raise('text_too_long');
  end if;

  select * into v_eval from public.evaluations where attempt_id = p_attempt and task_id = p_task for update;
  v_rubric := coalesce(v_eval.rubric_version_id, v_task.rubric_version_id, public._default_rubric(v_skill));
  if v_rubric is null then perform public._raise('no_rubric_configured'); end if;

  if v_eval.id is null then
    insert into public.evaluations (attempt_id, task_id, evaluator_id, rubric_version_id)
    values (p_attempt, p_task, auth.uid(), v_rubric) returning * into v_eval;
  end if;

  for s in select * from jsonb_array_elements(coalesce(p_scores, '[]'::jsonb)) loop
    select c into v_crit from public.rubric_versions r, jsonb_array_elements(r.criteria) c
     where r.id = v_rubric and c ->> 'key' = s ->> 'criterion';
    if v_crit is null then perform public._raise('unknown_criterion'); end if;
    v_band := case when s -> 'band' is null or s -> 'band' = 'null'::jsonb then null else (s ->> 'band')::integer end;
    if v_band is not null and (v_band < 0 or v_band > 5) then perform public._raise('invalid_band'); end if;
    if char_length(coalesce(s ->> 'comment', '')) > 4000 then perform public._raise('text_too_long'); end if;
    insert into public.rubric_scores (evaluation_id, criterion_key, band, points, comment, updated_at)
    values (v_eval.id, s ->> 'criterion', v_band,
            case when v_band is null then null else public._rubric_points(v_rubric, v_task.position, s ->> 'criterion', v_band) end,
            coalesce(s ->> 'comment', ''), now())
    on conflict (evaluation_id, criterion_key) do update
      set band = excluded.band, points = excluded.points, comment = excluded.comment, updated_at = now();
  end loop;

  select
    bool_and(rs.band is not null) and count(rs.*) = (select jsonb_array_length(criteria) from public.rubric_versions where id = v_rubric),
    sum(rs.points),
    sum(rs.band::numeric / 5 * (c ->> 'weight')::numeric),
    sum((c ->> 'weight')::numeric)
  into v_complete, v_points, v_percent, v_total_weight
  from public.rubric_versions r
  cross join jsonb_array_elements(r.criteria) c
  left join public.rubric_scores rs on rs.evaluation_id = v_eval.id and rs.criterion_key = c ->> 'key'
  where r.id = v_rubric;

  update public.evaluations
     set evaluator_id = auth.uid(),
         status = 'draft',
         is_complete = coalesce(v_complete, false),
         points = case when v_complete then round(v_points, 3) else null end,
         max_points = public._rubric_max(v_rubric, v_task.position),
         pedagogical_percent = case when v_complete and v_total_weight > 0 then round(v_percent / v_total_weight * 100, 1) else null end,
         global_comment = coalesce(p_global_comment, ''), strengths = coalesce(p_strengths, ''),
         priorities = coalesce(p_priorities, ''), next_steps = coalesce(p_next_steps, ''),
         updated_at = now()
   where id = v_eval.id
   returning * into v_eval;

  return jsonb_build_object('id', v_eval.id, 'status', v_eval.status, 'is_complete', v_eval.is_complete,
                            'points', v_eval.points, 'max_points', v_eval.max_points,
                            'pedagogical_percent', v_eval.pedagogical_percent, 'updated_at', v_eval.updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Informe publicado (instantánea inmutable para el estudiante)
-- ---------------------------------------------------------------------------
create or replace function public._build_report(p_attempt uuid, p_scope text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_report jsonb;
begin
  select * into v_attempt from public.attempts where id = p_attempt;

  select jsonb_build_object(
    'generated_at', now(),
    'scope', p_scope,
    'disclaimer', 'Resultado de preparación. No es una calificación oficial SIELE ni está respaldado por SIELE.',
    'attempt', jsonb_build_object(
      'id', v_attempt.id, 'mode', v_attempt.mode, 'started_at', v_attempt.started_at, 'submitted_at', v_attempt.submitted_at,
      'assignment_title', asg.title, 'exam_title', tpl.title, 'version_no', ver.version_no, 'format_label', ver.format_label
    ),
    'student', jsonb_build_object('id', pr.id, 'full_name', pr.full_name),
    'sections', coalesce((
      select jsonb_agg(sec order by (sec ->> 'position')::int) from (
        select jsonb_build_object(
          'section_id', s.id, 'skill', s.skill, 'title', s.title, 'position', s.position,
          'objective', case when s.skill in ('reading', 'listening') then (
              select jsonb_build_object(
                'correct', ss.correct, 'wrong', ss.wrong, 'blank', ss.blank,
                'raw_points', ss.raw_points, 'max_points', ss.max_points,
                'by_task', ss.by_task, 'by_level', ss.by_level,
                'estimate', public._estimate_level(s.skill, ss.raw_points, ss.max_points)
              ) from public.attempt_section_scores ss where ss.attempt_id = p_attempt and ss.section_id = s.id)
            else null end,
          'productive', case when s.skill in ('writing', 'speaking') and p_scope = 'full' then (
              select jsonb_build_object(
                'tasks', coalesce(jsonb_agg(jsonb_build_object(
                  'task_id', tk.id, 'position', tk.position, 'title', tk.title, 'code', tk.code,
                  'response_text', (select r.payload ->> 'text' from public.task_responses r where r.attempt_id = p_attempt and r.task_id = tk.id and r.item_key = 'text'),
                  'option_key', (select r.payload ->> 'option_key' from public.task_responses r where r.attempt_id = p_attempt and r.task_id = tk.id and r.item_key = 'text'),
                  'word_count', (select r.word_count from public.task_responses r where r.attempt_id = p_attempt and r.task_id = tk.id and r.item_key = 'text'),
                  'recordings', (select coalesce(jsonb_agg(jsonb_build_object('part_key', o.part_key, 'segment_key', o.segment_key, 'duration_ms', o.duration_ms)), '[]'::jsonb)
                                 from public.oral_recordings o where o.attempt_id = p_attempt and o.task_id = tk.id and o.status = 'verified'),
                  'evaluation', (select jsonb_build_object(
                      'points', e.points, 'max_points', e.max_points, 'pedagogical_percent', e.pedagogical_percent,
                      'global_comment', e.global_comment, 'strengths', e.strengths, 'priorities', e.priorities, 'next_steps', e.next_steps,
                      'rubric', jsonb_build_object('code', rv.code, 'version_no', rv.version_no, 'title', rv.title, 'verification', rv.verification),
                      'criteria', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'key', c ->> 'key', 'label', c ->> 'label', 'weight', (c ->> 'weight')::numeric,
                                     'band', rs.band, 'points', rs.points, 'comment', rs.comment,
                                     'band_descriptor', (select b ->> 'summary' from jsonb_array_elements(c -> 'bands') b where (b ->> 'band')::int = rs.band)
                                   ) order by ord), '[]'::jsonb)
                                   from jsonb_array_elements(rv.criteria) with ordinality as cc(c, ord)
                                   left join public.rubric_scores rs on rs.evaluation_id = e.id and rs.criterion_key = c ->> 'key'),
                      'feedback', (select coalesce(jsonb_agg(jsonb_build_object(
                                     'kind', f.kind, 'category', f.category, 'criterion_key', f.criterion_key, 'quote', f.quote,
                                     'char_start', f.char_start, 'char_end', f.char_end, 'audio_ms', f.audio_ms,
                                     'segment', (select o.part_key || '/' || o.segment_key from public.oral_recordings o where o.id = f.recording_id),
                                     'explanation', f.explanation, 'correction', f.correction,
                                     'improved_example', f.improved_example, 'is_systematic', f.is_systematic, 'severity', f.severity
                                   ) order by f.kind, f.created_at), '[]'::jsonb)
                                   from public.teacher_feedback f where f.evaluation_id = e.id)
                    ) from public.evaluations e join public.rubric_versions rv on rv.id = e.rubric_version_id
                     where e.attempt_id = p_attempt and e.task_id = tk.id)
                ) order by tk.position), '[]'::jsonb),
                'total_points', sum(e2.points),
                'max_points', sum(e2.max_points),
                'complete', bool_and(coalesce(e2.is_complete, false)),
                'estimate', case when bool_and(coalesce(e2.is_complete, false))
                                 then public._estimate_level(s.skill, sum(e2.points), sum(e2.max_points))
                                 else jsonb_build_object('applicable', false, 'reason', 'incomplete') end
              )
              from public.tasks tk
              left join public.evaluations e2 on e2.attempt_id = p_attempt and e2.task_id = tk.id
              where tk.section_id = s.id)
            else null end
        ) as sec
        from public.attempt_sections ats
        join public.exam_sections s on s.id = ats.section_id
        where ats.attempt_id = p_attempt
      ) z
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'skill', s.skill, 'section_position', s.position, 'task_position', tk.position, 'task_title', tk.title,
        'question_position', q.position, 'prompt', q.prompt, 'level', q.level, 'focus', q.focus,
        'selected', (select coalesce(jsonb_agg(jsonb_build_object('label', o.label, 'body', o.body)), '[]'::jsonb)
                     from public.question_options o
                     where o.id::text = r.payload ->> 'option_id'
                        or o.id::text in (select jsonb_array_elements_text(coalesce(r.payload -> 'option_ids', '[]'::jsonb)))),
        'correct', (select coalesce(jsonb_agg(jsonb_build_object('label', o.label, 'body', o.body)), '[]'::jsonb)
                    from public.question_options o where o.id = any (k.correct_option_ids)),
        'is_correct', coalesce(r.is_correct, false),
        'answered', r.id is not null and ((r.payload ->> 'option_id') is not null or jsonb_array_length(coalesce(r.payload -> 'option_ids', '[]'::jsonb)) > 0),
        'explanation', k.explanation
      ) order by s.position, tk.position, q.position)
      from public.attempt_sections ats
      join public.exam_sections s on s.id = ats.section_id and s.skill in ('reading', 'listening')
      join public.tasks tk on tk.section_id = s.id
      join public.questions q on q.task_id = tk.id
      join public.question_keys k on k.question_id = q.id
      left join public.task_responses r on r.attempt_id = p_attempt and r.task_id = tk.id and r.item_key = 'q:' || q.id
      where ats.attempt_id = p_attempt
    ), '[]'::jsonb),
    'categories', case when p_scope = 'full' then coalesce((
      select jsonb_agg(jsonb_build_object('category', f.category, 'count', f.n, 'systematic', f.systematic) order by f.n desc)
      from (
        select tf.category, count(*) as n, bool_or(tf.is_systematic) as systematic
        from public.teacher_feedback tf join public.evaluations e on e.id = tf.evaluation_id
        where e.attempt_id = p_attempt and tf.kind = 'error'
        group by tf.category
      ) f
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into v_report
  from public.exam_assignments asg
  join public.exam_versions ver on ver.id = asg.version_id
  join public.exam_templates tpl on tpl.id = ver.template_id
  join public.profiles pr on pr.id = v_attempt.student_id
  where asg.id = v_attempt.assignment_id;

  return v_report;
end;
$$;

create or replace function public._publish_report(p_attempt uuid, p_scope text, p_publisher uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_student uuid;
begin
  select student_id into v_student from public.attempts where id = p_attempt;
  insert into public.published_results (attempt_id, student_id, scope, report, published_by, published_at, revision)
  values (p_attempt, v_student, p_scope, public._build_report(p_attempt, p_scope), p_publisher, now(), 1)
  on conflict (attempt_id) do update
    set scope = excluded.scope, report = excluded.report, published_by = excluded.published_by,
        published_at = now(), revision = public.published_results.revision + 1;
end;
$$;

create or replace function public.publish_attempt_results(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_missing jsonb;
begin
  if not public.staff_can_view_attempt(p_attempt) then perform public._raise('forbidden'); end if;
  select * into v_attempt from public.attempts where id = p_attempt for update;
  if v_attempt.status not in ('submitted', 'published') then
    perform public._raise('attempt_not_ready_for_publication');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('task_id', tk.id, 'title', tk.title, 'section', s.title)), '[]'::jsonb)
    into v_missing
  from public.attempt_sections ats
  join public.exam_sections s on s.id = ats.section_id and s.skill in ('writing', 'speaking')
  join public.tasks tk on tk.section_id = s.id
  left join public.evaluations e on e.attempt_id = p_attempt and e.task_id = tk.id
  where ats.attempt_id = p_attempt and (e.id is null or not e.is_complete);

  if jsonb_array_length(v_missing) > 0 then
    return jsonb_build_object('status', 'incomplete', 'missing', v_missing);
  end if;

  update public.evaluations set status = 'published', published_at = now()
   where attempt_id = p_attempt;
  update public.attempts set status = 'published', published_at = now() where id = p_attempt;
  perform public._publish_report(p_attempt, 'full', auth.uid());
  perform public.log_audit('results_published', 'attempt', p_attempt::text, '{}'::jsonb);
  return jsonb_build_object('status', 'published');
end;
$$;

create or replace function public.request_resubmission(p_attempt uuid, p_task uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_skill public.exam_skill;
begin
  if not public.staff_can_view_attempt(p_attempt) then perform public._raise('forbidden'); end if;
  select * into v_attempt from public.attempts where id = p_attempt for update;
  if v_attempt.status not in ('submitted', 'published', 'resubmission_requested') then perform public._raise('attempt_not_submitted'); end if;
  select s.skill into v_skill from public.tasks t join public.exam_sections s on s.id = t.section_id
   join public.attempt_sections ats on ats.section_id = s.id and ats.attempt_id = p_attempt where t.id = p_task;
  if v_skill is distinct from 'writing' then perform public._raise('resubmission_only_for_writing'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform public._raise('reason_required'); end if;

  insert into public.resubmissions (attempt_id, task_id, reason, requested_by)
  values (p_attempt, p_task, btrim(p_reason), auth.uid());
  update public.attempts set status = 'resubmission_requested' where id = p_attempt;
  update public.evaluations set status = 'draft' where attempt_id = p_attempt and task_id = p_task;
  perform public.log_audit('resubmission_requested', 'attempt', p_attempt::text, jsonb_build_object('task_id', p_task));
  return jsonb_build_object('status', 'resubmission_requested');
end;
$$;

create or replace function public.set_attempt_lock(p_attempt uuid, p_locked boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.staff_can_view_attempt(p_attempt) then perform public._raise('forbidden'); end if;
  update public.attempts set locked_by_teacher = p_locked where id = p_attempt and status = 'in_progress';
  perform public._log_attempt_event(p_attempt, case when p_locked then 'locked_by_teacher' else 'unlocked_by_teacher' end, '{}'::jsonb);
  perform public.log_audit(case when p_locked then 'attempt_locked' else 'attempt_unlocked' end, 'attempt', p_attempt::text, '{}'::jsonb);
end;
$$;

create or replace function public.annul_attempt(p_attempt uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.staff_can_view_attempt(p_attempt) then perform public._raise('forbidden'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform public._raise('reason_required'); end if;
  update public.attempts set status = 'annulled' where id = p_attempt and status <> 'published';
  if not found then perform public._raise('cannot_annul_published_attempt'); end if;
  perform public._log_attempt_event(p_attempt, 'annulled', jsonb_build_object('reason', p_reason));
  perform public.log_audit('attempt_annulled', 'attempt', p_attempt::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.save_recording_transcript(p_recording uuid, p_text text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt uuid;
begin
  select attempt_id into v_attempt from public.oral_recordings where id = p_recording;
  if v_attempt is null or not public.staff_can_view_attempt(v_attempt) then perform public._raise('forbidden'); end if;
  if char_length(coalesce(p_text, '')) > 20000 then perform public._raise('text_too_long'); end if;
  update public.oral_recordings set teacher_transcript = coalesce(p_text, ''), transcript_source = 'teacher' where id = p_recording;
end;
$$;

-- Plan de estudio: el estudiante solo puede marcar actividades como completadas
create or replace function public.toggle_plan_item(p_item uuid, p_done boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.study_plan_items i set completed_at = case when p_done then now() else null end
   from public.study_plans p
   where i.id = p_item and p.id = i.plan_id and (p.student_id = auth.uid() or public.staff_can_view_student(p.student_id));
  if not found then perform public._raise('forbidden'); end if;
end;
$$;
