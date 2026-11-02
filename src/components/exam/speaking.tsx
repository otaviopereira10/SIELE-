"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightSquare, CheckCircle2, Loader2, Mic, MicOff, RotateCcw, Square, UploadCloud } from "lucide-react";
import { RecordingPlayer } from "@/components/audio/recording-player";
import { Button } from "@/components/ui/button";
import { Alert, RichText, inline } from "@/components/ui/primitives";
import type { OralOption, OralPart, OralSegment, SpeakingContent } from "@/lib/exam/content-schema";
import { errorMessage } from "@/lib/exam/errors";
import { formatDuration } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";
import { PromptAudio } from "./audio-player";
import { PhaseCountdown, Timed } from "./chrome";
import { EmptyRecordingError, SILENCE_PEAK, useRecorder } from "./recorder";
import type { OralApi, TaskRendererProps } from "./types";

function recKey(part: string, seg: string) {
  return `${part}/${seg}`;
}

function chosenOption(props: TaskRendererProps, part: OralPart): OralOption | null {
  const saved = props.answers[`choice:${part.key}`];
  const key = saved && "option_key" in saved ? saved.option_key : null;
  return part.choice?.options.find((o) => o.key === key) ?? null;
}

function availableOptions(props: TaskRendererProps, part: OralPart): OralOption[] {
  const all = part.choice?.options ?? [];
  const linked = part.choice?.linked;
  if (!linked) return all;
  const linkedKey = props.oral?.linkedChoices[`${linked.task_position}:choice:${linked.part_key}`];
  const filtered = linkedKey ? all.filter((o) => o.linked_option === linkedKey) : all;
  return filtered.length ? filtered : all;
}

function segmentsFor(part: OralPart, option: OralOption | null): OralSegment[] {
  return option?.segments?.length ? option.segments : (part.segments ?? []);
}

/** Grabaciones que faltan en una tarea oral (cada parte sin elegir cuenta como una). */
export function pendingSegments(content: Record<string, unknown>, answers: TaskRendererProps["answers"], recordings: Record<string, { status: string }>): number {
  let pending = 0;
  for (const part of (content as SpeakingContent).parts ?? []) {
    const saved = answers[`choice:${part.key}`];
    const key = saved && "option_key" in saved ? saved.option_key : null;
    const option = part.choice?.options.find((o) => o.key === key) ?? null;
    if (part.choice && !option) {
      pending += 1;
      continue;
    }
    pending += segmentsFor(part, option).filter((s) => recordings[recKey(part.key, s.key)]?.status !== "verified").length;
  }
  return pending;
}

