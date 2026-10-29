"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CloudOff, Loader2, RefreshCw, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, Badge, Card, RichText } from "@/components/ui/primitives";
import { requestAudioUrl, getTaskImageUrls } from "@/app/estudiante/intentos/[id]/actions";
import { getBrowserClient } from "@/lib/supabase/browser";
import { errorCode, errorMessage } from "@/lib/exam/errors";
import { SKILL_META, formatDuration } from "@/lib/exam/skills";
import type {
  AttemptSection,
  AttemptState,
  PracticeCheckResult,
  RecordingInfo,
  ResponsePayload,
  TaskPayload,
} from "@/lib/exam/types";
import { cn } from "@/lib/utils";
import { useAutosave, type SaveStatus } from "./autosave";
import { ExamFooter, ExamHeader, TaskTabs, TimerBox, useCountdown } from "./chrome";
import { MicCheck } from "./mic-check";
import { baseMime, extensionFor, sha256Hex } from "./recorder";
import { TaskView, blankCount } from "./task-view";
import type { MediaApi, OralApi } from "./types";

type AnswerMap = Record<string, ResponsePayload>;

export function ExamRunner({ initialState, userId }: { initialState: AttemptState; userId: string }) {
  const supabase = useMemo(() => getBrowserClient(), []);
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [offset, setOffset] = useState(() => new Date(initialState.server_now).getTime() - Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const attemptId = state.attempt.id;

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_attempt_state", { p_attempt: attemptId });
    if (error) {
      setNotice(errorMessage(error));
      return null;
    }
    const next = data as AttemptState;
    setOffset(new Date(next.server_now).getTime() - Date.now());
    setState(next);
    return next;
  }, [supabase, attemptId]);

  const saver = useCallback(
    async (taskId: string, itemKey: string, payload: ResponsePayload) => {
      const { error } = await supabase.rpc("save_response", { p_attempt: attemptId, p_task: taskId, p_item_key: itemKey, p_payload: payload });
      if (error) throw error;
    },
    [supabase, attemptId],
  );

  const onFatal = useCallback(
    (code: string) => {
      setNotice(errorMessage(code));
      void refresh();
    },
    [refresh],
  );

  const autosave = useAutosave(`stp:pending:${attemptId}`, saver, onFatal);

  // eventos relevantes para el control del intento
  const lastVisibilityLog = useRef(0);
  useEffect(() => {
    const log = (type: string) => {
      if (Date.now() - lastVisibilityLog.current < 10_000) return;
      lastVisibilityLog.current = Date.now();
      void supabase.rpc("log_client_event", { p_attempt: attemptId, p_type: type, p_details: {} });
    };
    const onVis = () => log(document.visibilityState === "hidden" ? "visibility_hidden" : "visibility_visible");
    const onOffline = () => void supabase.rpc("log_client_event", { p_attempt: attemptId, p_type: "connection_lost", p_details: {} });
    const onOnline = () => void supabase.rpc("log_client_event", { p_attempt: attemptId, p_type: "connection_restored", p_details: {} });
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [supabase, attemptId]);

  const active = state.sections.find((s) => s.status === "active");
  const ready = state.sections.find((s) => s.status === "ready");
  const inProgress = state.attempt.status === "in_progress";

  // aviso antes de abandonar la página con una prueba en curso
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if ((inProgress && active) || autosave.hasPending()) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [inProgress, active, autosave]);

  let body: React.ReactNode;
  if (state.attempt.status === "resubmission_requested") {
    body = <ResubmissionView state={state} supabase={supabase} autosave={autosave} refresh={refresh} />;
  } else if (!inProgress) {
    body = <SubmittedView state={state} />;
  } else if (active) {
    body = (
      <ActiveSection
        key={active.section_id}
        state={state}
        section={active}
        offset={offset}
        userId={userId}
        supabase={supabase}
        autosave={autosave}
        refresh={refresh}
        setNotice={setNotice}
      />
    );
  } else if (ready) {
    body = <SectionIntro key={ready.section_id} state={state} section={ready} offset={offset} supabase={supabase} refresh={refresh} setNotice={setNotice} />;
  } else {
    body = <FinalReview state={state} supabase={supabase} autosave={autosave} refresh={refresh} onDone={() => router.refresh()} />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      {body}
      <ConnectionBanner status={autosave.status} pending={autosave.pendingCount} onRetry={() => void autosave.flush()} />
      <Dialog open={Boolean(notice)} onOpenChange={(o) => !o && setNotice(null)} title="Aviso" description={notice ?? ""} footer={<Button onClick={() => setNotice(null)}>Entendido</Button>} />
    </div>
  );
}

