-- Funciones auxiliares de autorización, disparadores de integridad y políticas RLS.

-- ---------------------------------------------------------------------------
-- Funciones de autorización (STABLE, SECURITY DEFINER para evitar recursión en RLS)
-- ---------------------------------------------------------------------------
create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.is_active
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.my_role() in ('teacher', 'admin'), false)
$$;

create or replace function public.can_author()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_admin() or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'teacher' and p.can_author
  ), false)
$$;

create or replace function public.teaches_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_admin() or (
    public.my_role() = 'teacher' and exists (
      select 1 from public.teacher_assignments ta
      where ta.class_id = p_class and ta.teacher_id = auth.uid()
    )
  ), false)
$$;

-- ¿Puede el usuario actual (personal docente) ver a este estudiante?
create or replace function public.staff_can_view_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.is_admin() or (
    public.my_role() = 'teacher' and exists (
      select 1
      from public.class_members cm
      join public.teacher_assignments ta on ta.class_id = cm.class_id
      join public.classes c on c.id = cm.class_id and c.archived_at is null
      where cm.student_id = p_student and ta.teacher_id = auth.uid()
    )
  ), false)
$$;

create or replace function public.can_view_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((p_student = auth.uid() and public.my_role() is not null), false) or public.staff_can_view_student(p_student)
$$;

create or replace function public.staff_can_view_attempt(p_attempt uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.attempts a
    where a.id = p_attempt and a.student_id <> auth.uid() and public.staff_can_view_student(a.student_id)
  )
$$;

create or replace function public.staff_can_view_evaluation(p_evaluation uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.evaluations e
    where e.id = p_evaluation and public.staff_can_view_attempt(e.attempt_id)
  )
$$;

create or replace function public.student_in_class(p_class uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.class_members cm
    where cm.class_id = p_class and cm.student_id = auth.uid()
  )
$$;

-- ---------------------------------------------------------------------------
-- Auditoría
-- ---------------------------------------------------------------------------
create or replace function public.log_audit(p_action text, p_entity text, p_entity_id text, p_details jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public
as $$
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, coalesce(p_details, '{}'::jsonb))
$$;

