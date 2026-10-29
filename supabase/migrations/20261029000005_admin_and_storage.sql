-- Funciones administrativas, invitaciones, validación/publicación de versiones, retención y Storage privado.

-- ¿La petición llega con la clave de servicio (scripts de servidor)?
create or replace function public.is_service_request()
returns boolean
language sql stable
as $$
  select coalesce(current_setting('role', true), '') = 'service_role'
      or coalesce((nullif(current_setting('request.jwt.claims', true), ''))::jsonb ->> 'role', '') = 'service_role'
$$;

create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Gestión de usuarios y roles (solo administrador; todo queda auditado)
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_role(p_user uuid, p_role public.app_role)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_old public.app_role;
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  select role into v_old from public.profiles where id = p_user for update;
  if not found then perform public._raise('user_not_found'); end if;
  if v_old = 'admin' and p_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
    perform public._raise('cannot_remove_last_admin');
  end if;
  update public.profiles set role = p_role, can_author = case when p_role = 'student' then false else can_author end
   where id = p_user;
  if p_role <> 'teacher' then
    delete from public.teacher_assignments where teacher_id = p_user;
  end if;
  if p_role <> 'student' then
    delete from public.class_members where student_id = p_user;
  end if;
  perform public.log_audit('role_changed', 'profile', p_user::text, jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

create or replace function public.admin_set_active(p_user uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  if p_user = auth.uid() and not p_active then perform public._raise('cannot_deactivate_self'); end if;
  update public.profiles set is_active = p_active where id = p_user;
  if not found then perform public._raise('user_not_found'); end if;
  perform public.log_audit(case when p_active then 'user_reactivated' else 'user_deactivated' end, 'profile', p_user::text, '{}'::jsonb);
end;
$$;

create or replace function public.admin_set_author(p_user uuid, p_can boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  update public.profiles set can_author = p_can where id = p_user and role = 'teacher';
  if not found then perform public._raise('teacher_not_found'); end if;
  perform public.log_audit('author_permission_changed', 'profile', p_user::text, jsonb_build_object('can_author', p_can));
end;
$$;

create or replace function public.admin_assign_teacher(p_class uuid, p_teacher uuid, p_grant boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  if p_grant then
    if not exists (select 1 from public.profiles where id = p_teacher and role = 'teacher' and is_active) then
      perform public._raise('teacher_not_found');
    end if;
    insert into public.teacher_assignments (class_id, teacher_id, granted_by) values (p_class, p_teacher, auth.uid())
    on conflict do nothing;
  else
    delete from public.teacher_assignments where class_id = p_class and teacher_id = p_teacher;
  end if;
  perform public.log_audit(case when p_grant then 'class_access_granted' else 'class_access_revoked' end,
                           'class', p_class::text, jsonb_build_object('teacher_id', p_teacher));
end;
$$;

create or replace function public.admin_set_class_member(p_class uuid, p_student uuid, p_member boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  if p_member then
    if not exists (select 1 from public.profiles where id = p_student and role = 'student') then
      perform public._raise('student_not_found');
    end if;
    insert into public.class_members (class_id, student_id) values (p_class, p_student) on conflict do nothing;
  else
    delete from public.class_members where class_id = p_class and student_id = p_student;
  end if;
  perform public.log_audit(case when p_member then 'class_member_added' else 'class_member_removed' end,
                           'class', p_class::text, jsonb_build_object('student_id', p_student));
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitaciones: el código en claro nunca se guarda; el servidor envía su SHA-256.
-- Canje solo con el rol de servicio (en el servidor, tras crear la cuenta).
-- ---------------------------------------------------------------------------
create or replace function public.check_invitation(p_code_hash text, p_email text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  select * into v_inv from public.invitations where code_hash = p_code_hash;
  if not found or v_inv.revoked_at is not null or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses then
    return jsonb_build_object('valid', false);
  end if;
  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(p_email, '')) then
    return jsonb_build_object('valid', false);
  end if;
  return jsonb_build_object('valid', true, 'role', v_inv.role,
    'class_name', (select name from public.classes where id = v_inv.class_id));
end;
$$;

create or replace function public.redeem_invitation(p_code_hash text, p_user uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invitations;
  v_email text;
begin
  select email into v_email from public.profiles where id = p_user;
  if not found then perform public._raise('user_not_found'); end if;
  select * into v_inv from public.invitations where code_hash = p_code_hash for update;
  if not found or v_inv.revoked_at is not null or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses then
    perform public._raise('invalid_invitation');
  end if;
  if v_inv.email is not null and lower(v_inv.email) <> lower(v_email) then
    perform public._raise('invalid_invitation');
  end if;

  update public.invitations set uses = uses + 1 where id = v_inv.id;
  insert into public.invitation_redemptions (invitation_id, user_id) values (v_inv.id, p_user);

  if v_inv.role = 'teacher' then
    update public.profiles set role = 'teacher' where id = p_user;
    if v_inv.class_id is not null then
      insert into public.teacher_assignments (class_id, teacher_id, granted_by) values (v_inv.class_id, p_user, v_inv.created_by)
      on conflict do nothing;
    end if;
  elsif v_inv.class_id is not null then
    insert into public.class_members (class_id, student_id) values (v_inv.class_id, p_user) on conflict do nothing;
  end if;

  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (p_user, 'invitation_redeemed', 'invitation', v_inv.id::text, jsonb_build_object('role', v_inv.role, 'class_id', v_inv.class_id));
  return jsonb_build_object('role', v_inv.role, 'class_id', v_inv.class_id);
end;
$$;

-- Unir a un estudiante ya registrado a otra clase con un código
create or replace function public.join_class_with_code(p_code_hash text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  if public.my_role() is distinct from 'student' then perform public._raise('only_students'); end if;
  select * into v_inv from public.invitations where code_hash = p_code_hash for update;
  if not found or v_inv.role <> 'student' or v_inv.class_id is null or v_inv.revoked_at is not null
     or v_inv.expires_at < now() or v_inv.uses >= v_inv.max_uses then
    perform public._raise('invalid_invitation');
  end if;
  if v_inv.email is not null and lower(v_inv.email) <> lower((select email from public.profiles where id = auth.uid())) then
    perform public._raise('invalid_invitation');
  end if;
  if exists (select 1 from public.invitation_redemptions where invitation_id = v_inv.id and user_id = auth.uid()) then
    return jsonb_build_object('class_id', v_inv.class_id, 'already_member', true);
  end if;
  update public.invitations set uses = uses + 1 where id = v_inv.id;
  insert into public.invitation_redemptions (invitation_id, user_id) values (v_inv.id, auth.uid());
  insert into public.class_members (class_id, student_id) values (v_inv.class_id, auth.uid()) on conflict do nothing;
  perform public.log_audit('class_joined_with_code', 'class', v_inv.class_id::text, '{}'::jsonb);
  return jsonb_build_object('class_id', v_inv.class_id);
end;
$$;

-- Primer administrador: solo desde el servidor/SQL y solo si todavía no existe ninguno
create or replace function public.bootstrap_first_admin(p_email text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    perform public._raise('admin_already_exists');
  end if;
  select id into v_id from public.profiles where lower(email) = lower(p_email);
  if v_id is null then perform public._raise('user_not_found'); end if;
  update public.profiles set role = 'admin', is_active = true where id = v_id;
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (null, 'first_admin_bootstrapped', 'profile', v_id::text, '{}'::jsonb);
  return v_id;
end;
$$;

-- Límite de frecuencia con ventana fija (inicio de sesión, registro, canje de códigos)
create or replace function public.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.rate_limits (bucket_key, window_start, hits) values (left(p_key, 200), v_window, 1)
  on conflict (bucket_key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_hits <= p_max;
end;
$$;

-- ---------------------------------------------------------------------------
-- Validación y ciclo de vida de versiones
-- ---------------------------------------------------------------------------
create or replace function public.validate_exam_version(p_version uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_issues jsonb := '[]'::jsonb;
  r record;
  v_items integer;
begin
  if not (public.is_staff() or public.is_service_request()) then perform public._raise('forbidden'); end if;

  if not exists (select 1 from public.exam_sections where version_id = p_version) then
    v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'no_sections', 'message', 'La versión no tiene pruebas.');
  end if;

  for r in select s.* from public.exam_sections s where s.version_id = p_version loop
    if not exists (select 1 from public.tasks t where t.section_id = r.id) then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'section_without_tasks', 'section_id', r.id,
                                                 'message', format('La prueba «%s» no tiene tareas.', r.title));
    end if;
    if exists (select 1 from public.exam_sections s2 where s2.version_id = p_version and s2.skill = r.skill and s2.id <> r.id) then
      v_issues := v_issues || jsonb_build_object('severity', 'warning', 'code', 'duplicate_skill', 'section_id', r.id,
                                                 'message', format('Hay más de una prueba de la misma destreza (%s).', r.skill));
    end if;
  end loop;

  for r in
    select t.*, s.skill, s.title as section_title
    from public.tasks t join public.exam_sections s on s.id = t.section_id
    where s.version_id = p_version
  loop
    if btrim(r.instructions) = '' then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'task_without_instructions', 'task_id', r.id,
                                                 'message', format('%s · %s: faltan las instrucciones.', r.section_title, r.title));
    end if;

    -- coherencia destreza ↔ tipo de interacción
    if (r.skill in ('reading', 'listening') and r.interaction_type in ('writing', 'speaking'))
       or (r.skill = 'writing' and r.interaction_type <> 'writing')
       or (r.skill = 'speaking' and r.interaction_type <> 'speaking') then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'interaction_skill_mismatch', 'task_id', r.id,
                                                 'message', format('%s · %s: el tipo de tarea no corresponde a la prueba.', r.section_title, r.title));
    end if;

    if r.interaction_type in ('writing', 'speaking') then
      if r.rubric_version_id is null and public._default_rubric(r.skill) is null then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'missing_rubric', 'task_id', r.id,
                                                   'message', format('%s · %s: no hay rúbrica publicada para evaluar la tarea.', r.section_title, r.title));
      end if;
    else
      select coalesce(sum(case when r.interaction_type = 'multi_select' then cardinality(k.correct_option_ids) else 1 end), 0)
        into v_items
        from public.questions q left join public.question_keys k on k.question_id = q.id
       where q.task_id = r.id;
      if v_items <> r.declared_items then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'item_count_mismatch', 'task_id', r.id,
                                                   'message', format('%s · %s: declara %s ítems pero tiene %s.', r.section_title, r.title, r.declared_items, v_items));
      end if;
      if exists (select 1 from public.questions q where q.task_id = r.id
                 and not exists (select 1 from public.question_keys k where k.question_id = q.id)) then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'question_without_key', 'task_id', r.id,
                                                   'message', format('%s · %s: hay preguntas sin respuesta correcta.', r.section_title, r.title));
      end if;
      -- las claves deben apuntar a opciones válidas (propias o del banco común)
      if exists (
        select 1 from public.questions q join public.question_keys k on k.question_id = q.id, unnest(k.correct_option_ids) cid
        where q.task_id = r.id and not exists (
          select 1 from public.question_options o where o.id = cid and o.task_id = r.id
            and ((r.interaction_type in ('single_choice', 'dropdown_gap') and o.question_id = q.id)
              or (r.interaction_type in ('matching', 'fragment_gap', 'multi_select') and o.question_id is null))))
      then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'invalid_key_option', 'task_id', r.id,
                                                   'message', format('%s · %s: una clave apunta a una opción que no pertenece a la pregunta.', r.section_title, r.title));
      end if;
      if r.interaction_type in ('single_choice', 'dropdown_gap') and exists (
        select 1 from public.questions q where q.task_id = r.id
        and (select count(*) from public.question_options o where o.question_id = q.id) < 2) then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'too_few_options', 'task_id', r.id,
                                                   'message', format('%s · %s: cada pregunta necesita al menos dos opciones.', r.section_title, r.title));
      end if;
      if r.interaction_type in ('matching', 'fragment_gap', 'multi_select')
         and (select count(*) from public.question_options o where o.task_id = r.id and o.question_id is null) < 2 then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'bank_too_small', 'task_id', r.id,
                                                   'message', format('%s · %s: el banco común necesita al menos dos opciones.', r.section_title, r.title));
      end if;
      if exists (
        select 1 from public.question_options o where o.task_id = r.id
        group by coalesce(o.question_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(o.body)) having count(*) > 1) then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'duplicate_options', 'task_id', r.id,
                                                   'message', format('%s · %s: hay alternativas duplicadas.', r.section_title, r.title));
      end if;
      if r.interaction_type in ('single_choice', 'dropdown_gap', 'matching', 'fragment_gap') and exists (
        select 1 from public.question_keys k join public.questions q on q.id = k.question_id
        where q.task_id = r.id and cardinality(k.correct_option_ids) <> 1) then
        v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'single_key_expected', 'task_id', r.id,
                                                   'message', format('%s · %s: cada pregunta de respuesta única debe tener exactamente una clave.', r.section_title, r.title));
      end if;
    end if;

    if r.skill = 'listening' and not exists (
      select 1 from jsonb_each(coalesce(r.content -> 'media', '{}'::jsonb)) m where m.value ->> 'kind' = 'audio') then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'listening_without_audio', 'task_id', r.id,
                                                 'message', format('%s · %s: la tarea de comprensión auditiva no tiene audio.', r.section_title, r.title));
    end if;

    -- recursos multimedia referenciados
    if exists (
      select 1 from jsonb_each(coalesce(r.content -> 'media', '{}'::jsonb)) m
      where public.try_uuid(m.value ->> 'asset_id') is null
         or not exists (select 1 from public.media_assets a where a.id = public.try_uuid(m.value ->> 'asset_id')
                        and a.kind = m.value ->> 'kind')) then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'missing_media', 'task_id', r.id,
                                                 'message', format('%s · %s: un recurso de audio o imagen no existe.', r.section_title, r.title));
    end if;
    if exists (
      select 1 from jsonb_each(coalesce(r.content -> 'media', '{}'::jsonb)) m
      join public.media_assets a on a.id = public.try_uuid(m.value ->> 'asset_id')
      where a.check_status = 'failed') then
      v_issues := v_issues || jsonb_build_object('severity', 'error', 'code', 'broken_media', 'task_id', r.id,
                                                 'message', format('%s · %s: un recurso multimedia no se pudo reproducir o cargar.', r.section_title, r.title));
    end if;
  end loop;

  return v_issues;
