-- Motor de simulacros: inicio, navegación, temporizadores en servidor, guardado, audio y envío.
-- Todas las funciones validan la identidad (auth.uid()) y el estado del intento.

create table public.practice_task_checks (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  checked_at timestamptz not null default now(),
  primary key (attempt_id, task_id)
);
alter table public.practice_task_checks enable row level security;
grant select on public.practice_task_checks to authenticated;
create policy practice_task_checks_select on public.practice_task_checks for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.student_id = (select auth.uid()) or public.staff_can_view_student(a.student_id))));

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------
create or replace function public.count_words(p_text text)
returns integer
language sql immutable
as $$
  select count(*)::integer
  from regexp_split_to_table(btrim(coalesce(p_text, '')), '\s+') w
  where w ~ '[0-9A-Za-zÀ-ÖØ-öø-ÿ]'
$$;

create or replace function public._raise(p_code text, p_message text default null)
returns void
language plpgsql
as $$
begin
  raise exception '%', p_code using errcode = 'P0001', detail = coalesce(p_message, p_code);
end;
$$;

create or replace function public._log_attempt_event(p_attempt uuid, p_type text, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into public.attempt_events (attempt_id, event_type, details) values (p_attempt, p_type, coalesce(p_details, '{}'::jsonb))
$$;

-- Secciones incluidas en una asignación (vacío = todas las de la versión)
create or replace function public._assignment_sections(p_assignment uuid)
returns table (section_id uuid, pos smallint, time_limit_seconds integer, pause_after_seconds integer)
language sql stable security definer set search_path = public
as $$
  select s.id, s.position, s.time_limit_seconds, s.pause_after_seconds
  from public.exam_assignments a
  join public.exam_sections s on s.version_id = a.version_id
  where a.id = p_assignment
    and (cardinality(a.section_ids) = 0 or s.id = any (a.section_ids))
  order by s.position
$$;

-- Cierra secciones vencidas y, si procede, finaliza el intento. Idempotente.
create or replace function public._sweep_attempt(p_attempt uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_grace interval;
  v_closes timestamptz;
  r record;
  v_next record;
begin
  select * into v_attempt from public.attempts where id = p_attempt for update;
  if not found or v_attempt.status <> 'in_progress' then
    return;
  end if;
  select make_interval(secs => a.grace_seconds), a.closes_at into v_grace, v_closes
  from public.exam_assignments a where a.id = v_attempt.assignment_id;

  for r in
    select * from public.attempt_sections
    where attempt_id = p_attempt and status = 'active' and deadline_at + v_grace < now()
  loop
    update public.attempt_sections
       set status = 'timed_out', completed_at = r.deadline_at
     where attempt_id = p_attempt and section_id = r.section_id;
    perform public._log_attempt_event(p_attempt, 'section_timed_out', jsonb_build_object('section_id', r.section_id, 'deadline_at', r.deadline_at));

    select ats.section_id, s.pause_after_seconds into v_next
      from public.attempt_sections ats
      join public.exam_sections s on s.id = r.section_id
     where ats.attempt_id = p_attempt and ats.position > r.position and ats.status = 'locked'
     order by ats.position limit 1;
    if found then
      update public.attempt_sections
         set status = 'ready', available_at = r.deadline_at + make_interval(secs => v_next.pause_after_seconds)
       where attempt_id = p_attempt and section_id = v_next.section_id;
    end if;
  end loop;

  -- Ventana de la asignación cerrada: el intento se finaliza con lo guardado.
  if v_closes is not null and v_closes + v_grace < now() then
    perform public._finalize_attempt(p_attempt, 'window_closed');
    return;
  end if;

  -- Última sección vencida y ninguna pendiente → envío automático
  if not exists (
    select 1 from public.attempt_sections
    where attempt_id = p_attempt and status in ('locked', 'ready', 'active')
  ) and exists (
    select 1 from public.attempt_sections where attempt_id = p_attempt and status = 'timed_out'
  ) then
    perform public._finalize_attempt(p_attempt, 'time_expired');
  end if;
end;
$$;

-- Devuelve el intento del estudiante actual bloqueado para actualización, tras barrer tiempos.
create or replace function public._own_attempt(p_attempt uuid)
returns public.attempts
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
begin
  if auth.uid() is null or public.my_role() is null then
    perform public._raise('not_authenticated');
  end if;
  select * into v_attempt from public.attempts where id = p_attempt and student_id = auth.uid();
  if not found then
    perform public._raise('attempt_not_found');
  end if;
  perform public._sweep_attempt(p_attempt);
  select * into v_attempt from public.attempts where id = p_attempt for update;
  return v_attempt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inicio del intento
-- ---------------------------------------------------------------------------
create or replace function public.start_attempt(p_assignment uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_asg public.exam_assignments;
  v_existing uuid;
  v_count integer;
  v_attempt uuid;
  v_first boolean := true;
  r record;
begin
  if v_uid is null or public.my_role() is distinct from 'student' then
    perform public._raise('only_students_can_start_attempts');
  end if;

  select * into v_asg from public.exam_assignments where id = p_assignment and archived_at is null;
  if not found then
    perform public._raise('assignment_not_found');
  end if;
  if not (coalesce(v_asg.student_id = v_uid, false)
          or (v_asg.class_id is not null and public.student_in_class(v_asg.class_id))) then
    perform public._raise('assignment_not_found');
  end if;
  if now() < v_asg.opens_at then
    perform public._raise('assignment_not_open');
  end if;
  if v_asg.closes_at is not null and now() > v_asg.closes_at then
    perform public._raise('assignment_closed');
  end if;
  if not exists (select 1 from public.exam_versions v where v.id = v_asg.version_id and v.status = 'published') then
    perform public._raise('version_not_available');
  end if;

  -- Reanudar el intento en curso en lugar de abrir uno nuevo
  select id into v_existing from public.attempts
   where assignment_id = p_assignment and student_id = v_uid and status = 'in_progress'
   order by created_at desc limit 1;
  if v_existing is not null then
    perform public._sweep_attempt(v_existing);
    if exists (select 1 from public.attempts where id = v_existing and status = 'in_progress') then
      if v_asg.resume_policy = 'teacher_unlock' and exists (select 1 from public.attempts where id = v_existing and locked_by_teacher) then
        perform public._raise('attempt_locked_contact_teacher');
      end if;
      perform public._log_attempt_event(v_existing, 'resumed', '{}'::jsonb);
      return v_existing;
    end if;
  end if;

  select count(*) into v_count from public.attempts
   where assignment_id = p_assignment and student_id = v_uid and status <> 'annulled';
  if v_count >= v_asg.max_attempts then
    perform public._raise('max_attempts_reached');
  end if;

  insert into public.attempts (assignment_id, version_id, student_id, mode)
  values (p_assignment, v_asg.version_id, v_uid, v_asg.mode)
  returning id into v_attempt;

  for r in select * from public._assignment_sections(p_assignment) loop
    insert into public.attempt_sections (attempt_id, section_id, position, status, available_at)
    values (v_attempt, r.section_id, r.pos, case when v_first then 'ready'::public.section_status else 'locked'::public.section_status end,
            case when v_first then now() else null end);
    v_first := false;
  end loop;

  if v_first then
    perform public._raise('assignment_has_no_sections');
  end if;

  perform public._log_attempt_event(v_attempt, 'started', jsonb_build_object('assignment_id', p_assignment, 'mode', v_asg.mode));
  return v_attempt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estado del intento (lo que necesita la interfaz del examen; sin claves)
-- ---------------------------------------------------------------------------
create or replace function public.get_attempt_state(p_attempt uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_result jsonb;
begin
  v_attempt := public._own_attempt(p_attempt);

  select jsonb_build_object(
    'server_now', now(),
    'attempt', jsonb_build_object(
      'id', v_attempt.id, 'status', v_attempt.status, 'mode', v_attempt.mode,
      'started_at', v_attempt.started_at, 'submitted_at', v_attempt.submitted_at,
      'assignment_id', v_attempt.assignment_id,
      'title', a.title, 'immediate_feedback', a.immediate_feedback, 'grace_seconds', a.grace_seconds,
      'exam_title', t.title, 'format_label', v.format_label, 'version_no', v.version_no
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'section_id', s.id, 'position', ats.position, 'skill', s.skill, 'title', s.title,
        'instructions', s.instructions, 'time_limit_seconds', s.time_limit_seconds,
        'allow_back', s.allow_back, 'pause_after_seconds', s.pause_after_seconds,
        'status', ats.status, 'available_at', ats.available_at, 'started_at', ats.started_at,
        'deadline_at', ats.deadline_at, 'completed_at', ats.completed_at,
        'current_task_position', ats.current_task_position, 'max_task_position', ats.max_task_position,
        'tasks', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'task_id', tk.id, 'position', tk.position, 'title', tk.title,
            'interaction_type', tk.interaction_type, 'declared_items', tk.declared_items,
            'answered', (select count(*) from public.task_responses tr
                          where tr.attempt_id = v_attempt.id and tr.task_id = tk.id
                            and tr.item_key not like 'notes:%'
                            and not (tr.payload ? 'option_id' and tr.payload -> 'option_id' = 'null'::jsonb)
                            and not (tr.payload ? 'option_ids' and jsonb_array_length(tr.payload -> 'option_ids') = 0)
                            and not (tr.payload ? 'text' and btrim(tr.payload ->> 'text') = '')),
            'recordings', (select count(*) from public.oral_recordings orr
                            where orr.attempt_id = v_attempt.id and orr.task_id = tk.id and orr.status = 'verified'),
            'checked', exists (select 1 from public.practice_task_checks pc where pc.attempt_id = v_attempt.id and pc.task_id = tk.id)
          ) order by tk.position), '[]'::jsonb)
          from public.tasks tk where tk.section_id = s.id
        )
      ) order by ats.position)
      from public.attempt_sections ats
      join public.exam_sections s on s.id = ats.section_id
      where ats.attempt_id = v_attempt.id
    ), '[]'::jsonb),
    'resubmissions', coalesce((
      select jsonb_agg(jsonb_build_object('task_id', rs.task_id, 'reason', rs.reason, 'created_at', rs.created_at))
      from public.resubmissions rs where rs.attempt_id = v_attempt.id and rs.status = 'open'
    ), '[]'::jsonb)
  ) into v_result
  from public.exam_assignments a
  join public.exam_versions v on v.id = a.version_id
  join public.exam_templates t on t.id = v.template_id
  where a.id = v_attempt.assignment_id;

  return v_result;
