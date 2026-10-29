-- SIELE Trainer Pro — esquema principal
-- Producto independiente de preparación. No está afiliado ni respaldado por SIELE.
-- Todas las tablas usan RLS (ver migración 0003). Las escrituras sensibles pasan por funciones
-- SECURITY DEFINER que validan permisos, estado del intento y tiempos en el servidor.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('student', 'teacher', 'admin');
create type public.exam_skill as enum ('reading', 'listening', 'writing', 'speaking');
create type public.cefr_level as enum ('pre_A1', 'A1', 'A2', 'B1', 'B2', 'C1');
create type public.content_status as enum ('draft', 'reviewed', 'published', 'archived');
create type public.interaction_type as enum (
  'single_choice',   -- preguntas con opciones propias (lectura/auditiva)
  'matching',        -- asociación con un banco común de opciones (textos, personas, enunciados)
  'dropdown_gap',    -- huecos en un texto, cada uno con su lista desplegable
  'fragment_gap',    -- huecos en un texto completados con un banco común de fragmentos
  'multi_select',    -- seleccionar N enunciados verdaderos de un banco
  'writing',         -- producción escrita
  'speaking'         -- producción oral grabada
);
create type public.attempt_mode as enum ('practice', 'formal');
create type public.attempt_status as enum (
  'in_progress', 'submitted', 'published', 'resubmission_requested', 'expired', 'annulled'
);
create type public.section_status as enum ('locked', 'ready', 'active', 'completed', 'timed_out');
create type public.evaluation_status as enum ('draft', 'published');
create type public.recording_status as enum ('pending', 'verified', 'failed');
create type public.verification_status as enum ('verified', 'verified_older_edition', 'pending', 'contradictory');

-- ---------------------------------------------------------------------------
-- Usuarios, clases y permisos
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.app_role not null default 'student',
  is_active boolean not null default true,
  can_author boolean not null default false, -- profesoras autorizadas a editar el banco de simulacros
  target_level public.cefr_level,
  target_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '',
  target_level public.cefr_level,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.class_members (
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, student_id)
);
create index class_members_student_idx on public.class_members (student_id);

create table public.teacher_assignments (
  class_id uuid not null references public.classes (id) on delete cascade,
  teacher_id uuid not null references public.profiles (id) on delete cascade,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (class_id, teacher_id)
);
create index teacher_assignments_teacher_idx on public.teacher_assignments (teacher_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique check (char_length(code_hash) = 64),
  code_hint text not null default '' check (char_length(code_hint) <= 8),
  role public.app_role not null default 'student' check (role in ('student', 'teacher')),
  class_id uuid references public.classes (id) on delete cascade,
  email text check (email is null or position('@' in email) > 1),
  max_uses integer not null default 1 check (max_uses between 1 and 500),
  uses integer not null default 0 check (uses >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  note text not null default '',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (uses <= max_uses)
);

create table public.invitation_redemptions (
  invitation_id uuid not null references public.invitations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invitation_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Fuentes y metodología
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  url text not null,
  edition text not null default '',
  consulted_at date not null,
  notes text not null default ''
);

create table public.rule_sources (
  rule_key text primary key,
  area text not null,
  description text not null,
  value text not null,
  source_id uuid references public.sources (id) on delete set null,
  verification public.verification_status not null default 'pending',
  verified_at date,
  notes text not null default ''
);

-- ---------------------------------------------------------------------------
-- Rúbricas y tablas de puntuación
-- ---------------------------------------------------------------------------
create table public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version_no integer not null default 1,
  skill public.exam_skill not null check (skill in ('writing', 'speaking')),
  title text not null,
  -- [{key,label,weight,description,focus[],bands:[{band,descriptor}]}]
  criteria jsonb not null,
  -- {"1": {"cohesion": [p0..p5], ...}, "2": {...}} — puntos por banda según posición de la tarea
  -- "*" se aplica a cualquier tarea sin tabla propia.
  points_table jsonb not null,
  source_id uuid references public.sources (id) on delete set null,
  verification public.verification_status not null default 'pending',
  status public.content_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (code, version_no),
  check (jsonb_typeof(criteria) = 'array' and jsonb_array_length(criteria) > 0),
  check (jsonb_typeof(points_table) = 'object')
);

