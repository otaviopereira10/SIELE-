-- Integridad de las grabaciones, cierre de pruebas al agotarse el tiempo y nueva grabación a petición de la profesora.

-- ---------------------------------------------------------------------------
-- Margen de 60 s tras la hora límite: da tiempo a que termine de subirse la grabación en curso.
-- La interfaz deja de admitir cambios al llegar a cero; el margen solo cubre lo que ya estaba en camino.
-- ---------------------------------------------------------------------------
alter table public.exam_assignments alter column grace_seconds set default 60;
update public.exam_assignments set grace_seconds = 60 where grace_seconds = 5;

-- ---------------------------------------------------------------------------
-- Una grabación sin audio (micrófono que no entrega sonido) no se da por entregada
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
  -- por debajo de este tamaño el archivo solo tiene cabeceras: no contiene audio
  if coalesce(p_size, 0) < 512 then perform public._raise('recording_empty'); end if;

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
-- El cliente cierra la prueba al agotarse el tiempo (tras subir lo pendiente); queda como tiempo agotado
-- ---------------------------------------------------------------------------
create or replace function public.complete_section(p_attempt uuid, p_section uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_ats public.attempt_sections;
  v_pause integer;
  v_next uuid;
  v_expired boolean;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'in_progress' then perform public._raise('attempt_closed'); end if;
  select * into v_ats from public.attempt_sections where attempt_id = p_attempt and section_id = p_section for update;
  if not found then perform public._raise('section_not_in_attempt'); end if;
  if v_ats.status in ('completed', 'timed_out') then
    return jsonb_build_object('status', v_ats.status);
  end if;
  if v_ats.status <> 'active' then perform public._raise('section_not_active'); end if;

  v_expired := v_ats.deadline_at is not null and v_ats.deadline_at < now();
  update public.attempt_sections
     set status = case when v_expired then 'timed_out'::public.section_status else 'completed'::public.section_status end,
         completed_at = case when v_expired then v_ats.deadline_at else now() end
   where attempt_id = p_attempt and section_id = p_section;
  perform public._log_attempt_event(p_attempt, case when v_expired then 'section_timed_out' else 'section_completed' end,
                                    jsonb_build_object('section_id', p_section));

  select pause_after_seconds into v_pause from public.exam_sections where id = p_section;
  select section_id into v_next from public.attempt_sections
   where attempt_id = p_attempt and position > v_ats.position and status = 'locked'
   order by position limit 1;
  if v_next is not null then
    update public.attempt_sections set status = 'ready', available_at = now() + make_interval(secs => v_pause)
     where attempt_id = p_attempt and section_id = v_next;
  end if;
  return jsonb_build_object('status', case when v_expired then 'timed_out' else 'completed' end,
                            'next_section_id', v_next, 'pause_seconds', case when v_next is null then 0 else v_pause end);
end;
$$;

-- ---------------------------------------------------------------------------
-- Nueva entrega: también para las tareas orales (grabaciones vacías o no realizadas)
-- ---------------------------------------------------------------------------
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
  if v_skill is null or v_skill not in ('writing', 'speaking') then perform public._raise('resubmission_only_for_productive'); end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 3 then perform public._raise('reason_required'); end if;

  insert into public.resubmissions (attempt_id, task_id, reason, requested_by)
  values (p_attempt, p_task, btrim(p_reason), auth.uid())
  on conflict (attempt_id, task_id) where status = 'open' do update set reason = excluded.reason;

  if v_skill = 'speaking' then
    -- se repiten las grabaciones vacías; si no hay ninguna vacía, la tarea entera
    update public.oral_recordings r
       set status = 'failed'
     where r.attempt_id = p_attempt and r.task_id = p_task
       and (r.size_bytes < 512 or not exists (
             select 1 from public.oral_recordings x
              where x.attempt_id = p_attempt and x.task_id = p_task and x.size_bytes < 512));
    -- los enunciados orales se pueden volver a escuchar
    delete from public.audio_plays where attempt_id = p_attempt and task_id = p_task;
  end if;

  update public.attempts set status = 'resubmission_requested' where id = p_attempt;
  update public.evaluations set status = 'draft' where attempt_id = p_attempt and task_id = p_task;
  perform public.log_audit('resubmission_requested', 'attempt', p_attempt::text, jsonb_build_object('task_id', p_task));
  return jsonb_build_object('status', 'resubmission_requested');
end;
$$;

create or replace function public.submit_resubmission(p_attempt uuid, p_task uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_attempt public.attempts;
  v_type public.interaction_type;
begin
  v_attempt := public._own_attempt(p_attempt);
  if v_attempt.status <> 'resubmission_requested' then perform public._raise('no_open_resubmission'); end if;
  select interaction_type into v_type from public.tasks where id = p_task;
  if v_type = 'speaking' and (
       exists (select 1 from public.oral_recordings r where r.attempt_id = p_attempt and r.task_id = p_task and r.status <> 'verified')
       or not exists (select 1 from public.oral_recordings r where r.attempt_id = p_attempt and r.task_id = p_task and r.status = 'verified')) then
    perform public._raise('recording_required');
  end if;

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

-- ---------------------------------------------------------------------------
-- Eventos del cliente: también los avisos de micrófono sin sonido, útiles para la profesora
-- ---------------------------------------------------------------------------
create or replace function public.log_client_event(p_attempt uuid, p_type text, p_details jsonb default '{}'::jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.attempts where id = p_attempt and student_id = auth.uid()) then
    perform public._raise('attempt_not_found');
  end if;
  if p_type is null or p_type not in ('visibility_hidden', 'visibility_visible', 'connection_lost', 'connection_restored', 'mic_check_ok', 'mic_check_failed', 'audio_check_ok', 'fullscreen_exit', 'recording_empty', 'recording_silent') then
    perform public._raise('invalid_event_type');
  end if;
  if octet_length(coalesce(p_details, '{}'::jsonb)::text) > 2000 then
    perform public._raise('event_too_large');
  end if;
  perform public._log_attempt_event(p_attempt, p_type, coalesce(p_details, '{}'::jsonb));
end;
$$;
