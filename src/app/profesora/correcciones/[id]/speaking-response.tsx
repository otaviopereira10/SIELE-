"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { MicOff } from "lucide-react";
import { RecordingPlayer, type RecordingPlayerHandle } from "@/components/audio/recording-player";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge, RichText, inline } from "@/components/ui/primitives";
import type { GradingData } from "@/lib/data/teacher";
import { formatDuration } from "@/lib/exam/skills";
import { saveTranscript } from "../../actions";
import { hasResponse, isOutdatedMarker, speakingItems, type Feedback, type GradingRecording, type GradingTask, type SpeakingItem } from "./grading-model";

/** Respuesta oral: cada pregunta junto a su grabación, en el orden en que se hizo. */
export function SpeakingResponse({
  data,
  task,
  feedback,
  readOnly,
  urls,
  players,
  onMark,
  renderForm,
  onRequestRecording,
}: {
  data: GradingData;
  task: GradingTask;
  feedback: Feedback[];
  readOnly: boolean;
  urls: Record<string, string>;
  players: React.RefObject<Record<string, RecordingPlayerHandle | null>>;
  onMark: (recordingId: string, ms: number) => void;
  /** Formulario de observación abierto para esta grabación. */
  renderForm: (recordingId: string) => ReactNode;
  onRequestRecording: () => void;
}) {
  const { parts, items, orphans } = speakingItems(data, task);

  const player = (rec: GradingRecording) => (
    <RecordingPlayer
      ref={(el) => {
        players.current[rec.id] = el;
      }}
      src={urls[rec.id]}
      sizeBytes={rec.size_bytes}
      durationMs={rec.duration_ms}
      markers={feedback.filter((f) => f.recording_id === rec.id && f.audio_ms != null && !isOutdatedMarker(f, rec)).map((f) => ({ id: f.id, ms: f.audio_ms as number, kind: f.kind, label: f.correction || f.explanation || f.quote || "Observación" }))}
      onMark={readOnly ? undefined : (ms) => onMark(rec.id, ms)}
      emptyAction={
        // si toda la tarea está vacía, el aviso de arriba ya ofrece la acción
        !readOnly && hasResponse(data, task) ? (
          <Button size="sm" variant="secondary" onClick={onRequestRecording}>
            Pedir que vuelva a grabar
          </Button>
        ) : null
      }
    />
  );

  return (
    <div className="space-y-5">
      {parts.map((part, partIndex) => {
        const partItems = items.filter((i) => i.partIndex === partIndex);
        const first = partItems[0];
        return (
          <article key={part.key} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
            {parts.length > 1 ? <h3 className="mb-1 font-semibold text-ink">{part.title ?? `Situación ${partIndex + 1}`}</h3> : null}
            <details className="text-sm text-ink-2">
              <summary className="cursor-pointer hover:text-ink">Ver la consigna</summary>
              <RichText text={part.instructions} className="mt-1 space-y-1" />
            </details>
            {first?.option ? <ChosenOption item={first} /> : part.choice ? <p className="mt-2 text-sm text-ink-3">El estudiante no llegó a elegir ninguna opción en esta parte.</p> : null}
            {first?.option || !part.choice ? (
              <ol className="mt-4 space-y-5">
                {partItems.map((item) => (
                  <li key={item.segment.key}>
                    <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-medium text-ink">{item.segmentTotal > 1 ? `Pregunta ${item.segmentIndex + 1}` : "Respuesta"}</p>
                      {item.segment.record_seconds ? <p className="text-xs text-ink-3">Hasta {formatDuration(item.segment.record_seconds)}</p> : null}
                    </div>
                    {item.segment.prompt_text ? <p className="mb-2 text-sm text-ink-2">{inline(item.segment.prompt_text)}</p> : null}
                    {item.recording && item.recording.status === "verified" ? (
                      <div className="space-y-2">
                        {player(item.recording)}
                        {renderForm(item.recording.id)}
                        {item.recording.size_bytes >= 512 ? <Transcript attemptId={data.attempt.id} recording={item.recording} readOnly={readOnly} /> : null}
                      </div>
                    ) : item.recording ? (
                      <Missing text="Se ha pedido una nueva grabación: el estudiante todavía no la ha enviado." />
                    ) : (
                      <Missing text="El estudiante no grabó esta pregunta." />
                    )}
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        );
      })}
      {orphans.filter((r) => r.status === "verified").length ? (
        <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h3 className="mb-2 font-semibold text-ink">Otras grabaciones de esta tarea</h3>
          <div className="space-y-3">
            {orphans
              .filter((r) => r.status === "verified")
              .map((r) => (
                <div key={r.id} className="space-y-2">
                  {player(r)}
                  {renderForm(r.id)}
                </div>
              ))}
          </div>
        </article>
      ) : null}
      {task.transcript ? (
        <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Guion de las preguntas grabadas</summary>
          <p className="mt-2 whitespace-pre-wrap text-ink-2">{task.transcript}</p>
        </details>
      ) : null}
      {task.teacher_notes ? (
        <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Notas para la evaluación</summary>
          <p className="mt-2 whitespace-pre-wrap text-ink-2">{task.teacher_notes}</p>
        </details>
      ) : null}
    </div>
  );
}

function ChosenOption({ item }: { item: SpeakingItem }) {
  const option = item.option;
  if (!option) return null;
  return (
    <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <p className="font-medium text-ink">
        Opción elegida: {option.title} {item.autoAssigned ? <Badge tone="warn">asignada al agotarse el tiempo</Badge> : null}
      </p>
      {option.body || option.bullets?.length ? (
        <details className="mt-0.5 text-ink-2">
          <summary className="cursor-pointer hover:text-ink">Ver el enunciado de esta opción</summary>
          {option.body ? <RichText text={option.body} className="mt-1" /> : null}
          {option.bullets?.length ? (
            <ul className="mt-1 ml-5 list-disc">
              {option.bullets.map((b, i) => (
                <li key={i}>{inline(b)}</li>
              ))}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}

function Missing({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">
      <MicOff className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

function Transcript({ attemptId, recording, readOnly }: { attemptId: string; recording: GradingRecording; readOnly: boolean }) {
  const [text, setText] = useState(recording.teacher_transcript ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [, start] = useTransition();
  const lastSaved = useRef(recording.teacher_transcript ?? "");
  if (readOnly && !text) return null;
  return (
    <details className="text-sm" open={Boolean(text)}>
      <summary className="cursor-pointer text-ink-3 hover:text-ink">Transcripción (opcional)</summary>
      <Textarea
        className="mt-1 min-h-20 text-sm"
        value={text}
        readOnly={readOnly}
        aria-label="Transcripción de la grabación"
        placeholder="La plataforma no transcribe automáticamente: se guarda al salir de este campo."
        onChange={(e) => {
          setText(e.target.value);
          setStatus("idle");
        }}
        onBlur={() => {
          if (text === lastSaved.current) return;
          start(async () => {
            const res = await saveTranscript(attemptId, recording.id, text).catch(() => null);
            if (res?.ok) lastSaved.current = text;
            setStatus(res?.ok ? "saved" : "error");
          });
        }}
      />
      {status === "saved" ? <p className="text-xs text-ok">Transcripción guardada.</p> : null}
      {status === "error" ? <p className="text-xs text-danger">No se pudo guardar. Vuelva a intentarlo.</p> : null}
    </details>
  );
}