create table public.scoring_tables (
  id uuid primary key default gen_random_uuid(),
  skill public.exam_skill not null,
  kind text not null check (kind in ('raw_to_level', 'points_to_level')),
  -- [{level, min_raw?, max_raw?, min_points, max_points}]
  bands jsonb not null,
  max_raw integer,
  max_points numeric not null default 250,
  source_id uuid references public.sources (id) on delete set null,
  verification public.verification_status not null default 'pending',
  is_active boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create unique index scoring_tables_active_idx on public.scoring_tables (skill) where is_active;

-- ---------------------------------------------------------------------------
-- Banco de simulacros (plantilla → versión → prueba → tarea → pregunta)
-- ---------------------------------------------------------------------------
create table public.exam_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{2,40}$'),
  title text not null,
  description text not null default '',
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.exam_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.exam_templates (id) on delete cascade,
  version_no integer not null,
  status public.content_status not null default 'draft',
  format_label text not null default 'SIELE Global — formato público de referencia',
  format_source_id uuid references public.sources (id) on delete set null,
  notes text not null default '',
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_no)
);

create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.exam_versions (id) on delete cascade,
  skill public.exam_skill not null,
  position smallint not null check (position between 1 and 8),
  title text not null,
  instructions text not null default '',
  time_limit_seconds integer not null check (time_limit_seconds between 60 and 14400),
  allow_back boolean not null default true,
  pause_after_seconds integer not null default 0 check (pause_after_seconds between 0 and 3600),
  unique (version_id, position)
);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'exam-media' check (bucket = 'exam-media'),
  path text not null unique,
  kind text not null check (kind in ('audio', 'image')),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  duration_seconds numeric,
  is_synthetic_voice boolean not null default false,
  alt_text text not null default '',
  transcript text not null default '', -- privado: solo personal docente
  source text not null default 'Material original de SIELE Trainer Pro',
  check_status text not null default 'unchecked' check (check_status in ('unchecked', 'ok', 'failed')),
  checked_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.exam_sections (id) on delete cascade,
  position smallint not null check (position between 1 and 12),
  code text not null check (char_length(code) between 3 and 40),
  title text not null,
  interaction_type public.interaction_type not null,
  level_label text not null default '',
  instructions text not null default '',
  -- contenido público (textos, estímulos, partes orales…), validado con Zod en el servidor
  content jsonb not null default '{}'::jsonb,
  declared_items integer not null default 0 check (declared_items >= 0),
  suggested_seconds integer check (suggested_seconds is null or suggested_seconds > 0),
  max_audio_plays smallint not null default 2 check (max_audio_plays between 0 and 10),
  rubric_version_id uuid references public.rubric_versions (id) on delete restrict,
  skill_focus text[] not null default '{}',
  lexical_topic text not null default '',
  grammar_topic text not null default '',
  difficulty smallint not null default 3 check (difficulty between 1 and 5),
  source_ref text not null default 'Material original',
  content_status public.content_status not null default 'draft',
  content_version integer not null default 1,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (section_id, position),
  unique (section_id, code)
);

-- notas y transcripciones privadas de la tarea: nunca visibles para estudiantes
create table public.task_private (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  transcript text not null default '',
  teacher_notes text not null default ''
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  position smallint not null check (position between 1 and 60),
  prompt text not null default '',
  points numeric not null default 1 check (points > 0 and points <= 20),
  level public.cefr_level,
  focus text not null default '' check (focus in ('', 'global', 'specific', 'detail', 'inference', 'intention', 'grammar', 'lexis', 'connector')),
  max_selections smallint not null default 1 check (max_selections between 1 and 12),
  unique (task_id, position)
);

-- opciones: question_id nulo = banco común de la tarea (asociación, fragmentos, multi_select)
create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  question_id uuid references public.questions (id) on delete cascade,
  position smallint not null check (position between 1 and 30),
  label text not null default '' check (char_length(label) <= 12),
  body text not null check (char_length(body) between 1 and 2000)
);
create unique index question_options_pos_idx
  on public.question_options (task_id, coalesce(question_id, '00000000-0000-0000-0000-000000000000'::uuid), position);

-- clave privada de respuestas
create table public.question_keys (
  question_id uuid primary key references public.questions (id) on delete cascade,
  correct_option_ids uuid[] not null check (cardinality(correct_option_ids) >= 1),
  explanation text not null default ''
);