-- ---------------------------------------------------------------------------
-- Perfiles: creación automática y protección de campos privilegiados
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- El rol SIEMPRE empieza como 'student'. Nunca se lee el rol de los metadatos del cliente.
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.guard_profile_update()
returns trigger
language plpgsql set search_path = public
as $$
begin
  new.updated_at := now();
  if new.id <> old.id then
    raise exception 'profile_id_immutable' using errcode = '42501';
  end if;
  if (new.role, new.is_active, new.can_author, new.email) is distinct from (old.role, old.is_active, old.can_author, old.email) then
    -- Solo funciones administrativas (que se ejecutan como propietario) o el rol de servicio
    if current_user not in ('postgres', 'service_role', 'supabase_admin') then
      raise exception 'forbidden_profile_field' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_guard
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Contenido publicado inmutable: una versión publicada no puede modificarse
-- ---------------------------------------------------------------------------
create or replace function public.version_of_section(p_section uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select version_id from public.exam_sections where id = p_section $$;

create or replace function public.version_of_task(p_task uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select s.version_id from public.tasks t join public.exam_sections s on s.id = t.section_id where t.id = p_task $$;

create or replace function public.version_of_question(p_question uuid)
returns uuid language sql stable security definer set search_path = public
as $$ select public.version_of_task(q.task_id) from public.questions q where q.id = p_question $$;

create or replace function public.guard_published_content()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  r record;
  v_version uuid;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;

  if tg_table_name = 'exam_sections' then
    v_version := r.version_id;
  elsif tg_table_name = 'tasks' then
    v_version := public.version_of_section(r.section_id);
  elsif tg_table_name in ('questions', 'question_options', 'task_private') then
    v_version := public.version_of_task(r.task_id);
  elsif tg_table_name = 'question_keys' then
    v_version := public.version_of_question(r.question_id);
  end if;

  if v_version is not null and exists (
    select 1 from public.exam_versions v where v.id = v_version and v.status <> 'draft'
  ) then
    raise exception 'version_locked: las versiones publicadas o archivadas no se pueden modificar; duplique la versión'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger exam_sections_guard before insert or update or delete on public.exam_sections
  for each row execute function public.guard_published_content();
create trigger tasks_guard before insert or update or delete on public.tasks
  for each row execute function public.guard_published_content();
create trigger questions_guard before insert or update or delete on public.questions
  for each row execute function public.guard_published_content();
create trigger question_options_guard before insert or update or delete on public.question_options
  for each row execute function public.guard_published_content();
create trigger question_keys_guard before insert or update or delete on public.question_keys
  for each row execute function public.guard_published_content();
create trigger task_private_guard before insert or update or delete on public.task_private
  for each row execute function public.guard_published_content();

create or replace function public.guard_version_update()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.status <> 'draft' and (new.template_id, new.version_no) is distinct from (old.template_id, old.version_no) then
    raise exception 'version_locked' using errcode = '42501';
  end if;
  if old.status = 'archived' and new.status <> 'archived' then
    raise exception 'archived_version_is_final' using errcode = '42501';
  end if;
  if old.status = 'published' and new.status = 'draft' then
    raise exception 'published_version_cannot_return_to_draft' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger exam_versions_guard before update on public.exam_versions
  for each row execute function public.guard_version_update();

create or replace function public.guard_version_delete()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if old.status <> 'draft' then
    raise exception 'version_locked: archive la versión en lugar de eliminarla' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger exam_versions_delete_guard before delete on public.exam_versions
  for each row execute function public.guard_version_delete();

-- Historial de evaluaciones
create or replace function public.track_evaluation_history()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.evaluation_history (evaluation_id, action, changed_by, snapshot)
  values (
    new.id,
    case when tg_op = 'INSERT' then 'created'
         when new.status = 'published' and old.status is distinct from 'published' then 'published'
         else 'updated' end,
    auth.uid(),
    jsonb_build_object(
      'status', new.status, 'points', new.points, 'max_points', new.max_points,
      'pedagogical_percent', new.pedagogical_percent, 'global_comment', new.global_comment,
      'scores', (select coalesce(jsonb_agg(jsonb_build_object('criterion', rs.criterion_key, 'band', rs.band, 'comment', rs.comment) order by rs.criterion_key), '[]'::jsonb)
                 from public.rubric_scores rs where rs.evaluation_id = new.id)
    )
  );
  return new;
end;
$$;

create trigger evaluations_history after insert or update on public.evaluations
  for each row execute function public.track_evaluation_history();

-- ---------------------------------------------------------------------------
-- Privilegios base: nada para anon; el acceso de authenticated lo restringe RLS
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.invitations enable row level security;
alter table public.invitation_redemptions enable row level security;
alter table public.sources enable row level security;
alter table public.rule_sources enable row level security;
alter table public.rubric_versions enable row level security;
alter table public.scoring_tables enable row level security;
alter table public.exam_templates enable row level security;
alter table public.exam_versions enable row level security;
alter table public.exam_sections enable row level security;
alter table public.media_assets enable row level security;
alter table public.tasks enable row level security;
alter table public.task_private enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_keys enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_sections enable row level security;
alter table public.task_responses enable row level security;
alter table public.response_revisions enable row level security;
alter table public.oral_recordings enable row level security;
alter table public.audio_plays enable row level security;
alter table public.attempt_events enable row level security;
alter table public.attempt_section_scores enable row level security;
alter table public.resubmissions enable row level security;
alter table public.evaluations enable row level security;
alter table public.rubric_scores enable row level security;
alter table public.teacher_feedback enable row level security;
alter table public.evaluation_history enable row level security;
alter table public.published_results enable row level security;
alter table public.study_plans enable row level security;
alter table public.study_plan_items enable row level security;
alter table public.practice_progress enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.retention_policies enable row level security;
alter table public.app_settings enable row level security;
alter table public.ai_suggestions enable row level security;

-- profiles ------------------------------------------------------------------
grant select, update (full_name, target_level, target_date) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.staff_can_view_student(id) or public.is_admin()
         or (public.my_role() = 'student' and role = 'teacher' and exists (
              select 1 from public.teacher_assignments ta join public.class_members cm on cm.class_id = ta.class_id
              where ta.teacher_id = profiles.id and cm.student_id = (select auth.uid()))));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and public.my_role() is not null)
  with check (id = (select auth.uid()));

-- classes -------------------------------------------------------------------
grant select, insert, update, delete on public.classes to authenticated;
create policy classes_select on public.classes for select to authenticated
  using (public.is_admin() or public.teaches_class(id) or public.student_in_class(id));