end;
$$;

create or replace function public.publish_exam_version(p_version uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_issues jsonb;
begin
  if not (public.can_author() or public.is_service_request()) then perform public._raise('forbidden'); end if;
  if not exists (select 1 from public.exam_versions where id = p_version and status = 'draft') then
    perform public._raise('version_not_draft');
  end if;
  v_issues := public.validate_exam_version(p_version);
  if exists (select 1 from jsonb_array_elements(v_issues) i where i ->> 'severity' = 'error') then
    return jsonb_build_object('status', 'invalid', 'issues', v_issues);
  end if;
  update public.tasks t set content_status = 'published', reviewed_at = coalesce(reviewed_at, now())
    from public.exam_sections s where s.id = t.section_id and s.version_id = p_version;
  update public.exam_versions set status = 'published', published_at = now(), published_by = auth.uid() where id = p_version;
  perform public.log_audit('exam_version_published', 'exam_version', p_version::text, jsonb_build_object('warnings', v_issues));
  return jsonb_build_object('status', 'published', 'issues', v_issues);
end;
$$;

create or replace function public.archive_exam_version(p_version uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.can_author() then perform public._raise('forbidden'); end if;
  update public.exam_versions set status = 'archived' where id = p_version and status in ('published', 'draft');
  if not found then perform public._raise('version_not_found'); end if;
  update public.exam_assignments set archived_at = coalesce(archived_at, now()) where version_id = p_version;
  perform public.log_audit('exam_version_archived', 'exam_version', p_version::text, '{}'::jsonb);
end;
$$;

-- Copia profunda de una versión a un nuevo borrador (las versiones publicadas no se editan)
create or replace function public.duplicate_exam_version(p_version uuid, p_template uuid default null)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_src public.exam_versions;
  v_template uuid;
  v_new uuid;
  s record;
  t record;
  q record;
  v_new_section uuid;
  v_new_task uuid;
  v_new_question uuid;
begin
  if not public.can_author() then perform public._raise('forbidden'); end if;
  select * into v_src from public.exam_versions where id = p_version;
  if not found then perform public._raise('version_not_found'); end if;
  v_template := coalesce(p_template, v_src.template_id);

  insert into public.exam_versions (template_id, version_no, status, format_label, format_source_id, notes, created_by)
  values (v_template, coalesce((select max(version_no) from public.exam_versions where template_id = v_template), 0) + 1,
          'draft', v_src.format_label, v_src.format_source_id, v_src.notes, auth.uid())
  returning id into v_new;

  create temporary table if not exists _opt_map (old_id uuid primary key, new_id uuid not null) on commit drop;
  delete from _opt_map;

  for s in select * from public.exam_sections where version_id = p_version order by position loop
    insert into public.exam_sections (version_id, skill, position, title, instructions, time_limit_seconds, allow_back, pause_after_seconds)
    values (v_new, s.skill, s.position, s.title, s.instructions, s.time_limit_seconds, s.allow_back, s.pause_after_seconds)
    returning id into v_new_section;

    for t in select * from public.tasks where section_id = s.id order by position loop
      insert into public.tasks (section_id, position, code, title, interaction_type, level_label, instructions, content,
                                declared_items, suggested_seconds, max_audio_plays, rubric_version_id, skill_focus,
                                lexical_topic, grammar_topic, difficulty, source_ref, content_status, content_version)
      values (v_new_section, t.position, t.code, t.title, t.interaction_type, t.level_label, t.instructions, t.content,
              t.declared_items, t.suggested_seconds, t.max_audio_plays, t.rubric_version_id, t.skill_focus,
              t.lexical_topic, t.grammar_topic, t.difficulty, t.source_ref, 'draft', t.content_version + 1)
      returning id into v_new_task;

      insert into public.task_private (task_id, transcript, teacher_notes)
      select v_new_task, transcript, teacher_notes from public.task_private where task_id = t.id;

      -- banco común
      with ins as (
        insert into public.question_options (task_id, question_id, position, label, body)
        select v_new_task, null, o.position, o.label, o.body from public.question_options o
        where o.task_id = t.id and o.question_id is null order by o.position
        returning id, position
      )
      insert into _opt_map (old_id, new_id)
      select o.id, ins.id from public.question_options o join ins on ins.position = o.position
      where o.task_id = t.id and o.question_id is null;

      for q in select * from public.questions where task_id = t.id order by position loop
        insert into public.questions (task_id, position, prompt, points, level, focus, max_selections)
        values (v_new_task, q.position, q.prompt, q.points, q.level, q.focus, q.max_selections)
        returning id into v_new_question;

        with ins as (
          insert into public.question_options (task_id, question_id, position, label, body)
          select v_new_task, v_new_question, o.position, o.label, o.body from public.question_options o
          where o.question_id = q.id order by o.position
          returning id, position
        )
        insert into _opt_map (old_id, new_id)
        select o.id, ins.id from public.question_options o join ins on ins.position = o.position
        where o.question_id = q.id;

        insert into public.question_keys (question_id, correct_option_ids, explanation)
        select v_new_question, array(select m.new_id from unnest(k.correct_option_ids) c join _opt_map m on m.old_id = c), k.explanation
        from public.question_keys k where k.question_id = q.id;
      end loop;
    end loop;
  end loop;

  perform public.log_audit('exam_version_duplicated', 'exam_version', v_new::text, jsonb_build_object('from', p_version));
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retención de datos y estado de la aplicación
-- ---------------------------------------------------------------------------
create or replace function public.apply_retention()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_days integer;
  v_events integer := 0;
  v_revisions integer := 0;
  v_audit integer := 0;
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;

  select retain_days into v_days from public.retention_policies where entity = 'attempt_events';
  if v_days is not null then
    delete from public.attempt_events where created_at < now() - make_interval(days => v_days);
    get diagnostics v_events = row_count;
  end if;
  select retain_days into v_days from public.retention_policies where entity = 'response_revisions';
  if v_days is not null then
    delete from public.response_revisions where saved_at < now() - make_interval(days => v_days) and kind = 'autosave';
    get diagnostics v_revisions = row_count;
  end if;
  select retain_days into v_days from public.retention_policies where entity = 'audit_logs';
  if v_days is not null then
    delete from public.audit_logs where created_at < now() - make_interval(days => v_days);
    get diagnostics v_audit = row_count;
  end if;

  perform public.log_audit('retention_applied', 'retention', null,
    jsonb_build_object('attempt_events', v_events, 'response_revisions', v_revisions, 'audit_logs', v_audit));
  return jsonb_build_object('attempt_events', v_events, 'response_revisions', v_revisions, 'audit_logs', v_audit);
end;
$$;

-- Grabaciones fuera del periodo de conservación (el servidor borra el archivo y luego la fila)
create or replace function public.recordings_past_retention()
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = public
as $$
  select r.id, r.storage_path from public.oral_recordings r
  join public.retention_policies p on p.entity = 'oral_recordings'
  join public.attempts a on a.id = r.attempt_id
  where public.is_admin() and r.created_at < now() - make_interval(days => p.retain_days)
    and a.status in ('published', 'annulled', 'expired')
$$;

create or replace function public.purge_recording_rows(p_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  delete from public.oral_recordings where id = any (p_ids);
  get diagnostics n = row_count;
  perform public.log_audit('recordings_purged', 'oral_recordings', null, jsonb_build_object('count', n));
  return n;
end;
$$;

create or replace function public.app_status()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then perform public._raise('forbidden'); end if;
  return jsonb_build_object(
    'users', (select jsonb_object_agg(role, n) from (select role, count(*) n from public.profiles group by role) x),
    'inactive_users', (select count(*) from public.profiles where not is_active),
    'classes', (select count(*) from public.classes where archived_at is null),
    'published_versions', (select count(*) from public.exam_versions where status = 'published'),
    'draft_versions', (select count(*) from public.exam_versions where status = 'draft'),
    'attempts_in_progress', (select count(*) from public.attempts where status = 'in_progress'),
    'attempts_pending_grading', (select count(*) from public.attempts where status in ('submitted', 'resubmission_requested')),
    'draft_evaluations', (select count(*) from public.evaluations where status = 'draft'),
    'recordings', (select count(*) from public.oral_recordings),
    'unverified_recordings', (select count(*) from public.oral_recordings where status <> 'verified'),
    'active_invitations', (select count(*) from public.invitations where revoked_at is null and expires_at > now() and uses < max_uses),
    'pending_rule_verifications', (select count(*) from public.rule_sources where verification in ('pending', 'contradictory')),
    'db_time', now()
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Auditoría automática de cambios administrativos sensibles
-- ---------------------------------------------------------------------------
create or replace function public.audit_row_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id text := coalesce(v_row ->> 'id', v_row ->> 'key', v_row ->> 'entity', v_row ->> 'rule_key');
begin
  insert into public.audit_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), tg_table_name || '.' || lower(tg_op), tg_table_name, v_id,
          (v_row - 'code_hash' - 'criteria' - 'points_table' - 'transcript') ||
          case when tg_op = 'UPDATE' then jsonb_build_object('changed_from', (to_jsonb(old) - 'code_hash' - 'criteria' - 'points_table' - 'transcript')) else '{}'::jsonb end);
  return null;
end;
$$;

create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function public.audit_row_change();
create trigger audit_classes after insert or update or delete on public.classes
  for each row execute function public.audit_row_change();
create trigger audit_rubric_versions after insert or update on public.rubric_versions
  for each row execute function public.audit_row_change();
create trigger audit_rule_sources after update on public.rule_sources
  for each row execute function public.audit_row_change();
create trigger audit_app_settings after insert or update on public.app_settings
  for each row execute function public.audit_row_change();
create trigger audit_retention after insert or update on public.retention_policies
  for each row execute function public.audit_row_change();
create trigger audit_assignments after insert or update on public.exam_assignments
  for each row execute function public.audit_row_change();
create trigger audit_media after insert or delete on public.media_assets
  for each row execute function public.audit_row_change();
create trigger audit_templates after insert or update or delete on public.exam_templates
  for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------
-- Storage privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('recordings', 'recordings', false, 52428800,
   array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/aac']),
  ('exam-media', 'exam-media', false, 26214400,
   array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/webm', 'audio/wav', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- recordings/{uid}/{attempt}/{task}/{parte}-{segmento}[-{marca}].{ext}
create policy recordings_student_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.my_role() = 'student'
    and exists (
      select 1 from public.attempts a
      where a.id = public.try_uuid((storage.foldername(name))[2])
        and a.student_id = (select auth.uid())
        and a.status in ('in_progress', 'resubmission_requested')
    )
  );
create policy recordings_select on storage.objects for select to authenticated
  using (
    bucket_id = 'recordings'
    and ((storage.foldername(name))[1] = (select auth.uid())::text
         or public.staff_can_view_student(public.try_uuid((storage.foldername(name))[1])))
  );

create policy exam_media_author_select on storage.objects for select to authenticated
  using (bucket_id = 'exam-media' and public.is_staff());
create policy exam_media_author_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'exam-media' and public.can_author());
create policy exam_media_author_update on storage.objects for update to authenticated
  using (bucket_id = 'exam-media' and public.can_author()) with check (bucket_id = 'exam-media' and public.can_author());
create policy exam_media_author_delete on storage.objects for delete to authenticated
  using (bucket_id = 'exam-media' and public.can_author());

-- ---------------------------------------------------------------------------
-- Permisos de ejecución: nada por defecto, se concede función a función
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function
  public.my_role(), public.is_admin(), public.is_staff(), public.can_author(), public.teaches_class(uuid),
  public.staff_can_view_student(uuid), public.can_view_student(uuid), public.staff_can_view_attempt(uuid),
  public.staff_can_view_evaluation(uuid), public.student_in_class(uuid), public.count_words(text), public.try_uuid(text)
to authenticated;

-- RPC del estudiante
grant execute on function
  public.start_attempt(uuid), public.get_attempt_state(uuid), public.get_attempt_task(uuid, uuid),
  public.start_section(uuid, uuid), public.set_task_position(uuid, uuid, integer), public.complete_section(uuid, uuid),
  public.save_response(uuid, uuid, text, jsonb), public.register_audio_play(uuid, uuid, text),
  public.authorize_task_images(uuid, uuid),
  public.register_recording(uuid, uuid, text, text, text, text, bigint, integer, text),
  public.log_client_event(uuid, text, jsonb), public.submit_attempt(uuid, boolean),
  public.check_practice_task(uuid, uuid), public.submit_resubmission(uuid, uuid),
  public.toggle_plan_item(uuid, boolean), public.join_class_with_code(text)
to authenticated;

-- RPC del personal docente
grant execute on function
  public.sweep_expired_attempts(),
  public.save_evaluation(uuid, uuid, jsonb, text, text, text, text), public.publish_attempt_results(uuid),
  public.request_resubmission(uuid, uuid, text), public.set_attempt_lock(uuid, boolean),
  public.annul_attempt(uuid, text), public.save_recording_transcript(uuid, text),
  public.validate_exam_version(uuid), public.publish_exam_version(uuid), public.archive_exam_version(uuid),
  public.duplicate_exam_version(uuid, uuid)
to authenticated;

-- RPC del administrador (cada función comprueba is_admin())
grant execute on function
  public.admin_set_role(uuid, public.app_role), public.admin_set_active(uuid, boolean),
  public.admin_set_author(uuid, boolean), public.admin_assign_teacher(uuid, uuid, boolean),
  public.admin_set_class_member(uuid, uuid, boolean), public.apply_retention(),
  public.recordings_past_retention(), public.purge_recording_rows(uuid[]), public.app_status()
to authenticated;

-- Solo servidor (clave de servicio): nunca accesibles desde el navegador
grant execute on function
  public.check_invitation(text, text), public.redeem_invitation(text, uuid),
  public.bootstrap_first_admin(text), public.check_rate_limit(text, integer, integer)
to service_role;