-- ---------------------------------------------------------------------------
-- Asignaciones e intentos
-- ---------------------------------------------------------------------------
create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.exam_versions (id) on delete restrict,
  title text not null,
  class_id uuid references public.classes (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  mode public.attempt_mode not null default 'practice',
  -- secciones incluidas (vacío = todas). Permite asignar solo una prueba concreta.
  section_ids uuid[] not null default '{}',
  opens_at timestamptz not null default now(),
  closes_at timestamptz,
  max_attempts smallint not null default 1 check (max_attempts between 1 and 20),
  immediate_feedback boolean not null default false,
  resume_policy text not null default 'allow' check (resume_policy in ('allow', 'teacher_unlock')),
  grace_seconds smallint not null default 5 check (grace_seconds between 0 and 60),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  check (class_id is not null or student_id is not null),
  check (closes_at is null or closes_at > opens_at),
  check (mode = 'practice' or immediate_feedback = false)
);
create index exam_assignments_class_idx on public.exam_assignments (class_id);
create index exam_assignments_student_idx on public.exam_assignments (student_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.exam_assignments (id) on delete restrict,
  version_id uuid not null references public.exam_versions (id) on delete restrict,
  student_id uuid not null references public.profiles (id) on delete cascade,
  mode public.attempt_mode not null,
  status public.attempt_status not null default 'in_progress',
  locked_by_teacher boolean not null default false,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create index attempts_student_idx on public.attempts (student_id, created_at desc);
create index attempts_assignment_idx on public.attempts (assignment_id);
create index attempts_status_idx on public.attempts (status);

create table public.attempt_sections (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  section_id uuid not null references public.exam_sections (id) on delete restrict,
  position smallint not null,
  status public.section_status not null default 'locked',
  available_at timestamptz,
  started_at timestamptz,
  deadline_at timestamptz,
  completed_at timestamptz,
  current_task_position smallint not null default 1,
  max_task_position smallint not null default 1,
  primary key (attempt_id, section_id),
  unique (attempt_id, position)
);

create table public.task_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  item_key text not null check (char_length(item_key) between 1 and 80),
  question_id uuid references public.questions (id) on delete restrict,
  payload jsonb not null,
  word_count integer not null default 0,
  revision integer not null default 1,
  auto_points numeric,
  auto_max numeric,
  is_correct boolean,
  first_saved_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, task_id, item_key)
);
create index task_responses_attempt_idx on public.task_responses (attempt_id);

create table public.response_revisions (
  id bigint generated always as identity primary key,
  response_id uuid not null references public.task_responses (id) on delete cascade,
  payload jsonb not null,
  word_count integer not null default 0,
  kind text not null default 'autosave' check (kind in ('autosave', 'final', 'resubmission')),
  saved_at timestamptz not null default now()
);
create index response_revisions_response_idx on public.response_revisions (response_id, saved_at);

create table public.oral_recordings (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  part_key text not null check (part_key ~ '^[a-z0-9_-]{1,30}$'),
  segment_key text not null check (segment_key ~ '^[a-z0-9_-]{1,30}$'),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  duration_ms integer not null check (duration_ms between 0 and 600000),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  status public.recording_status not null default 'pending',
  teacher_transcript text not null default '',
  transcript_source text not null default 'none' check (transcript_source in ('none', 'teacher', 'auto_draft')),
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  unique (attempt_id, task_id, part_key, segment_key)
);

create table public.audio_plays (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  media_key text not null check (char_length(media_key) between 1 and 80),
  plays smallint not null default 0,
  last_played_at timestamptz,
  primary key (attempt_id, task_id, media_key)
);

create table public.attempt_events (
  id bigint generated always as identity primary key,
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  event_type text not null check (char_length(event_type) <= 40),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index attempt_events_attempt_idx on public.attempt_events (attempt_id, created_at);

-- resultados objetivos calculados al enviar (por sección)
create table public.attempt_section_scores (
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  section_id uuid not null references public.exam_sections (id) on delete restrict,
  skill public.exam_skill not null,
  correct integer not null default 0,
  wrong integer not null default 0,
  blank integer not null default 0,
  raw_points numeric not null default 0,
  max_points numeric not null default 0,
  by_task jsonb not null default '[]'::jsonb,
  by_level jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (attempt_id, section_id)
);

create table public.resubmissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  reason text not null check (char_length(reason) between 3 and 2000),
  status text not null default 'open' check (status in ('open', 'submitted', 'cancelled')),
  requested_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);