create policy classes_admin_insert on public.classes for insert to authenticated with check (public.is_admin());
create policy classes_admin_update on public.classes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy classes_admin_delete on public.classes for delete to authenticated using (public.is_admin());

-- class_members -------------------------------------------------------------
grant select, insert, delete on public.class_members to authenticated;
create policy class_members_select on public.class_members for select to authenticated
  using (student_id = (select auth.uid()) or public.teaches_class(class_id));
create policy class_members_admin_insert on public.class_members for insert to authenticated
  with check (public.is_admin() and exists (select 1 from public.profiles p where p.id = student_id and p.role = 'student'));
create policy class_members_admin_delete on public.class_members for delete to authenticated using (public.is_admin());

-- teacher_assignments: solo el administrador concede o revoca -------------------
grant select on public.teacher_assignments to authenticated;
create policy teacher_assignments_select on public.teacher_assignments for select to authenticated
  using (teacher_id = (select auth.uid()) or public.is_admin()
         or (public.my_role() = 'student' and public.student_in_class(class_id)));

-- invitations: admin todo; profesora solo invitaciones de estudiante para sus clases
grant select, insert on public.invitations to authenticated;
grant update (revoked_at, note) on public.invitations to authenticated;
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_admin() or (public.my_role() = 'teacher' and created_by = (select auth.uid())));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (
    created_by = (select auth.uid()) and uses = 0 and revoked_at is null
    and expires_at <= now() + interval '60 days'
    and (public.is_admin() or (role = 'student' and class_id is not null and public.teaches_class(class_id)))
  );
create policy invitations_revoke on public.invitations for update to authenticated
  using (public.is_admin() or (public.my_role() = 'teacher' and created_by = (select auth.uid())))
  with check (public.is_admin() or (public.my_role() = 'teacher' and created_by = (select auth.uid()) and role = 'student'));

grant select on public.invitation_redemptions to authenticated;
create policy invitation_redemptions_select on public.invitation_redemptions for select to authenticated
  using (public.is_admin());

-- fuentes, rúbricas, tablas de puntuación: lectura del personal docente; escritura admin
grant select, insert, update on public.sources, public.rule_sources to authenticated;
create policy sources_select on public.sources for select to authenticated using (public.is_staff());
create policy sources_admin_insert on public.sources for insert to authenticated with check (public.is_admin());
create policy sources_admin_update on public.sources for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy rule_sources_select on public.rule_sources for select to authenticated using (public.is_staff());
create policy rule_sources_admin_insert on public.rule_sources for insert to authenticated with check (public.is_admin());
create policy rule_sources_admin_update on public.rule_sources for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.rubric_versions to authenticated;
create policy rubric_versions_select on public.rubric_versions for select to authenticated using (public.is_staff());
create policy rubric_versions_admin_insert on public.rubric_versions for insert to authenticated with check (public.is_admin());
create policy rubric_versions_admin_update on public.rubric_versions for update to authenticated
  using (public.is_admin() and status = 'draft') with check (public.is_admin());

grant select, insert, update on public.scoring_tables to authenticated;
create policy scoring_tables_select on public.scoring_tables for select to authenticated using (public.is_staff());
create policy scoring_tables_admin_insert on public.scoring_tables for insert to authenticated with check (public.is_admin());
create policy scoring_tables_admin_update on public.scoring_tables for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- banco de simulacros: el personal docente lee; los autores autorizados escriben.
-- Los estudiantes NO leen estas tablas: reciben el contenido mediante get_attempt_task().
grant select, insert, update, delete on public.exam_templates, public.exam_versions, public.exam_sections,
  public.tasks, public.task_private, public.questions, public.question_options, public.question_keys,
  public.media_assets to authenticated;

create policy exam_templates_select on public.exam_templates for select to authenticated using (public.is_staff());
create policy exam_templates_write on public.exam_templates for all to authenticated
  using (public.can_author()) with check (public.can_author());
create policy exam_versions_select on public.exam_versions for select to authenticated using (public.is_staff());
create policy exam_versions_insert on public.exam_versions for insert to authenticated
  with check (public.can_author() and status = 'draft');
create policy exam_versions_update on public.exam_versions for update to authenticated
  using (public.can_author() and status = 'draft') with check (public.can_author() and status = 'draft');
create policy exam_versions_delete on public.exam_versions for delete to authenticated
  using (public.can_author() and status = 'draft');