end;
$$;

-- ¿Puede el estudiante trabajar ahora en esta tarea? Devuelve la fila de la sección del intento.
create or replace function public._writable_task(v_attempt public.attempts, p_task uuid, p_for_write boolean)
returns public.attempt_sections
language plpgsql security definer set search_path = public
as $$
declare
  v_task public.tasks;
  v_section public.exam_sections;
  v_ats public.attempt_sections;
  v_grace integer;
begin
  select * into v_task from public.tasks where id = p_task;
  if not found then perform public._raise('task_not_found'); end if;
  select * into v_section from public.exam_sections where id = v_task.section_id;
  select * into v_ats from public.attempt_sections where attempt_id = v_attempt.id and section_id = v_section.id;
  if not found then perform public._raise('task_not_in_attempt'); end if;

  -- Nueva entrega solicitada por la profesora: solo esa tarea, aunque el intento esté enviado
  if v_attempt.status = 'resubmission_requested' then
    if exists (select 1 from public.resubmissions r where r.attempt_id = v_attempt.id and r.task_id = p_task and r.status = 'open') then
      return v_ats;
    end if;
    perform public._raise('attempt_closed');
  end if;

  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;
  if v_attempt.locked_by_teacher then perform public._raise('attempt_locked_contact_teacher'); end if;
  if v_ats.status <> 'active' then perform public._raise('section_not_active'); end if;

  select grace_seconds into v_grace from public.exam_assignments where id = v_attempt.assignment_id;
  if v_ats.deadline_at + make_interval(secs => v_grace) < now() then
    perform public._raise('time_expired');
  end if;

  if not v_section.allow_back and v_task.position < v_ats.current_task_position then
    perform public._raise('navigation_back_not_allowed');
  end if;
  if not v_section.allow_back and p_for_write and v_task.position > v_ats.current_task_position then
    perform public._raise('task_not_reached');
  end if;
  if p_for_write and exists (select 1 from public.practice_task_checks pc where pc.attempt_id = v_attempt.id and pc.task_id = p_task) then
    perform public._raise('task_already_checked');
  end if;
  return v_ats;