/** Tarea oral: las partes se recorren en orden; cada segmento termina con una grabación verificada. */
export function SpeakingTask(props: TaskRendererProps) {
  const c = props.task.content as SpeakingContent;
  const oral = props.oral;
  const parts = c.parts;

  const isPartDone = useCallback(
    (part: OralPart) => {
      const opt = chosenOption(props, part);
      if (part.choice && !opt) return false;
      const segs = segmentsFor(part, opt);
      return segs.length > 0 && segs.every((s) => oral?.recordings[recKey(part.key, s.key)]?.status === "verified");
    },
    [props, oral],
  );

  const firstPending = parts.findIndex((p) => !isPartDone(p));
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const index = viewIndex ?? (firstPending === -1 ? parts.length - 1 : firstPending);
  const backToPending = useCallback(() => setViewIndex(null), []);

  if (!oral) {
    return <Alert tone="warn" title="Grabación no disponible">Esta vista no permite grabar respuestas.</Alert>;
  }

  return (
    <div className="space-y-6">
      {parts.length > 1 ? (
        <ol className="flex flex-wrap gap-2 text-sm" aria-label="Partes de la tarea">
          {parts.map((p, i) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => (props.readOnly || isPartDone(p) ? setViewIndex(i) : undefined)}
                className={cn(
                  "rounded-full border px-3 py-1",
                  i === index ? "border-orange bg-orange-soft font-medium text-orange" : "border-line text-ink-2",
                )}
              >
                {p.title ?? `Parte ${i + 1}`} {isPartDone(p) ? "✓" : ""}
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      {firstPending === -1 && viewIndex == null ? (
        <Alert tone="ok" title="Tarea completada">
          Todas las grabaciones de esta tarea se han guardado en el servidor. Pulse «Siguiente» para continuar.
        </Alert>
      ) : null}
      <PartRunner key={parts[index].key + (props.readOnly ? "-ro" : "")} props={props} part={parts[index]} done={isPartDone(parts[index])} onFinished={backToPending} />
    </div>
  );
}

type PartPhase = "choose" | "read" | "prep" | "segments";

function PartRunner({ props, part, done, onFinished }: { props: TaskRendererProps; part: OralPart; done: boolean; onFinished: () => void }) {
  const oral = props.oral!;
  const option = chosenOption(props, part);
  const segs = segmentsFor(part, option);
  const anyRecorded = segs.some((s) => oral.recordings[recKey(part.key, s.key)]);
  const initial: PartPhase =
    part.choice && !option ? "choose" : anyRecorded || done ? "segments" : part.read_seconds > 0 ? "read" : part.prep_seconds > 0 ? "prep" : "segments";
  const [phase, setPhase] = useState<PartPhase>(initial);
  const notes = props.answers[`notes:${part.key}`];
  const [noteText, setNoteText] = useState(notes && "text" in notes ? notes.text : "");
  const options = availableOptions(props, part);
  const chooseRef = useRef(false);

  const choose = (o: OralOption | undefined, auto = false) => {
    if (chooseRef.current || !o) return;
    chooseRef.current = true;
    props.onAnswer(`choice:${part.key}`, { option_key: o.key, auto_assigned: auto });
    setPhase(part.read_seconds > 0 ? "read" : part.prep_seconds > 0 ? "prep" : "segments");
  };

  const optionCard = option ? (
    <article className="rounded-lg bg-surface-2 px-5 py-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <ArrowRightSquare className="size-6 text-accent" aria-hidden /> {option.title}
      </h3>
      {option.body ? <RichText text={option.body} className="reading-text mt-2" /> : null}
      {option.bullets.length ? (
        <ul className="mt-2 ml-6 list-disc space-y-1">
          {option.bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>
      ) : null}
      {option.image_key && props.media.imageUrl(option.image_key) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={props.media.imageUrl(option.image_key)} alt={`Fotografía: ${option.title}`} className="mt-4 max-h-[460px] w-full rounded-lg border border-line object-contain" />
      ) : null}
    </article>
  ) : null;

  if (phase === "choose") {
    return (
      <div className="space-y-6">
        <RichText text={part.instructions} className="space-y-2 text-lg leading-relaxed" />
        {!props.readOnly ? (
          <Timed seconds={part.choice?.seconds ?? 0} onDone={() => choose(options[Math.floor(Math.random() * options.length)], true)}>
            {(left) => <PhaseCountdown label="Tiempo para elegir la opción" seconds={left} />}
          </Timed>
        ) : null}
        <div className="grid gap-6 md:grid-cols-2">
          {options.map((o, i) => {
            const img = o.image_key ? props.media.imageUrl(o.image_key) : undefined;
            return (
              <article key={o.key} className="flex flex-col items-center rounded-xl border border-line bg-surface p-5 text-center">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <ArrowRightSquare className="size-6 text-accent" aria-hidden /> {o.title}
                </h3>
                {o.body ? <RichText text={o.body} className="mt-2 text-ink-2" /> : null}
                {o.bullets.length ? (
                  <ul className="mt-2 ml-5 list-disc space-y-1 text-left">
                    {o.bullets.map((b, j) => (
                      <li key={j}>{inline(b)}</li>
                    ))}
                  </ul>
                ) : null}
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={`Fotografía de la opción ${i + 1}`} className="mt-3 max-h-56 w-full rounded-md object-cover" />
                ) : null}
                <Button variant="exam" size="lg" className="mt-4" disabled={props.readOnly} onClick={() => choose(o)}>
                  Opción {i + 1}
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RichText text={part.instructions} className="space-y-2 text-lg leading-relaxed" />
      {optionCard}
      {phase === "read" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Timed seconds={part.read_seconds} onDone={() => setPhase(part.prep_seconds > 0 ? "prep" : "segments")}>
            {(left) => <PhaseCountdown label="Tiempo de lectura" seconds={left} />}
          </Timed>
          <Button variant="secondary" onClick={() => setPhase(part.prep_seconds > 0 ? "prep" : "segments")}>
            Continuar
          </Button>
        </div>
      ) : null}
      {phase === "prep" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Timed seconds={part.prep_seconds} onDone={() => setPhase("segments")}>
              {(left) => <PhaseCountdown label="Grabación automática en" seconds={left} />}
            </Timed>
            <Button variant="secondary" onClick={() => setPhase("segments")}>
              <Mic className="size-4" aria-hidden /> Grabar ahora
            </Button>
          </div>
          {part.notes ? (
            <div>
              <label htmlFor={`notes-${part.key}`} className="text-sm font-medium">
                Notas (solo para usted; no se evalúan)
              </label>
              <textarea
                id={`notes-${part.key}`}
                value={noteText}
                onChange={(e) => {
                  setNoteText(e.target.value);
                  props.onAnswer(`notes:${part.key}`, { text: e.target.value }, { debounceMs: 1500 });
                }}
                className="mt-1 min-h-28 w-full rounded-lg border border-line-strong bg-surface px-3 py-2"
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {phase === "segments" ? (
        <div className="space-y-4">
          {part.notes && noteText ? (
            <details className="rounded-lg border border-line bg-surface px-4 py-2 text-sm">
              <summary className="cursor-pointer font-medium">Mis notas</summary>
              <p className="mt-2 whitespace-pre-wrap text-ink-2">{noteText}</p>
            </details>
          ) : null}
          <SegmentList props={props} part={part} segments={segs} onAllDone={onFinished} />
        </div>
      ) : null}
    </div>
  );
}

function SegmentList({ props, part, segments, onAllDone }: { props: TaskRendererProps; part: OralPart; segments: OralSegment[]; onAllDone: () => void }) {
  const oral = props.oral!;
  const pendingIndex = segments.findIndex((s) => oral.recordings[recKey(part.key, s.key)]?.status !== "verified");
  const allDone = pendingIndex === -1;
  // solo al completar la última grabación: abrir una parte ya terminada para revisarla no debe cerrarla
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) onAllDone();
    wasDone.current = allDone;
  }, [allDone, onAllDone]);

  return (
    <ol className="space-y-3">
      {segments.map((s, i) => {
        const rec = oral.recordings[recKey(part.key, s.key)];
        const isCurrent = i === pendingIndex;
        return (
          <li key={s.key} className={cn("rounded-xl border px-4 py-4", isCurrent ? "border-orange bg-surface shadow-sm" : "border-line bg-surface/70")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{segments.length > 1 ? `Pregunta ${i + 1}` : "Su respuesta"}</p>
              {rec?.status === "verified" ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-ok">
                  <CheckCircle2 className="size-4" aria-hidden /> Grabación guardada en el servidor ({formatDuration(rec.duration_ms / 1000)})
                </span>
              ) : (
                <span className="text-sm text-ink-3">Hasta {formatDuration(s.record_seconds)} de grabación</span>
              )}
            </div>
            {rec?.local_url && rec.status === "verified" ? (
              <div className="mt-3">
                <RecordingPlayer src={rec.local_url} durationMs={rec.duration_ms} tone="orange" />
              </div>
            ) : null}
            {isCurrent && !props.readOnly ? (
              <SegmentRecorder key={s.key} props={props} part={part} segment={s} oral={oral} />
            ) : rec?.status === "verified" && oral.allowRerecord && !props.readOnly ? (
              <SegmentRecorder key={`${s.key}-redo`} props={props} part={part} segment={s} oral={oral} redo />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

type SegPhase = "prompt" | "wait" | "recording" | "uploading" | "saved" | "failed" | "mic_error" | "idle_redo" | "empty" | "silent";

const BUSY: SegPhase[] = ["recording", "uploading", "failed", "silent"];

function SegmentRecorder({ props, part, segment, oral, redo = false }: { props: TaskRendererProps; part: OralPart; segment: OralSegment; oral: OralApi; redo?: boolean }) {
  const rec = useRecorder();
  // al reanudar con el enunciado ya escuchado no se espera a que vuelva a sonar: se puede grabar directamente
  const [phase, setPhase] = useState<SegPhase>(() => {
    if (redo) return "idle_redo";
    return segment.prompt_audio_key && props.media.playsUsed(segment.prompt_audio_key) === 0 ? "prompt" : "wait";
  });
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ blob: Blob; durationMs: number } | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const stopping = useRef(false);
  const { upload: send, onBusyChange, onProblem, expired } = oral;

  const upload = useCallback(async () => {
    if (!pending.current) return;
    setPhase("uploading");
    setError(null);
    try {
      await send(part.key, segment.key, pending.current.blob, pending.current.durationMs);
      pending.current = null;
      setHasPending(false);
      setPhase("saved");
    } catch (err) {
      setError(errorMessage(err));
      setPhase("failed");
    }
  }, [send, part.key, segment.key]);

  const stopRecording = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    try {
      const result = await rec.stop();
      pending.current = result;
      setHasPending(true);
      if (result.peak != null && result.peak < SILENCE_PEAK) {
        onProblem?.("recording_silent", { part: part.key, segment: segment.key, peak: Number(result.peak.toFixed(3)) });
        setPhase("silent");
        return;
      }
      await upload();
    } catch (err) {
      if (err instanceof EmptyRecordingError) {
        onProblem?.("recording_empty", { part: part.key, segment: segment.key });
        setPhase("empty");
      } else {
        setError(errorMessage(err));
        setPhase("failed");
      }
    } finally {
      stopping.current = false;
    }
  }, [rec, upload, onProblem, part.key, segment.key]);

  const startRecording = useCallback(async () => {
    try {
      await rec.start();
      setPhase("recording");
    } catch {
      setPhase("mic_error");
    }
  }, [rec]);

  // una grabación en curso o sin subir bloquea el cambio de tarea
  const busy = BUSY.includes(phase);
  useEffect(() => {
    if (!busy) return;
    onBusyChange?.(true);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);

  // al agotarse el tiempo de la prueba se entrega lo grabado
  useEffect(() => {
    if (!expired) return;
    const id = window.setTimeout(() => {
      if (phase === "recording") void stopRecording();
      else if (phase === "silent") void upload();
    }, 0);
    return () => window.clearTimeout(id);
  }, [expired, phase, stopRecording, upload]);

  // reintento automático de la subida: al volver la conexión y cada pocos segundos
  useEffect(() => {
    if (phase !== "failed") return;
    const onOnline = () => void upload();
    window.addEventListener("online", onOnline);
    const retry = window.setInterval(() => {
      if (navigator.onLine) void upload();
    }, 10_000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(retry);
    };
  }, [phase, upload]);

  const prompt = segment.prompt_audio_key ? (
    <PromptAudio media={props.media} mediaKey={segment.prompt_audio_key} autoPlay={phase === "prompt"} onEnded={() => setPhase((p) => (p === "prompt" ? "wait" : p))} />
  ) : segment.prompt_text ? (
    <p className="text-lg font-medium">{inline(segment.prompt_text)}</p>
  ) : null;

  return (
    <div className="mt-3 space-y-3">
      {prompt}
      {phase === "idle_redo" ? (
        <Button variant="ghost" size="sm" onClick={() => setPhase("wait")}>
          <RotateCcw className="size-4" aria-hidden /> Repetir grabación (práctica)
        </Button>
      ) : null}
      {phase === "wait" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Timed seconds={segment.wait_seconds} onDone={() => void startRecording()}>
            {(left) => <PhaseCountdown label="La grabación empieza automáticamente en" seconds={left} />}
          </Timed>
          <Button variant="exam" onClick={() => void startRecording()}>
            <Mic className="size-4" aria-hidden /> Grabar
          </Button>
        </div>
      ) : null}
      {phase === "recording" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-lg bg-danger-soft px-4 py-3">
            <span className="rec-dot size-3.5 rounded-full bg-danger" aria-hidden />
            <span className="font-semibold text-danger" role="status">
              Grabando · quedan{" "}
              <Timed seconds={segment.record_seconds} onDone={() => void stopRecording()}>
                {(left) => <span className="tabular-nums">{formatDuration(left)}</span>}
              </Timed>
            </span>
            <div className="h-2 w-28 overflow-hidden rounded-full bg-white/70" role="meter" aria-label="Nivel del micrófono" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.level * 100)}>
              <div className="h-full bg-danger transition-[width]" style={{ width: `${Math.round(rec.level * 100)}%` }} />
            </div>
            <Button variant="danger" className="ml-auto" onClick={() => void stopRecording()}>
              <Square className="size-4" aria-hidden /> Terminar la grabación
            </Button>
          </div>
          {rec.noSignal ? (
            <Alert tone="danger" title="El micrófono no está enviando sonido">
              <p>Revise que esté conectado y sin silenciar. Cuando lo haya resuelto, vuelva a empezar esta grabación.</p>
              <Button
                className="mt-2"
                size="sm"
                variant="secondary"
                onClick={() => {
                  rec.cancel();
                  setPhase("wait");
                }}
              >
                <RotateCcw className="size-4" aria-hidden /> Volver a empezar
              </Button>
            </Alert>
          ) : null}
        </div>
      ) : null}
      {phase === "uploading" ? (
        <p className="flex items-center gap-2 text-ink-2" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Subiendo y verificando la grabación…
        </p>
      ) : null}
      {phase === "failed" ? (
        <Alert tone="danger" title="La grabación no se ha guardado todavía">
          <p>{error}</p>
          <p className="mt-1">La grabación se conserva en esta pantalla y se reintenta sola. No cierre la página.</p>
          <Button className="mt-2" size="sm" onClick={() => void upload()} disabled={!hasPending}>
            <UploadCloud className="size-4" aria-hidden /> Reintentar la subida
          </Button>
        </Alert>
      ) : null}
      {phase === "empty" ? (
        <Alert tone="danger" title="No se ha grabado nada: el micrófono no envió sonido">
          <p>Esta grabación no se ha enviado. Compruebe que el micrófono esté conectado y sin silenciar, y que Windows permita usarlo a las aplicaciones de escritorio.</p>
          <Button className="mt-2" size="sm" onClick={() => setPhase("wait")}>
            <MicOff className="size-4" aria-hidden /> Volver a grabar
          </Button>
        </Alert>
      ) : null}
      {phase === "silent" ? (
        <Alert tone="warn" title="Apenas se ha captado sonido">
          <p>Es posible que el micrófono esté silenciado o demasiado lejos. Puede repetir la grabación o enviarla tal como está.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                pending.current = null;
                setHasPending(false);
                setPhase("wait");
              }}
            >
              <RotateCcw className="size-4" aria-hidden /> Volver a grabar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => void upload()}>
              <UploadCloud className="size-4" aria-hidden /> Enviar así
            </Button>
          </div>
        </Alert>
      ) : null}
      {phase === "mic_error" ? (
        <Alert tone="danger" title="No se puede usar el micrófono">
          <p>{rec.error}</p>
          <ul className="mt-2 ml-5 list-disc">
            <li>Permita el micrófono para este sitio y pulse «Volver a intentar».</li>
            <li>Si no es posible, cierre esta pestaña y continúe desde otro dispositivo: sus respuestas ya están guardadas en el servidor y el intento se reanuda donde lo dejó.</li>
          </ul>
          <Button className="mt-2" size="sm" onClick={() => setPhase("wait")}>
            Volver a intentar
          </Button>
        </Alert>
      ) : null}
    </div>
  );
}