type Autosave = ReturnType<typeof useAutosave>;
type Supa = ReturnType<typeof getBrowserClient>;

function SaveIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: Date | null }) {
  const map: Record<SaveStatus, { icon: React.ReactNode; text: string; cls: string }> = {
    idle: { icon: <Save className="size-4" />, text: "Guardado automático activo", cls: "text-white/70" },
    pending: { icon: <Save className="size-4" />, text: "Cambios pendientes…", cls: "text-white/80" },
    saving: { icon: <Loader2 className="size-4 animate-spin" />, text: "Guardando…", cls: "text-white" },
    saved: {
      icon: <CheckCircle2 className="size-4" />,
      text: `Guardado${lastSavedAt ? ` a las ${lastSavedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}`,
      cls: "text-emerald-300",
    },
    offline: { icon: <CloudOff className="size-4" />, text: "Sin conexión: guardado en este dispositivo", cls: "text-amber-300" },
    error: { icon: <TriangleAlert className="size-4" />, text: "Un cambio no se pudo guardar", cls: "text-red-300" },
  };
  const s = map[status];
  return (
    <span className={cn("hidden items-center gap-1.5 text-sm sm:flex", s.cls)} role="status" aria-live="polite">
      {s.icon}
      {s.text}
    </span>
  );
}

function ConnectionBanner({ status, pending, onRetry }: { status: SaveStatus; pending: number; onRetry: () => void }) {
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
  if (online && status !== "offline") return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-40 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 shadow-lg" role="alert">
      <p className="flex items-center gap-2 font-semibold text-warn">
        <CloudOff className="size-5" aria-hidden /> Conexión perdida
      </p>
      <p className="mt-1 text-sm text-ink-2">
        Puede seguir respondiendo: {pending > 0 ? `${pending} ${pending === 1 ? "cambio se ha" : "cambios se han"} guardado` : "los cambios se guardan"} en este
        dispositivo y se enviarán al servidor al recuperar la conexión. El tiempo sigue corriendo en el servidor.
      </p>
      <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
        <RefreshCw className="size-4" aria-hidden /> Reintentar ahora
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Introducción de cada prueba (instrucciones, descanso, comprobaciones)
// ---------------------------------------------------------------------------
function SectionIntro({
  state,
  section,
  offset,
  supabase,
  refresh,
  setNotice,
}: {
  state: AttemptState;
  section: AttemptSection;
  offset: number;
  supabase: Supa;
  refresh: () => Promise<AttemptState | null>;
  setNotice: (s: string) => void;
}) {
  const meta = SKILL_META[section.skill];
  const pauseLeft = useCountdown(section.available_at, offset);
  const onPause = pauseLeft != null && pauseLeft > 0 && state.sections.some((s) => s.status === "completed" || s.status === "timed_out");
  const [micOk, setMicOk] = useState(section.skill !== "speaking");
  const [audioOk, setAudioOk] = useState(section.skill !== "listening");
  const [starting, setStarting] = useState(false);
  const total = state.sections.length;

  const start = async () => {
    setStarting(true);
    const { error } = await supabase.rpc("start_section", { p_attempt: state.attempt.id, p_section: section.section_id });
    setStarting(false);
    if (error) setNotice(errorMessage(error));
    await refresh();
  };

  return (
    <>
      <ExamHeader title={meta.label} subtitle={`${state.attempt.exam_title} · Prueba ${section.position} de ${total}`} skill={section.skill} />
      <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        {onPause ? (
          <Card className="mb-6 border-blue/30 bg-blue-soft px-5 py-4">
            <p className="font-semibold text-blue">Descanso entre pruebas</p>
            <p className="mt-1 text-ink-2">
              Tiempo de descanso restante: <strong className="tabular-nums">{formatDuration(pauseLeft ?? 0)}</strong>. Puede continuar cuando esté preparado.
            </p>
          </Card>
        ) : null}
        <h1 className="text-2xl font-semibold">{section.title}</h1>
        <p className="mt-2 text-ink-2">{meta.description}</p>
        <ul className="mt-6 space-y-2 text-[0.98rem]">
          <li>
            <strong>Tiempo:</strong> {formatDuration(section.time_limit_seconds)} ({Math.round(section.time_limit_seconds / 60)} minutos). El tiempo empieza cuando pulse «Comenzar» y lo controla el servidor.
          </li>
          <li>
            <strong>Tareas:</strong> {section.tasks.length}.{" "}
            {section.allow_back ? "Puede moverse entre las tareas de esta prueba." : "Una vez que pase a la tarea siguiente, no podrá volver a la anterior."}
          </li>
          {section.skill === "listening" ? (
            <li>
              <strong>Audios:</strong> cada audio se escucha dos veces. {state.attempt.mode === "formal" ? "La reproducción es automática y pautada." : "En práctica, usted decide cuándo escuchar."}
            </li>
          ) : null}
          {section.skill === "speaking" ? (
            <li>
              <strong>Grabaciones:</strong> la grabación empieza automáticamente al terminar el tiempo de preparación. Solo se da por entregada cuando aparece «Grabación guardada en el servidor».
            </li>
          ) : null}
          <li>
            <strong>Guardado:</strong> sus respuestas se guardan automáticamente.
          </li>
        </ul>
        {section.instructions ? <RichText text={section.instructions} className="mt-6 space-y-2 rounded-lg bg-surface-2 px-5 py-4" /> : null}

        {section.skill === "listening" ? (
          <div className="mt-6 rounded-xl border border-line bg-surface p-4">
            <p className="font-medium">Comprobación del sonido</p>
            <p className="text-sm text-ink-2">Use auriculares si es posible y suba el volumen del dispositivo.</p>
            <label className="mt-3 flex items-center gap-2">
              <input type="checkbox" className="size-5" checked={audioOk} onChange={(e) => setAudioOk(e.target.checked)} />
              Confirmo que el sonido de mi dispositivo funciona.
            </label>
          </div>
        ) : null}
        {section.skill === "speaking" ? (
          <div className="mt-6">
            <MicCheck
              onResult={(ok, detail) => {
                setMicOk(ok);
                void supabase.rpc("log_client_event", {
                  p_attempt: state.attempt.id,
                  p_type: ok ? "mic_check_ok" : "mic_check_failed",
                  p_details: detail ? { detail } : {},
                });
              }}
            />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/estudiante" className="text-sm text-ink-3 underline">
            Salir (el intento queda guardado)
          </Link>
          <Button variant="exam" size="lg" onClick={() => void start()} disabled={starting || !micOk || !audioOk}>
            {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Comenzar la prueba
          </Button>
        </div>
        {!micOk ? <p className="mt-2 text-right text-sm text-ink-3">Compruebe el micrófono para poder comenzar.</p> : null}
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prueba activa
// ---------------------------------------------------------------------------
function ActiveSection({
  state,
  section,
  offset,
  userId,
  supabase,
  autosave,
  refresh,
  setNotice,
}: {
  state: AttemptState;
  section: AttemptSection;
  offset: number;
  userId: string;
  supabase: Supa;
  autosave: Autosave;
  refresh: () => Promise<AttemptState | null>;
  setNotice: (s: string) => void;
}) {
  const attemptId = state.attempt.id;
  const [pos, setPos] = useState(section.current_task_position);
  const [payloads, setPayloads] = useState<Record<string, TaskPayload>>({});
  const [answers, setAnswers] = useState<Record<string, AnswerMap>>({});
  const [recordings, setRecordings] = useState<Record<string, Record<string, RecordingInfo>>>({});
  const [plays, setPlays] = useState<Record<string, Record<string, number>>>({});
  const [images, setImages] = useState<Record<string, Record<string, string>>>({});
  const [feedback, setFeedback] = useState<Record<string, PracticeCheckResult>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "forward"; to: number; blanks: number } | { kind: "finish"; blanks: number }>(null);
  const [busy, setBusy] = useState(false);

  const meta = section.tasks.find((t) => t.position === pos) ?? section.tasks[0];
  const taskId = meta.task_id;
  const payload = payloads[taskId];
  const isLast = pos === Math.max(...section.tasks.map((t) => t.position));

  const loadTask = useCallback(
    async (id: string) => {
      const { data, error } = await supabase.rpc("get_attempt_task", { p_attempt: attemptId, p_task: id });
      if (error) {
        const code = errorCode(error);
        setLoadError(errorMessage(error));
        if (code === "time_expired" || code === "section_not_active" || code === "attempt_closed") void refresh();
        return;
      }
      setLoadError(null);
      const p = data as TaskPayload;
      const ans: AnswerMap = {};
      for (const r of p.responses) ans[r.item_key] = r.payload;
      // superponer cambios que aún no llegaron al servidor
      for (const item of autosave.pendingFor(id)) ans[item.itemKey] = item.payload;
      const recs: Record<string, RecordingInfo> = {};
      for (const r of p.recordings) recs[`${r.part_key}/${r.segment_key}`] = r;
      const pl: Record<string, number> = {};
      for (const a of p.audio_plays) pl[a.media_key] = a.plays;
      setPayloads((s) => ({ ...s, [id]: p }));
      setAnswers((s) => ({ ...s, [id]: ans }));
      setRecordings((s) => ({ ...s, [id]: recs }));
      setPlays((s) => ({ ...s, [id]: pl }));
      const hasImages = Object.values((p.task.content.media ?? {}) as Record<string, { kind: string }>).some((m) => m.kind === "image");
      if (hasImages) {
        const urls = await getTaskImageUrls(attemptId, id);
        setImages((s) => ({ ...s, [id]: urls }));
      }
      if (section.tasks.find((t) => t.task_id === id)?.checked) {
        const { data: fb } = await supabase.rpc("check_practice_task", { p_attempt: attemptId, p_task: id });
        if (fb) setFeedback((s) => ({ ...s, [id]: fb as PracticeCheckResult }));
      }
    },
    [supabase, attemptId, autosave, refresh, section.tasks],
  );

  useEffect(() => {
    if (payloads[taskId]) return;
    // la carga se programa fuera del efecto; el estado se actualiza al llegar la respuesta
    const t = window.setTimeout(() => void loadTask(taskId), 0);
    return () => window.clearTimeout(t);
  }, [taskId, payloads, loadTask]);

  const onExpire = useCallback(async () => {
    await autosave.flush();
    setNotice("El tiempo de esta prueba ha terminado. Se ha guardado todo lo que respondió.");
    await refresh();
  }, [autosave, refresh, setNotice]);
  const remaining = useCountdown(section.deadline_at, offset, onExpire);

  const onAnswer = useCallback(
    (itemKey: string, value: ResponsePayload, opts?: { debounceMs?: number }) => {
      setAnswers((s) => ({ ...s, [taskId]: { ...(s[taskId] ?? {}), [itemKey]: value } }));
      autosave.enqueue(taskId, itemKey, value, opts?.debounceMs ?? 0);
    },
    [taskId, autosave],
  );

  const media: MediaApi = useMemo(() => {
    const content = (payload?.task.content ?? {}) as { media?: Record<string, { asset_id: string; max_plays?: number }> };
    return {
      playsUsed: (k) => plays[taskId]?.[k] ?? 0,
      maxPlays: (k) => content.media?.[k]?.max_plays ?? payload?.task.max_audio_plays ?? 2,
      requestAudio: async (k) => {
        const res = await requestAudioUrl(attemptId, taskId, k);
        if (!res.ok) throw new Error(res.code ?? res.error);
        setPlays((s) => ({ ...s, [taskId]: { ...(s[taskId] ?? {}), [k]: (s[taskId]?.[k] ?? 0) + 1 } }));
        return { url: res.url, synthetic: res.synthetic };
      },
      imageUrl: (k) => {
        const asset = content.media?.[k]?.asset_id;
        return asset ? images[taskId]?.[asset] : undefined;
      },
    };
  }, [payload, plays, images, taskId, attemptId]);

  const linkedChoices = useMemo(() => {
    const out: Record<string, string> = { ...(payload?.choices ?? {}) };
    for (const t of section.tasks) {
      for (const [k, v] of Object.entries(answers[t.task_id] ?? {})) {
        if (k.startsWith("choice:") && "option_key" in v && v.option_key) out[`${t.position}:${k}`] = v.option_key;
      }
    }
    return out;
  }, [payload, answers, section.tasks]);

  const oral: OralApi = useMemo(
    () => ({
      recordings: recordings[taskId] ?? {},
      linkedChoices,
      allowRerecord: state.attempt.mode === "practice",
      micReady: true,
      upload: async (partKey, segmentKey, blob, durationMs) => {
        await autosave.flush();
        const ext = extensionFor(blob.type);
        const path = `${userId}/${attemptId}/${taskId}/${partKey}-${segmentKey}-${Date.now()}.${ext}`;
        const sha = await sha256Hex(blob);
        const { error: upError } = await supabase.storage
          .from("recordings")
          .upload(path, blob, { contentType: baseMime(blob.type), upsert: false, cacheControl: "0" });
        if (upError) throw upError;
        const { error } = await supabase.rpc("register_recording", {
          p_attempt: attemptId,
          p_task: taskId,
          p_part: partKey,
          p_segment: segmentKey,
          p_path: path,
          p_mime: baseMime(blob.type),
          p_size: blob.size,
          p_duration_ms: durationMs,
          p_sha256: sha,
        });
        if (error) throw error;
        setRecordings((s) => ({
          ...s,
          [taskId]: { ...(s[taskId] ?? {}), [`${partKey}/${segmentKey}`]: { part_key: partKey, segment_key: segmentKey, status: "verified", duration_ms: durationMs } },
        }));
      },
    }),
    [recordings, taskId, linkedChoices, state.attempt.mode, autosave, userId, attemptId, supabase],
  );

  const currentBlanks = payload
    ? blankCount({ task: payload.task, questions: payload.questions, answers: answers[taskId] ?? {}, recordings: recordings[taskId] })
    : 0;

  const goTo = async (to: number, skipConfirm = false) => {
    if (to === pos) return;
    if (!section.allow_back && to > pos && !skipConfirm) {
      setConfirm({ kind: "forward", to, blanks: currentBlanks });
      return;
    }
    setBusy(true);
    await autosave.flush();
    const { error } = await supabase.rpc("set_task_position", { p_attempt: attemptId, p_section: section.section_id, p_position: to });
    setBusy(false);
    if (error) {
      setNotice(errorMessage(error));
      void refresh();
      return;
    }
    setPos(to);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openFinish = async () => {
    await autosave.flush();
    const next = await refresh();
    const sec = next?.sections.find((s) => s.section_id === section.section_id) ?? section;
    const blanks = sec.tasks.reduce((sum, t) => {
      if (t.interaction_type === "writing") return sum + (t.answered > 0 ? 0 : 1);
      if (t.interaction_type === "speaking") return sum + (t.recordings > 0 ? 0 : 1);
      return sum + Math.max(0, t.declared_items - t.answered);
    }, 0);
    setConfirm({ kind: "finish", blanks });
  };

  const finishSection = async () => {
    setBusy(true);
    await autosave.flush();
    const { error } = await supabase.rpc("complete_section", { p_attempt: attemptId, p_section: section.section_id });
    setBusy(false);
    setConfirm(null);
    if (error) setNotice(errorMessage(error));
    await refresh();
    window.scrollTo({ top: 0 });
  };

  const checkTask = async () => {
    await autosave.flush();
    const { data, error } = await supabase.rpc("check_practice_task", { p_attempt: attemptId, p_task: taskId });
    if (error) return setNotice(errorMessage(error));
    setFeedback((s) => ({ ...s, [taskId]: data as PracticeCheckResult }));
  };

  const objective = payload && !["writing", "speaking"].includes(payload.task.interaction_type);
  const canCheck = state.attempt.mode === "practice" && state.attempt.immediate_feedback && objective && !feedback[taskId];
  const tabs = section.tasks.map((t) => ({
    position: t.position,
    title: t.title,
    done: t.task_id === taskId ? currentBlanks === 0 : t.answered > 0 || t.recordings > 0,
    locked: !section.allow_back && t.position < pos,
  }));
  const answeredSoFar = section.tasks.filter((t) => t.position < pos).length + (currentBlanks === 0 ? 1 : 0);

  return (
    <>
      <ExamHeader
        title={SKILL_META[section.skill].label}
        subtitle={state.attempt.title}
        skill={section.skill}
        right={<SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} />}
      />
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <TaskTabs tabs={tabs} current={pos} skill={section.skill} onSelect={(p) => void goTo(p)} />
          <TimerBox seconds={remaining} />
        </div>
        {state.attempt.mode === "practice" ? (
          <p className="mb-4">
            <Badge tone="brand">Modo práctica</Badge>
          </p>
        ) : null}
        {loadError ? (
          <Alert tone="danger" title="No se pudo cargar la tarea">
            {loadError}{" "}
            <Button size="sm" variant="secondary" className="ml-2" onClick={() => void loadTask(taskId)}>
              Reintentar
            </Button>
          </Alert>
        ) : !payload ? (
          <p className="flex items-center gap-2 text-ink-3">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Cargando la tarea…
          </p>
        ) : (
          <TaskView
            key={taskId}
            task={payload.task}
            questions={payload.questions}
            bank={payload.bank}
            answers={answers[taskId] ?? {}}
            onAnswer={onAnswer}
            readOnly={Boolean(feedback[taskId])}
            feedback={feedback[taskId]}
            media={media}
            skill={section.skill}
            mode={state.attempt.mode}
            oral={oral}
            onTimedSequenceEnd={() => {
              if (!isLast) void goTo(pos + 1, true);
            }}
          />
        )}
        {canCheck ? (
          <div className="mt-8 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3">
            <p className="text-sm text-ink-2">Práctica con corrección inmediata: al comprobar verá las soluciones y explicaciones, y ya no podrá cambiar las respuestas de esta tarea.</p>
            <Button className="mt-2" onClick={() => void checkTask()}>
              Comprobar respuestas
            </Button>
          </div>
        ) : null}
      </main>
      <ExamFooter progressLabel={`${pos} / ${section.tasks.length}`} progress={answeredSoFar / section.tasks.length}>
        {section.allow_back && pos > 1 ? (
          <Button variant="secondary" size="lg" disabled={busy} onClick={() => void goTo(pos - 1)}>
            Anterior
          </Button>
        ) : null}
        {isLast ? (
          <Button variant="exam" size="lg" disabled={busy} onClick={() => void openFinish()}>
            Terminar la prueba
          </Button>
        ) : (
          <Button variant="exam" size="lg" disabled={busy} onClick={() => void goTo(pos + 1)}>
            Siguiente
          </Button>
        )}
      </ExamFooter>

      <Dialog
        open={confirm?.kind === "forward"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Pasar a la tarea siguiente?"
        description={
          confirm?.kind === "forward" && confirm.blanks > 0
            ? `Ha dejado ${confirm.blanks} ${confirm.blanks === 1 ? "respuesta" : "respuestas"} sin contestar en esta tarea. En esta prueba no podrá volver atrás.`
            : "En esta prueba no podrá volver a esta tarea."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              No, seguir aquí
            </Button>
            <Button
              variant="exam"
              onClick={() => {
                const to = confirm?.kind === "forward" ? confirm.to : pos;
                setConfirm(null);
                void goTo(to, true);
              }}
            >
              Sí, continuar
            </Button>
          </>
        }
      />
      <Dialog
        open={confirm?.kind === "finish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="¿Terminar esta prueba?"
        description={
          confirm?.kind === "finish" && confirm.blanks > 0
            ? `Quedan ${confirm.blanks} ${confirm.blanks === 1 ? "elemento" : "elementos"} sin responder. Después de terminar no podrá modificar esta prueba.`
            : "Ha respondido a todo. Después de terminar no podrá modificar esta prueba."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Volver
            </Button>
            <Button variant="exam" disabled={busy} onClick={() => void finishSection()}>
              Terminar la prueba
            </Button>
          </>
        }
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Revisión final y envío
// ---------------------------------------------------------------------------
function FinalReview({
  state,
  supabase,
  autosave,
  refresh,
  onDone,
}: {
  state: AttemptState;
  supabase: Supa;
  autosave: Autosave;
  refresh: () => Promise<AttemptState | null>;
  onDone: () => void;
}) {
  const [confirm, setConfirm] = useState<null | { blank: number; byTask: { section_title: string; task_title: string; blank: number }[] }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (confirmBlanks: boolean) => {
    setBusy(true);
    setError(null);
    await autosave.flush();
    const { data, error: rpcError } = await supabase.rpc("submit_attempt", { p_attempt: state.attempt.id, p_confirm_blanks: confirmBlanks });
    setBusy(false);
    if (rpcError) return setError(errorMessage(rpcError));
    const res = data as { status: string; blank_items: number; by_task?: { section_title: string; task_title: string; blank: number }[] };
    if (res.status === "needs_confirmation") {
      setConfirm({ blank: res.blank_items, byTask: res.by_task ?? [] });
      return;
    }
    setConfirm(null);
    await refresh();
    onDone();
  };

  return (
    <>
      <ExamHeader title="Revisión final" subtitle={state.attempt.exam_title} skill="writing" />
      <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold">Ha completado todas las pruebas</h1>
        <p className="mt-2 text-ink-2">Revise el resumen y envíe el intento. Después del envío definitivo no se pueden modificar las respuestas.</p>
        <ul className="mt-6 space-y-3">
          {state.sections.map((s) => (
            <li key={s.section_id} className="flex items-center justify-between rounded-lg border border-line px-4 py-3">
              <span>
                <span className="font-medium">{SKILL_META[s.skill].label}</span>
                <span className="ml-2 text-sm text-ink-3">{s.status === "timed_out" ? "tiempo agotado" : "terminada"}</span>
              </span>
              <span className="text-sm text-ink-2">
                {s.tasks.reduce((n, t) => n + (t.interaction_type === "speaking" ? (t.recordings > 0 ? 1 : 0) : t.interaction_type === "writing" ? Math.min(1, t.answered) : t.answered), 0)} /{" "}
                {s.tasks.reduce((n, t) => n + (t.interaction_type === "writing" || t.interaction_type === "speaking" ? 1 : t.declared_items), 0)} respondidos
              </span>
            </li>
          ))}
        </ul>
        {error ? (
          <Alert tone="danger" className="mt-4" title="No se pudo enviar">
            {error}
          </Alert>
        ) : null}
        <div className="mt-8 flex justify-end">
          <Button variant="exam" size="lg" disabled={busy} onClick={() => void submit(false)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Enviar el intento
          </Button>
        </div>
      </main>
      <Dialog
        open={Boolean(confirm)}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Hay respuestas en blanco"
        description={`Quedan ${confirm?.blank ?? 0} elementos sin responder. ¿Desea enviar de todos modos?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              Cancelar
            </Button>
            <Button variant="exam" disabled={busy} onClick={() => void submit(true)}>
              Enviar definitivamente
            </Button>
          </>
        }
      >
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {confirm?.byTask.map((b, i) => (
            <li key={i}>
              {b.section_title} · {b.task_title}: {b.blank}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function SubmittedView({ state }: { state: AttemptState }) {
  const annulled = state.attempt.status === "annulled";
  return (
    <>
      <ExamHeader title={annulled ? "Intento anulado" : "Intento enviado"} subtitle={state.attempt.exam_title} skill="reading" />
      <main id="contenido" className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-center sm:px-6">
        <CheckCircle2 className="mx-auto size-14 text-ok" aria-hidden />
        <h1 className="mt-4 text-2xl font-semibold">{annulled ? "Este intento fue anulado por el personal docente." : "Su intento se ha enviado correctamente"}</h1>
        {!annulled ? (
          <p className="mt-2 text-ink-2">
            {state.attempt.status === "published"
              ? "Los resultados ya están publicados."
              : state.attempt.immediate_feedback
                ? "Puede consultar la corrección de las pruebas de comprensión. Las tareas de producción las evaluará su profesora."
                : "Su profesora revisará las respuestas y publicará el informe con recomendaciones personalizadas."}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {state.attempt.status === "published" || state.attempt.immediate_feedback ? (
            <Link href={`/estudiante/resultados/${state.attempt.id}`} className="inline-flex h-11 items-center rounded-lg bg-brand px-4 font-medium text-white">
              Ver resultados
            </Link>
          ) : null}
          <Link href="/estudiante" className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4 font-medium">
            Volver al panel
          </Link>
        </div>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// Nueva entrega solicitada por la profesora
// ---------------------------------------------------------------------------
function ResubmissionView({
  state,
  supabase,
  autosave,
  refresh,
}: {
  state: AttemptState;
  supabase: Supa;
  autosave: Autosave;
  refresh: () => Promise<AttemptState | null>;
}) {
  const open = state.resubmissions[0];
  const [payload, setPayload] = useState<TaskPayload | null>(null);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data, error: e } = await supabase.rpc("get_attempt_task", { p_attempt: state.attempt.id, p_task: open.task_id });
      if (e) return setError(errorMessage(e));
      const p = data as TaskPayload;
      const ans: AnswerMap = {};
      for (const r of p.responses) ans[r.item_key] = r.payload;
      setPayload(p);
      setAnswers(ans);
    })();
  }, [open, supabase, state.attempt.id]);

  if (!open) return <SubmittedView state={state} />;
  const noMedia: MediaApi = { playsUsed: () => 0, maxPlays: () => 0, requestAudio: async () => Promise.reject(new Error("no")), imageUrl: () => undefined };

  return (
    <>
      <ExamHeader title="Nueva entrega solicitada" subtitle={state.attempt.exam_title} skill="writing" right={<SaveIndicator status={autosave.status} lastSavedAt={autosave.lastSavedAt} />} />
      <main id="contenido" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <Alert tone="warn" title="Su profesora le pide una nueva versión de este texto">
          {open.reason}
        </Alert>
        {error ? <Alert tone="danger" className="mt-4" title="Error">{error}</Alert> : null}
        <div className="mt-6">
          {payload ? (
            <TaskView
              task={payload.task}
              questions={payload.questions}
              bank={payload.bank}
              answers={answers}
              onAnswer={(k, v, o) => {
                setAnswers((s) => ({ ...s, [k]: v }));
                autosave.enqueue(open.task_id, k, v, o?.debounceMs ?? 0);
              }}
              readOnly={false}
              media={noMedia}
              skill="writing"
              mode={state.attempt.mode}
            />
          ) : (
            <Loader2 className="size-5 animate-spin" aria-label="Cargando" />
          )}
        </div>
        <div className="mt-8 flex justify-end">
          <Button
            variant="exam"
            size="lg"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await autosave.flush();
              const { error: e } = await supabase.rpc("submit_resubmission", { p_attempt: state.attempt.id, p_task: open.task_id });
              setBusy(false);
              if (e) return setError(errorMessage(e));
              await refresh();
            }}
          >
            Entregar la nueva versión
          </Button>
        </div>
      </main>
    </>
  );
}