end;
$$;

-- Contenido de una tarea para el estudiante: enunciados y opciones, nunca claves ni transcripciones.
create or replace function public.get_attempt_task(p_attempt uuid, p_task uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ats public.attempt_sections;
  v_task public.tasks;
begin
  v_attempt := public._own_attempt(p_attempt);
  v_ats := public._writable_task(v_attempt, p_task, false);
  select * into v_task from public.tasks where id = p_task;

  return jsonb_build_object(
    'task', jsonb_build_object(
      'id', v_task.id, 'position', v_task.position, 'title', v_task.title, 'code', v_task.code,
      'interaction_type', v_task.interaction_type, 'instructions', v_task.instructions,
      'level_label', v_task.level_label, 'content', v_task.content, 'declared_items', v_task.declared_items,
      'max_audio_plays', v_task.max_audio_plays, 'suggested_seconds', v_task.suggested_seconds
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'position', q.position, 'prompt', q.prompt, 'max_selections', q.max_selections,
        'options', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body) order by o.position)
                             from public.question_options o where o.question_id = q.id), '[]'::jsonb)
      ) order by q.position)
      from public.questions q where q.task_id = p_task
    ), '[]'::jsonb),
    'bank', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'label', o.label, 'body', o.body) order by o.position)
      from public.question_options o where o.task_id = p_task and o.question_id is null
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object('item_key', r.item_key, 'payload', r.payload, 'word_count', r.word_count,
                                          'revision', r.revision, 'updated_at', r.updated_at))
      from public.task_responses r where r.attempt_id = p_attempt and r.task_id = p_task
    ), '[]'::jsonb),
    'audio_plays', coalesce((
      select jsonb_agg(jsonb_build_object('media_key', ap.media_key, 'plays', ap.plays))
      from public.audio_plays ap where ap.attempt_id = p_attempt and ap.task_id = p_task
    ), '[]'::jsonb),
    'recordings', coalesce((
      select jsonb_agg(jsonb_build_object('part_key', orr.part_key, 'segment_key', orr.segment_key,
                                          'status', orr.status, 'duration_ms', orr.duration_ms, 'created_at', orr.created_at))
      from public.oral_recordings orr where orr.attempt_id = p_attempt and orr.task_id = p_task
    ), '[]'::jsonb),
    -- elecciones orales ya hechas en otras tareas (la Tarea 5 depende del tema elegido en la Tarea 4)
    'choices', coalesce((
      select jsonb_object_agg(tk.position || ':' || r.item_key, r.payload ->> 'option_key')
      from public.task_responses r join public.tasks tk on tk.id = r.task_id
      where r.attempt_id = p_attempt and r.item_key like 'choice:%'
    ), '{}'::jsonb),
    'deadline_at', v_ats.deadline_at,
    'server_now', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Secciones: inicio, navegación y cierre
