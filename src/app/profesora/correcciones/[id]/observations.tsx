"use client";

import { useTransition } from "react";
import { Clock, Trash2 } from "lucide-react";
import { categoryLabel } from "@/lib/diagnosis/taxonomy";
import { formatDuration } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";
import { deleteFeedback } from "../../actions";
import type { Feedback } from "./grading-model";

const DOT = { error: "bg-danger", strength: "bg-ok", suggestion: "bg-warn" };
const KIND = { error: "A corregir", strength: "Acierto", suggestion: "Sugerencia" };

/** Observaciones de la tarea. En las orales, pulsar una lleva a ese momento de la grabación. */
export function Observations({
  attemptId,
  feedback,
  readOnly,
  emptyHint,
  onSeek,
  isOutdated,
}: {
  attemptId: string;
  feedback: Feedback[];
  readOnly: boolean;
  emptyHint: string;
  onSeek?: (f: Feedback) => void;
  /** comentarios hechos sobre un audio que el estudiante ya ha vuelto a grabar */
  isOutdated?: (f: Feedback) => boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <section aria-label="Observaciones">
      <h3 className="font-semibold text-ink">
        Observaciones <span className="font-normal text-ink-3 tabular-nums">({feedback.length})</span>
      </h3>
      {feedback.length === 0 ? (
        <p className="mt-1 text-sm text-ink-3">{emptyHint}</p>
      ) : (
        <ol className="mt-2 space-y-2">
          {feedback.map((f, i) => (
            <li key={f.id} className="flex gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
              <span className="mt-1.5 flex flex-col items-center gap-1">
                <span className={cn("size-2.5 rounded-full", DOT[f.kind])} aria-hidden />
                <span className="text-xs font-medium text-ink-3 tabular-nums">{i + 1}</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-2">
                  <span className="font-medium text-ink">{KIND[f.kind]}</span>
                  <span>· {categoryLabel(f.category)}</span>
                  {f.is_systematic ? <span className="font-medium text-danger">· Se repite</span> : null}
                  {f.audio_ms != null && isOutdated?.(f) ? (
                    <span className="text-ink-3">· Sobre la grabación anterior</span>
                  ) : f.audio_ms != null ? (
                    <button type="button" onClick={() => onSeek?.(f)} className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-ink tabular-nums hover:bg-surface-3">
                      <Clock className="size-3" aria-hidden /> {formatDuration(f.audio_ms / 1000)}
                    </button>
                  ) : null}
                </p>
                {f.quote ? <p className="mt-1 font-reading italic">«{f.quote}»</p> : null}
                {f.correction ? <p className="mt-0.5">→ {f.correction}</p> : null}
                {f.explanation ? <p className="mt-0.5 text-ink-2">{f.explanation}</p> : null}
                {f.improved_example ? <p className="mt-0.5 text-ink-2">Mejor: «{f.improved_example}»</p> : null}
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  disabled={pending}
                  className="h-8 shrink-0 rounded p-1 text-ink-3 hover:bg-surface-2 hover:text-danger"
                  aria-label={`Eliminar la observación ${i + 1}`}
                  onClick={() => start(async () => void (await deleteFeedback(attemptId, f.id)))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