create policy exam_sections_select on public.exam_sections for select to authenticated using (public.is_staff());
create policy exam_sections_write on public.exam_sections for all to authenticated
  using (public.can_author()) with check (public.can_author());
create policy tasks_select on public.tasks for select to authenticated using (public.is_staff());
create policy tasks_write on public.tasks for all to authenticated using (public.can_author()) with check (public.can_author());
create policy task_private_select on public.task_private for select to authenticated using (public.is_staff());
create policy task_private_write on public.task_private for all to authenticated using (public.can_author()) with check (public.can_author());
create policy questions_select on public.questions for select to authenticated using (public.is_staff());
create policy questions_write on public.questions for all to authenticated using (public.can_author()) with check (public.can_author());
create policy question_options_select on public.question_options for select to authenticated using (public.is_staff());
create policy question_options_write on public.question_options for all to authenticated using (public.can_author()) with check (public.can_author());
create policy question_keys_select on public.question_keys for select to authenticated using (public.is_staff());
create policy question_keys_write on public.question_keys for all to authenticated using (public.can_author()) with check (public.can_author());
create policy media_assets_select on public.media_assets for select to authenticated using (public.is_staff());
create policy media_assets_write on public.media_assets for all to authenticated using (public.can_author()) with check (public.can_author());

-- asignaciones ----------------------------------------------------------------
grant select, insert, update on public.exam_assignments to authenticated;
create policy exam_assignments_select on public.exam_assignments for select to authenticated
  using (
    public.is_admin()
    or created_by = (select auth.uid())
    or (class_id is not null and public.teaches_class(class_id))
    or (student_id is not null and student_id <> (select auth.uid()) and public.staff_can_view_student(student_id))
    or (public.my_role() = 'student' and archived_at is null and (
          student_id = (select auth.uid()) or (class_id is not null and public.student_in_class(class_id))))
  );
create policy exam_assignments_insert on public.exam_assignments for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.exam_versions v where v.id = version_id and v.status = 'published')
    and (public.is_admin()
         or (public.my_role() = 'teacher'
             and (class_id is null or public.teaches_class(class_id))
             and (student_id is null or public.staff_can_view_student(student_id))))
  );
create policy exam_assignments_update on public.exam_assignments for update to authenticated
  using (public.is_admin() or (public.my_role() = 'teacher' and created_by = (select auth.uid())))
  with check (public.is_admin() or (public.my_role() = 'teacher' and created_by = (select auth.uid())
              and (class_id is null or public.teaches_class(class_id))));

-- intentos y respuestas: lectura directa limitada; escrituras solo por RPC ------------
grant select on public.attempts, public.attempt_sections, public.oral_recordings, public.attempt_section_scores,
  public.resubmissions to authenticated;
create policy attempts_select on public.attempts for select to authenticated
  using (student_id = (select auth.uid()) or public.staff_can_view_student(student_id));
create policy attempt_sections_select on public.attempt_sections for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.student_id = (select auth.uid()) or public.staff_can_view_student(a.student_id))));
create policy oral_recordings_select on public.oral_recordings for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.student_id = (select auth.uid()) or public.staff_can_view_student(a.student_id))));
-- las puntuaciones objetivas solo las ve el personal; el estudiante las recibe al publicarse
create policy attempt_section_scores_select on public.attempt_section_scores for select to authenticated
  using (public.staff_can_view_attempt(attempt_id));
create policy resubmissions_select on public.resubmissions for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id
                 and (a.student_id = (select auth.uid()) or public.staff_can_view_student(a.student_id))));

-- respuestas: el estudiante no las lee directamente (contienen corrección automática)
grant select on public.task_responses, public.response_revisions, public.audio_plays, public.attempt_events to authenticated;
create policy task_responses_staff_select on public.task_responses for select to authenticated
  using (public.staff_can_view_attempt(attempt_id));
create policy response_revisions_staff_select on public.response_revisions for select to authenticated
  using (exists (select 1 from public.task_responses r where r.id = response_id and public.staff_can_view_attempt(r.attempt_id)));
create policy audio_plays_select on public.audio_plays for select to authenticated
  using (public.staff_can_view_attempt(attempt_id));
create policy attempt_events_select on public.attempt_events for select to authenticated
  using (public.staff_can_view_attempt(attempt_id));

-- evaluación docente: solo personal con acceso al estudiante ---------------------------
grant select on public.evaluations, public.rubric_scores, public.evaluation_history to authenticated;
grant select, insert, update, delete on public.teacher_feedback to authenticated;
create policy evaluations_select on public.evaluations for select to authenticated
  using (public.staff_can_view_attempt(attempt_id));