-- ---------------------------------------------------------------------------
create or replace function public.start_section(p_attempt uuid, p_section uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ats public.attempt_sections;
  v_limit integer;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;
  select * into v_ats from public.attempt_sections where attempt_id = p_attempt and section_id = p_section for update;
  if not found then perform public._raise('section_not_in_attempt'); end if;
  if v_ats.status = 'active' then
    return jsonb_build_object('deadline_at', v_ats.deadline_at, 'server_now', now());
  end if;
  if v_ats.status <> 'ready' then perform public._raise('section_not_ready'); end if;
  if exists (select 1 from public.attempt_sections where attempt_id = p_attempt and status = 'active') then
    perform public._raise('another_section_active');
  end if;

  select time_limit_seconds into v_limit from public.exam_sections where id = p_section;
  update public.attempt_sections
     set status = 'active', started_at = now(), deadline_at = now() + make_interval(secs => v_limit),
         current_task_position = 1, max_task_position = 1
   where attempt_id = p_attempt and section_id = p_section
   returning * into v_ats;
  perform public._log_attempt_event(p_attempt, 'section_started', jsonb_build_object('section_id', p_section));
  return jsonb_build_object('deadline_at', v_ats.deadline_at, 'server_now', now());
end;
$$;

create or replace function public.set_task_position(p_attempt uuid, p_section uuid, p_position integer)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ats public.attempt_sections;
  v_section public.exam_sections;
  v_max integer;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;
  select * into v_ats from public.attempt_sections where attempt_id = p_attempt and section_id = p_section for update;
  if not found or v_ats.status <> 'active' then perform public._raise('section_not_active'); end if;
  select * into v_section from public.exam_sections where id = p_section;
  select max(position) into v_max from public.tasks where section_id = p_section;
  if p_position < 1 or p_position > v_max then perform public._raise('invalid_task_position'); end if;
  if not v_section.allow_back and p_position < v_ats.current_task_position then
    perform public._raise('navigation_back_not_allowed');
  end if;
  update public.attempt_sections
     set current_task_position = p_position, max_task_position = greatest(max_task_position, p_position)
   where attempt_id = p_attempt and section_id = p_section;
  if p_position <> v_ats.current_task_position then
    perform public._log_attempt_event(p_attempt, 'task_navigation', jsonb_build_object('section_id', p_section, 'from', v_ats.current_task_position, 'to', p_position));
  end if;
  return jsonb_build_object('current_task_position', p_position, 'server_now', now());
end;
$$;

create or replace function public.complete_section(p_attempt uuid, p_section uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ats public.attempt_sections;
  v_pause integer;
  v_next uuid;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;
  select * into v_ats from public.attempt_sections where attempt_id = p_attempt and section_id = p_section for update;
  if not found then perform public._raise('section_not_in_attempt'); end if;
  if v_ats.status in ('completed', 'timed_out') then
    return jsonb_build_object('status', v_ats.status);
  end if;
  if v_ats.status <> 'active' then perform public._raise('section_not_active'); end if;

  update public.attempt_sections set status = 'completed', completed_at = now()
   where attempt_id = p_attempt and section_id = p_section;
  perform public._log_attempt_event(p_attempt, 'section_completed', jsonb_build_object('section_id', p_section));

  select pause_after_seconds into v_pause from public.exam_sections where id = p_section;
  select section_id into v_next from public.attempt_sections
   where attempt_id = p_attempt and position > v_ats.position and status = 'locked'
   order by position limit 1;
  if v_next is not null then
    update public.attempt_sections set status = 'ready', available_at = now() + make_interval(secs => v_pause)
     where attempt_id = p_attempt and section_id = v_next;
  end if;
  return jsonb_build_object('status', 'completed', 'next_section_id', v_next, 'pause_seconds', case when v_next is null then 0 else v_pause end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Guardado de respuestas
-- ---------------------------------------------------------------------------
create or replace function public.save_response(p_attempt uuid, p_task uuid, p_item_key text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_task public.tasks;
  v_question uuid;
  v_payload jsonb;
  v_words integer := 0;
  v_text text;
  v_opt uuid;
  v_ids uuid[];
  v_max smallint;
  v_resp public.task_responses;
  v_last timestamptz;
  v_kind text := 'autosave';
begin
  v_attempt := public._own_attempt(p_attempt);
  perform public._writable_task(v_attempt, p_task, true);
  select * into v_task from public.tasks where id = p_task;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    perform public._raise('invalid_payload');
  end if;

  if v_task.interaction_type in ('single_choice', 'dropdown_gap', 'matching', 'fragment_gap') then
    if coalesce(p_item_key, '') !~ '^q:[0-9a-f-]{36}$' then perform public._raise('invalid_item_key'); end if;
    v_question := substring(p_item_key from 3)::uuid;
    if not exists (select 1 from public.questions q where q.id = v_question and q.task_id = p_task) then
      perform public._raise('question_not_in_task');
    end if;
    if p_payload -> 'option_id' is null or p_payload -> 'option_id' = 'null'::jsonb then
      v_payload := jsonb_build_object('option_id', null);
    else
      v_opt := (p_payload ->> 'option_id')::uuid;
      if v_task.interaction_type in ('single_choice', 'dropdown_gap') then
        if not exists (select 1 from public.question_options o where o.id = v_opt and o.question_id = v_question) then
          perform public._raise('option_not_in_question');
        end if;
      else
        if not exists (select 1 from public.question_options o where o.id = v_opt and o.task_id = p_task and o.question_id is null) then
          perform public._raise('option_not_in_bank');
        end if;
      end if;
      v_payload := jsonb_build_object('option_id', v_opt);
    end if;

  elsif v_task.interaction_type = 'multi_select' then
    if coalesce(p_item_key, '') !~ '^q:[0-9a-f-]{36}$' then perform public._raise('invalid_item_key'); end if;
    v_question := substring(p_item_key from 3)::uuid;
    select max_selections into v_max from public.questions q where q.id = v_question and q.task_id = p_task;
    if not found then perform public._raise('question_not_in_task'); end if;
    if jsonb_typeof(p_payload -> 'option_ids') is distinct from 'array' then perform public._raise('invalid_payload'); end if;
    select coalesce(array_agg(distinct x::uuid), '{}') into v_ids from jsonb_array_elements_text(p_payload -> 'option_ids') x;
    if cardinality(v_ids) > v_max then perform public._raise('too_many_selections'); end if;
    if exists (select 1 from unnest(v_ids) i where not exists (
         select 1 from public.question_options o where o.id = i and o.task_id = p_task and o.question_id is null)) then
      perform public._raise('option_not_in_bank');
    end if;
    v_payload := jsonb_build_object('option_ids', to_jsonb(v_ids));

  elsif v_task.interaction_type = 'writing' then
    if p_item_key is distinct from 'text' then perform public._raise('invalid_item_key'); end if;
    v_text := coalesce(p_payload ->> 'text', '');
    if char_length(v_text) > 20000 then perform public._raise('text_too_long'); end if;
    if p_payload ? 'option_key' and p_payload ->> 'option_key' is not null
       and (p_payload ->> 'option_key') !~ '^[a-z0-9_-]{1,30}$' then
      perform public._raise('invalid_option_key');
    end if;
    if p_payload ->> 'option_key' is not null and not exists (
         select 1 from jsonb_array_elements(coalesce(v_task.content -> 'options', '[]'::jsonb)) o
         where o ->> 'key' = p_payload ->> 'option_key') then
      perform public._raise('invalid_option_key');
    end if;
    v_words := public.count_words(v_text);
    v_payload := jsonb_build_object('text', v_text, 'option_key', p_payload -> 'option_key');

  elsif v_task.interaction_type = 'speaking' then
    if p_item_key ~ '^choice:[a-z0-9_-]{1,30}$' then
      if (p_payload ->> 'option_key') is null or (p_payload ->> 'option_key') !~ '^[a-z0-9_-]{1,30}$' then
        perform public._raise('invalid_option_key');
      end if;
      -- una elección oral no se puede cambiar una vez hecha (como en el formato de referencia)
      if exists (select 1 from public.task_responses r where r.attempt_id = p_attempt and r.task_id = p_task
                 and r.item_key = p_item_key and r.payload ->> 'option_key' is distinct from p_payload ->> 'option_key') then
        perform public._raise('choice_already_made');
      end if;
      v_payload := jsonb_build_object('option_key', p_payload ->> 'option_key', 'auto_assigned', coalesce((p_payload ->> 'auto_assigned')::boolean, false));
    elsif p_item_key ~ '^notes:[a-z0-9_-]{1,30}$' then
      v_text := coalesce(p_payload ->> 'text', '');
      if char_length(v_text) > 4000 then perform public._raise('text_too_long'); end if;
      v_payload := jsonb_build_object('text', v_text);
    else
      perform public._raise('invalid_item_key');
    end if;
  else
    perform public._raise('unsupported_interaction');
  end if;

  insert into public.task_responses (attempt_id, task_id, item_key, question_id, payload, word_count)
  values (p_attempt, p_task, p_item_key, v_question, v_payload, v_words)
  on conflict (attempt_id, task_id, item_key)
  do update set payload = excluded.payload, word_count = excluded.word_count,
                revision = public.task_responses.revision + 1, updated_at = now()
  returning * into v_resp;

  if v_task.interaction_type = 'writing' then
    if v_attempt.status = 'resubmission_requested' then v_kind := 'resubmission'; end if;
    select max(saved_at) into v_last from public.response_revisions where response_id = v_resp.id;
    if v_last is null or v_last < now() - interval '60 seconds' then
      insert into public.response_revisions (response_id, payload, word_count, kind)
      values (v_resp.id, v_payload, v_words, v_kind);
    end if;
  end if;

  return jsonb_build_object('item_key', v_resp.item_key, 'revision', v_resp.revision,
                            'word_count', v_resp.word_count, 'saved_at', v_resp.updated_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Audio: control de reproducciones en servidor
-- ---------------------------------------------------------------------------
create or replace function public.register_audio_play(p_attempt uuid, p_task uuid, p_media_key text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_task public.tasks;
  v_asset uuid;
  v_plays smallint;
  v_limit smallint;
begin
  v_attempt := public._own_attempt(p_attempt);
  perform public._writable_task(v_attempt, p_task, false);
  select * into v_task from public.tasks where id = p_task;

  if coalesce(p_media_key, '') !~ '^[a-z0-9_.-]{1,80}$' then perform public._raise('invalid_media_key'); end if;
  v_asset := nullif(v_task.content -> 'media' -> p_media_key ->> 'asset_id', '')::uuid;
  if v_asset is null or coalesce(v_task.content -> 'media' -> p_media_key ->> 'kind', '') <> 'audio' then
    perform public._raise('media_not_found');
  end if;

  v_limit := coalesce((v_task.content -> 'media' -> p_media_key ->> 'max_plays')::smallint, v_task.max_audio_plays);
  insert into public.audio_plays (attempt_id, task_id, media_key, plays, last_played_at)
  values (p_attempt, p_task, p_media_key, 0, null)
  on conflict do nothing;
  select plays into v_plays from public.audio_plays
   where attempt_id = p_attempt and task_id = p_task and media_key = p_media_key for update;

  if v_limit > 0 and v_plays >= v_limit then
    perform public._raise('max_plays_reached');
  end if;
  update public.audio_plays set plays = plays + 1, last_played_at = now()
   where attempt_id = p_attempt and task_id = p_task and media_key = p_media_key;
  perform public._log_attempt_event(p_attempt, 'audio_play', jsonb_build_object('task_id', p_task, 'media_key', p_media_key, 'play', v_plays + 1));
  return jsonb_build_object('asset_id', v_asset, 'plays', v_plays + 1, 'limit', v_limit,
                            'remaining', case when v_limit > 0 then v_limit - v_plays - 1 else null end);
end;
$$;

-- Imágenes de la tarea (sin límite): devuelve los asset_id autorizados para firmar en servidor
create or replace function public.authorize_task_images(p_attempt uuid, p_task uuid)
returns uuid[]
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ids uuid[];
begin
  v_attempt := public._own_attempt(p_attempt);
  perform public._writable_task(v_attempt, p_task, false);
  select coalesce(array_agg((m.value ->> 'asset_id')::uuid), '{}') into v_ids
  from public.tasks t, jsonb_each(coalesce(t.content -> 'media', '{}'::jsonb)) m
  where t.id = p_task and m.value ->> 'kind' = 'image' and m.value ->> 'asset_id' is not null;
  return v_ids;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grabaciones orales: el registro solo se acepta si el archivo existe en Storage
-- ---------------------------------------------------------------------------
create or replace function public.register_recording(
  p_attempt uuid, p_task uuid, p_part text, p_segment text,
  p_path text, p_mime text, p_size bigint, p_duration_ms integer, p_sha256 text
)
returns jsonb
language plpgsql security definer set search_path = public, storage
as $$
declare
  v_attempt public.attempts;
  v_task public.tasks;
  v_obj record;
  v_rec public.oral_recordings;
begin
  v_attempt := public._own_attempt(p_attempt);
  perform public._writable_task(v_attempt, p_task, true);
  select * into v_task from public.tasks where id = p_task;
  if v_task.interaction_type <> 'speaking' then perform public._raise('not_a_speaking_task'); end if;
  if coalesce(p_part, '') !~ '^[a-z0-9_-]{1,30}$' or coalesce(p_segment, '') !~ '^[a-z0-9_-]{1,30}$' then perform public._raise('invalid_segment'); end if;
  -- p_part y p_segment ya están restringidos a [a-z0-9_-], por lo que es seguro componer la expresión
  if coalesce(p_path, '') !~ ('^' || auth.uid()::text || '/' || p_attempt::text || '/' || p_task::text || '/'
                || p_part || '-' || p_segment || '(-[0-9]{10,16})?\.(webm|ogg|mp4|m4a|wav)$') then
    perform public._raise('invalid_recording_path');
  end if;
  if coalesce(p_mime, '') !~ '^audio/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)' then perform public._raise('invalid_mime'); end if;
  if coalesce(p_sha256, '') !~ '^[0-9a-f]{64}$' then perform public._raise('invalid_checksum'); end if;

  -- formato de la grabación en el modo formal: una sola grabación por segmento
  if v_attempt.mode = 'formal' and exists (
      select 1 from public.oral_recordings r where r.attempt_id = p_attempt and r.task_id = p_task
      and r.part_key = p_part and r.segment_key = p_segment and r.status = 'verified') then
    perform public._raise('recording_already_submitted');
  end if;

  select o.name, o.owner, o.metadata into v_obj
    from storage.objects o where o.bucket_id = 'recordings' and o.name = p_path;
  if not found then
    perform public._raise('recording_not_in_storage');
  end if;
  if v_obj.owner is distinct from auth.uid() then
    perform public._raise('recording_owner_mismatch');
  end if;
  if coalesce((v_obj.metadata ->> 'size')::bigint, -1) <> p_size then
    perform public._raise('recording_size_mismatch');
  end if;

  insert into public.oral_recordings (attempt_id, task_id, part_key, segment_key, storage_path, mime_type,
                                      size_bytes, duration_ms, sha256, status, uploaded_by, verified_at)
  values (p_attempt, p_task, p_part, p_segment, p_path, p_mime, p_size, p_duration_ms, p_sha256, 'verified', auth.uid(), now())
  on conflict (attempt_id, task_id, part_key, segment_key) do update
    set storage_path = excluded.storage_path, mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
        duration_ms = excluded.duration_ms, sha256 = excluded.sha256, status = 'verified', verified_at = now(),
        created_at = now()
  returning * into v_rec;

  perform public._log_attempt_event(p_attempt, 'recording_saved', jsonb_build_object('task_id', p_task, 'part', p_part, 'segment', p_segment, 'size', p_size, 'duration_ms', p_duration_ms));
  return jsonb_build_object('id', v_rec.id, 'status', v_rec.status, 'verified_at', v_rec.verified_at);
end;
$$;

-- ---------------------------------------------------------------------------
-- Registro de eventos del cliente (pérdida de foco, reconexión…) con lista cerrada
-- ---------------------------------------------------------------------------
create or replace function public.log_client_event(p_attempt uuid, p_type text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.attempts where id = p_attempt and student_id = auth.uid()) then
    perform public._raise('attempt_not_found');
  end if;
  if p_type is null or p_type not in ('visibility_hidden', 'visibility_visible', 'connection_lost', 'connection_restored', 'mic_check_ok', 'mic_check_failed', 'audio_check_ok', 'fullscreen_exit') then
    perform public._raise('invalid_event_type');
  end if;
  if octet_length(coalesce(p_details, '{}'::jsonb)::text) > 2000 then
    perform public._raise('event_too_large');
  end if;
  perform public._log_attempt_event(p_attempt, p_type, coalesce(p_details, '{}'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------------
-- Corrección automática y envío
-- ---------------------------------------------------------------------------
create or replace function public._score_objective(p_attempt uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_sel uuid[];
  v_hits integer;
begin
  delete from public.attempt_section_scores where attempt_id = p_attempt;

  -- puntuar cada respuesta guardada
  for r in
    select q.id as question_id, q.points, q.task_id, k.correct_option_ids, tk.interaction_type, resp.id as response_id, resp.payload
    from public.attempt_sections ats
    join public.exam_sections s on s.id = ats.section_id and s.skill in ('reading', 'listening')
    join public.tasks tk on tk.section_id = s.id
    join public.questions q on q.task_id = tk.id
    join public.question_keys k on k.question_id = q.id
    left join public.task_responses resp on resp.attempt_id = p_attempt and resp.task_id = tk.id and resp.item_key = 'q:' || q.id
    where ats.attempt_id = p_attempt
  loop
    if r.response_id is null then
      continue;
    end if;
    if r.interaction_type = 'multi_select' then
      select coalesce(array_agg(x::uuid), '{}') into v_sel from jsonb_array_elements_text(coalesce(r.payload -> 'option_ids', '[]'::jsonb)) x;
      select count(*) into v_hits from unnest(v_sel) s where s = any (r.correct_option_ids);
      update public.task_responses
         set auto_points = least(v_hits, cardinality(r.correct_option_ids)) * (r.points / cardinality(r.correct_option_ids)),
             auto_max = r.points,
             is_correct = (v_hits = cardinality(r.correct_option_ids) and cardinality(v_sel) = v_hits)
       where id = r.response_id;
    else
      update public.task_responses
         set auto_points = case when (r.payload ->> 'option_id') is not null and (r.payload ->> 'option_id')::uuid = any (r.correct_option_ids) then r.points else 0 end,
             auto_max = r.points,
             is_correct = (r.payload ->> 'option_id') is not null and (r.payload ->> 'option_id')::uuid = any (r.correct_option_ids)
       where id = r.response_id;
    end if;
  end loop;

  -- agregados por sección, tarea y nivel
  insert into public.attempt_section_scores (attempt_id, section_id, skill, correct, wrong, blank, raw_points, max_points, by_task, by_level)
  select p_attempt, s.id, s.skill,
         sum(x.correct)::int, sum(x.wrong)::int, sum(x.blank)::int, sum(x.points), sum(x.max_points),
         (select coalesce(jsonb_agg(t order by (t ->> 'position')::int), '[]'::jsonb) from (
            select jsonb_build_object('task_id', y.task_id, 'position', y.task_position, 'title', y.task_title,
                                      'correct', sum(y.correct), 'wrong', sum(y.wrong), 'blank', sum(y.blank),
                                      'points', sum(y.points), 'max_points', sum(y.max_points)) as t
            from public._objective_items(p_attempt) y where y.section_id = s.id
            group by y.task_id, y.task_position, y.task_title) tt),
         (select coalesce(jsonb_agg(l order by l ->> 'level'), '[]'::jsonb) from (
            select jsonb_build_object('level', coalesce(y.level::text, 'sin_nivel'), 'correct', sum(y.correct),
                                      'total', sum(y.correct + y.wrong + y.blank)) as l
            from public._objective_items(p_attempt) y where y.section_id = s.id
            group by y.level) ll)
  from public.attempt_sections ats
  join public.exam_sections s on s.id = ats.section_id and s.skill in ('reading', 'listening')
  join public._objective_items(p_attempt) x on x.section_id = s.id
  where ats.attempt_id = p_attempt
  group by s.id, s.skill;
end;
$$;

-- Ítems objetivos del intento con su resultado (un ítem por elemento de clave en multi_select)
create or replace function public._objective_items(p_attempt uuid)
returns table (
  section_id uuid, task_id uuid, task_position smallint, task_title text, question_id uuid, question_position smallint,
  level public.cefr_level, correct integer, wrong integer, blank integer, points numeric, max_points numeric
)
language sql stable security definer set search_path = public
as $$
  select s.id, tk.id, tk.position, tk.title, q.id, q.position, q.level,
         c.correct, c.wrong, (c.slots - c.correct - c.wrong)::int as blank,
         coalesce(resp.auto_points, 0), q.points
  from public.attempt_sections ats
  join public.exam_sections s on s.id = ats.section_id and s.skill in ('reading', 'listening')
  join public.tasks tk on tk.section_id = s.id
  join public.questions q on q.task_id = tk.id
  join public.question_keys k on k.question_id = q.id
  left join public.task_responses resp on resp.attempt_id = p_attempt and resp.task_id = tk.id and resp.item_key = 'q:' || q.id
  cross join lateral (
    select
      case when tk.interaction_type = 'multi_select' then cardinality(k.correct_option_ids) else 1 end as slots,
      case when tk.interaction_type = 'multi_select'
           then (select count(*) from jsonb_array_elements_text(coalesce(resp.payload -> 'option_ids', '[]'::jsonb)) x
                 where x::uuid = any (k.correct_option_ids))::int
           else case when (resp.payload ->> 'option_id') is not null
                          and (resp.payload ->> 'option_id')::uuid = any (k.correct_option_ids) then 1 else 0 end end as correct,
      case when tk.interaction_type = 'multi_select'
           then least(
                  (select count(*) from jsonb_array_elements_text(coalesce(resp.payload -> 'option_ids', '[]'::jsonb)) x
                   where not (x::uuid = any (k.correct_option_ids))),
                  cardinality(k.correct_option_ids)
                  - (select count(*) from jsonb_array_elements_text(coalesce(resp.payload -> 'option_ids', '[]'::jsonb)) x
                     where x::uuid = any (k.correct_option_ids)))::int
           else case when (resp.payload ->> 'option_id') is not null
                          and not ((resp.payload ->> 'option_id')::uuid = any (k.correct_option_ids)) then 1 else 0 end end as wrong
  ) c
  where ats.attempt_id = p_attempt
$$;

create or replace function public._finalize_attempt(p_attempt uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_asg public.exam_assignments;
  v_has_productive boolean;
begin
  select * into v_attempt from public.attempts where id = p_attempt for update;
  if v_attempt.status <> 'in_progress' then return; end if;
  select * into v_asg from public.exam_assignments where id = v_attempt.assignment_id;

  update public.attempt_sections
     set status = case when status = 'active' and deadline_at < now() then 'timed_out'::public.section_status
                       else 'completed'::public.section_status end,
         completed_at = coalesce(completed_at, least(now(), coalesce(deadline_at, now())))
   where attempt_id = p_attempt and status in ('active', 'ready', 'locked');

  perform public._score_objective(p_attempt);

  update public.attempts set status = 'submitted', submitted_at = now() where id = p_attempt;
  perform public._log_attempt_event(p_attempt, 'submitted', jsonb_build_object('reason', p_reason));

  select exists (
    select 1 from public.attempt_sections ats join public.exam_sections s on s.id = ats.section_id
    where ats.attempt_id = p_attempt and s.skill in ('writing', 'speaking')
  ) into v_has_productive;

  if v_asg.immediate_feedback then
    perform public._publish_report(p_attempt, case when v_has_productive then 'objective_auto' else 'full' end, null);
  end if;
end;
$$;

create or replace function public.submit_attempt(p_attempt uuid, p_confirm_blanks boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_blanks jsonb;
  v_total_blank integer;
  v_missing_recordings integer;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status = 'submitted' or v_attempt.status = 'published' then
    return jsonb_build_object('status', v_attempt.status, 'already_submitted', true);
  end if;
  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('task_id', tk.id, 'section_title', s.title, 'task_title', tk.title,
                                               'task_position', tk.position, 'blank', b.blank)), '[]'::jsonb),
         coalesce(sum(b.blank), 0)
    into v_blanks, v_total_blank
  from public.attempt_sections ats
  join public.exam_sections s on s.id = ats.section_id
  join public.tasks tk on tk.section_id = s.id
  cross join lateral (
    select case
      when tk.interaction_type = 'writing' then
        case when exists (select 1 from public.task_responses r where r.attempt_id = p_attempt and r.task_id = tk.id
                          and r.item_key = 'text' and btrim(r.payload ->> 'text') <> '') then 0 else 1 end
      when tk.interaction_type = 'speaking' then
        case when exists (select 1 from public.oral_recordings orr where orr.attempt_id = p_attempt and orr.task_id = tk.id and orr.status = 'verified')
             then 0 else 1 end
      else (select count(*) from public.questions q where q.task_id = tk.id and not exists (
              select 1 from public.task_responses r where r.attempt_id = p_attempt and r.item_key = 'q:' || q.id
              and ((r.payload ->> 'option_id') is not null or jsonb_array_length(coalesce(r.payload -> 'option_ids', '[]'::jsonb)) > 0)))
    end::int as blank
  ) b
  where ats.attempt_id = p_attempt and b.blank > 0;

  if v_total_blank > 0 and not p_confirm_blanks then
    return jsonb_build_object('status', 'needs_confirmation', 'blank_items', v_total_blank, 'by_task', v_blanks);
  end if;

  select count(*) into v_missing_recordings from public.oral_recordings
   where attempt_id = p_attempt and status <> 'verified';

  perform public._finalize_attempt(p_attempt, 'student_submit');
  return jsonb_build_object('status', 'submitted', 'blank_items', v_total_blank, 'unverified_recordings', v_missing_recordings);
end;
$$;

-- Práctica con retroalimentación inmediata: comprobar una tarea objetiva (después ya no se puede cambiar)
create or replace function public.check_practice_task(p_attempt uuid, p_task uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_task public.tasks;
  v_feedback boolean;
begin
  v_attempt := public._own_attempt(p_attempt);
  select immediate_feedback into v_feedback from public.exam_assignments where id = v_attempt.assignment_id;
  if v_attempt.mode <> 'practice' or not v_feedback then
    perform public._raise('feedback_not_enabled');
  end if;
  perform public._writable_task(v_attempt, p_task, false);
  select * into v_task from public.tasks where id = p_task;
  if v_task.interaction_type in ('writing', 'speaking') then
    perform public._raise('feedback_only_for_objective_tasks');
  end if;

  insert into public.practice_task_checks (attempt_id, task_id) values (p_attempt, p_task) on conflict do nothing;
  perform public._log_attempt_event(p_attempt, 'practice_task_checked', jsonb_build_object('task_id', p_task));

  return jsonb_build_object('task_id', p_task, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'question_id', q.id, 'position', q.position,
      'selected', coalesce(r.payload -> 'option_ids', r.payload -> 'option_id'),
      'correct_option_ids', to_jsonb(k.correct_option_ids),
      'is_correct', case when tk.interaction_type = 'multi_select'
                         then (select coalesce(array_agg(x::uuid order by x), '{}') from jsonb_array_elements_text(coalesce(r.payload -> 'option_ids', '[]'::jsonb)) x)
                              = (select array_agg(c order by c) from unnest(k.correct_option_ids) c)
                         else (r.payload ->> 'option_id') is not null and (r.payload ->> 'option_id')::uuid = any (k.correct_option_ids) end,
      'explanation', k.explanation
    ) order by q.position)
    from public.questions q
    join public.tasks tk on tk.id = q.task_id
    join public.question_keys k on k.question_id = q.id
    left join public.task_responses r on r.attempt_id = p_attempt and r.task_id = q.task_id and r.item_key = 'q:' || q.id
    where q.task_id = p_task
  ), '[]'::jsonb));
end;
$$;

-- Entrega de una tarea reabierta por la profesora
create or replace function public.submit_resubmission(p_attempt uuid, p_task uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'resubmission_requested' then perform public._raise('no_open_resubmission'); end if;
  update public.resubmissions set status = 'submitted', submitted_at = now()
   where attempt_id = p_attempt and task_id = p_task and status = 'open';
  if not found then perform public._raise('no_open_resubmission'); end if;

  insert into public.response_revisions (response_id, payload, word_count, kind)
  select r.id, r.payload, r.word_count, 'resubmission' from public.task_responses r
   where r.attempt_id = p_attempt and r.task_id = p_task and r.item_key = 'text';

  if not exists (select 1 from public.resubmissions where attempt_id = p_attempt and status = 'open') then
    update public.attempts set status = 'submitted' where id = p_attempt;
  end if;
  perform public._log_attempt_event(p_attempt, 'resubmission_submitted', jsonb_build_object('task_id', p_task));
  return jsonb_build_object('status', 'submitted');
end;
$$;

-- Barrido para el personal docente: cierra intentos vencidos visibles para él
create or replace function public.sweep_expired_attempts()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  if not public.is_staff() then perform public._raise('forbidden'); end if;
  for r in
    select a.id from public.attempts a
    join public.exam_assignments asg on asg.id = a.assignment_id
    where a.status = 'in_progress' and public.staff_can_view_student(a.student_id)
      and (exists (select 1 from public.attempt_sections s where s.attempt_id = a.id and s.status = 'active'
                   and s.deadline_at + make_interval(secs => asg.grace_seconds) < now())
           or (asg.closes_at is not null and asg.closes_at < now()))
  loop
    perform public._sweep_attempt(r.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;