create unique index resubmissions_open_idx on public.resubmissions (attempt_id, task_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- Evaluación docente
-- ---------------------------------------------------------------------------
create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete restrict,
  evaluator_id uuid references public.profiles (id) on delete set null,
  rubric_version_id uuid not null references public.rubric_versions (id) on delete restrict,
  status public.evaluation_status not null default 'draft',
  points numeric,
  max_points numeric,
  pedagogical_percent numeric check (pedagogical_percent is null or pedagogical_percent between 0 and 100),
  is_complete boolean not null default false,
  global_comment text not null default '',
  strengths text not null default '',
  priorities text not null default '',
  next_steps text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (attempt_id, task_id)
);

create table public.rubric_scores (
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  criterion_key text not null check (criterion_key ~ '^[a-z_]{2,40}$'),
  band smallint check (band between 0 and 5),
  points numeric,
  comment text not null default '',
  updated_at timestamptz not null default now(),
  primary key (evaluation_id, criterion_key)
);

create table public.teacher_feedback (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  kind text not null check (kind in ('strength', 'error', 'suggestion')),
  category text not null check (category ~ '^[a-z_]+\.[a-z_]+$'),
  criterion_key text,
  quote text not null default '' check (char_length(quote) <= 1000),
  char_start integer,
  char_end integer,
  recording_id uuid references public.oral_recordings (id) on delete set null,
  audio_ms integer check (audio_ms is null or audio_ms >= 0),
  explanation text not null default '',
  correction text not null default '',
  improved_example text not null default '',
  is_systematic boolean not null default false,
  severity smallint not null default 2 check (severity between 1 and 3),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_start is null or (char_end is not null and char_end >= char_start))
);
create index teacher_feedback_eval_idx on public.teacher_feedback (evaluation_id);

create table public.evaluation_history (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  action text not null,
  changed_by uuid references public.profiles (id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.published_results (
  attempt_id uuid primary key references public.attempts (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  scope text not null default 'full' check (scope in ('objective_auto', 'full')),
  report jsonb not null,
  published_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  revision integer not null default 1
);
create index published_results_student_idx on public.published_results (student_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Planes de estudio y práctica de refuerzo
-- ---------------------------------------------------------------------------
create table public.study_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(title) between 3 and 160),
  minutes_per_day smallint not null check (minutes_per_day in (15, 30, 60)),
  target_level public.cefr_level,
  target_date date,
  starts_on date not null default current_date,
  weeks smallint not null default 4 check (weeks between 1 and 26),
  status text not null default 'active' check (status in ('active', 'archived')),
  diagnosis jsonb not null default '{}'::jsonb,
  teacher_note text not null default '',
  created_at timestamptz not null default now()
);
create index study_plans_student_idx on public.study_plans (student_id, created_at desc);

create table public.study_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.study_plans (id) on delete cascade,
  week_no smallint not null check (week_no between 1 and 26),
  day_no smallint not null check (day_no between 1 and 7),
  position smallint not null default 1,
  activity text not null check (activity in ('receptive', 'writing', 'speaking', 'vocabulary', 'grammar', 'timed_mock')),
  skill public.exam_skill,
  title text not null,
  description text not null default '',
  module_key text,
  minutes smallint not null check (minutes between 5 and 120),
  completed_at timestamptz
);
create index study_plan_items_plan_idx on public.study_plan_items (plan_id, week_no, day_no, position);

create table public.practice_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles (id) on delete cascade,
  module_key text not null check (module_key ~ '^[a-z0-9_.-]{2,60}$'),
  score integer not null check (score >= 0),
  max_score integer not null check (max_score > 0 and score <= max_score),
  completed_at timestamptz not null default now()
);
create index practice_progress_student_idx on public.practice_progress (student_id, module_key, completed_at desc);

-- ---------------------------------------------------------------------------
-- Operación, auditoría y configuración
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create table public.rate_limits (
  bucket_key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket_key, window_start)
);

create table public.retention_policies (
  entity text primary key check (entity in ('oral_recordings', 'attempt_events', 'audit_logs', 'response_revisions')),
  retain_days integer not null check (retain_days between 30 and 3650),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key check (key ~ '^[a-z_.]{3,60}$'),
  value jsonb not null,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations (id) on delete cascade,
  provider text not null,
  model text not null,
  input_chars integer not null,
  suggestion jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