create policy rubric_scores_select on public.rubric_scores for select to authenticated
  using (public.staff_can_view_evaluation(evaluation_id));
create policy evaluation_history_select on public.evaluation_history for select to authenticated
  using (public.staff_can_view_evaluation(evaluation_id));
create policy teacher_feedback_select on public.teacher_feedback for select to authenticated
  using (public.staff_can_view_evaluation(evaluation_id));
create policy teacher_feedback_insert on public.teacher_feedback for insert to authenticated
  with check (public.staff_can_view_evaluation(evaluation_id) and created_by = (select auth.uid()));
create policy teacher_feedback_update on public.teacher_feedback for update to authenticated
  using (public.staff_can_view_evaluation(evaluation_id)) with check (public.staff_can_view_evaluation(evaluation_id));
create policy teacher_feedback_delete on public.teacher_feedback for delete to authenticated
  using (public.staff_can_view_evaluation(evaluation_id));

grant select on public.published_results to authenticated;
create policy published_results_select on public.published_results for select to authenticated
  using (student_id = (select auth.uid()) or public.staff_can_view_student(student_id));

-- planes de estudio ---------------------------------------------------------------
grant select, insert, update, delete on public.study_plans, public.study_plan_items to authenticated;
create policy study_plans_select on public.study_plans for select to authenticated
  using (student_id = (select auth.uid()) or public.staff_can_view_student(student_id));
create policy study_plans_insert on public.study_plans for insert to authenticated
  with check (created_by = (select auth.uid())
              and ((student_id = (select auth.uid()) and public.my_role() = 'student') or public.staff_can_view_student(student_id)));
create policy study_plans_update on public.study_plans for update to authenticated
  using (student_id = (select auth.uid()) or public.staff_can_view_student(student_id))
  with check (student_id = (select auth.uid()) or public.staff_can_view_student(student_id));
create policy study_plans_delete on public.study_plans for delete to authenticated
  using (public.staff_can_view_student(student_id) or (student_id = (select auth.uid()) and created_by = (select auth.uid())));
create policy study_plan_items_select on public.study_plan_items for select to authenticated
  using (exists (select 1 from public.study_plans p where p.id = plan_id
                 and (p.student_id = (select auth.uid()) or public.staff_can_view_student(p.student_id))));
create policy study_plan_items_write on public.study_plan_items for all to authenticated
  using (exists (select 1 from public.study_plans p where p.id = plan_id
                 and (public.staff_can_view_student(p.student_id) or (p.student_id = (select auth.uid()) and p.created_by = (select auth.uid())))))
  with check (exists (select 1 from public.study_plans p where p.id = plan_id
                 and (public.staff_can_view_student(p.student_id) or (p.student_id = (select auth.uid()) and p.created_by = (select auth.uid())))));

grant select, insert on public.practice_progress to authenticated;
create policy practice_progress_select on public.practice_progress for select to authenticated
  using (student_id = (select auth.uid()) or public.staff_can_view_student(student_id));
create policy practice_progress_insert on public.practice_progress for insert to authenticated
  with check (student_id = (select auth.uid()));

-- administración --------------------------------------------------------------------
grant select on public.audit_logs to authenticated;
create policy audit_logs_admin_select on public.audit_logs for select to authenticated using (public.is_admin());

grant select, insert, update on public.retention_policies, public.app_settings to authenticated;
create policy retention_select on public.retention_policies for select to authenticated using (public.is_admin());
create policy retention_write on public.retention_policies for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy app_settings_select on public.app_settings for select to authenticated using (public.is_staff());
create policy app_settings_write on public.app_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update (status) on public.ai_suggestions to authenticated;
create policy ai_suggestions_insert on public.ai_suggestions for insert to authenticated
  with check (public.staff_can_view_evaluation(evaluation_id) and created_by = (select auth.uid()) and status = 'pending');
create policy ai_suggestions_select on public.ai_suggestions for select to authenticated
  using (public.staff_can_view_evaluation(evaluation_id));
create policy ai_suggestions_update on public.ai_suggestions for update to authenticated
  using (public.staff_can_view_evaluation(evaluation_id)) with check (public.staff_can_view_evaluation(evaluation_id));

-- rate_limits: sin políticas → inaccesible salvo funciones de servidor
