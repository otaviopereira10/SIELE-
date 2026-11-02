"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnnotatedText } from "@/components/results/annotated-text";
import { RichText, inline } from "@/components/ui/primitives";
import type { GradingData } from "@/lib/data/teacher";
import type { WritingContent } from "@/lib/exam/content-schema";
import { normalizeTaskContent } from "@/lib/exam/normalize";
import { countWords, wordRangeStatus } from "@/lib/exam/words";
import { cn, formatDateTime } from "@/lib/utils";
import type { AnnotationDraft, FeedbackKind } from "./annotation-form";
import type { Feedback, GradingTask } from "./grading-model";

/** Posición de la selección dentro del texto original (ignora los números de las marcas). */
function selectionOffsets(container: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let start = -1;
  let end = -1;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.parentElement as HTMLElement | null)?.closest("[data-ignore]")) continue;
    const len = n.textContent?.length ?? 0;
    if (n === range.startContainer) start = pos + range.startOffset;
    if (n === range.endContainer) end = pos + range.endOffset;
    pos += len;
  }
  return start >= 0 && end > start ? { start, end } : null;
}

const QUICK: { kind: FeedbackKind; label: string; dot: string }[] = [
  { kind: "error", label: "A corregir", dot: "bg-danger" },
  { kind: "suggestion", label: "Sugerencia", dot: "bg-warn" },
  { kind: "strength", label: "Acierto", dot: "bg-ok" },
];

/** Respuesta escrita: al seleccionar un fragmento aparece una barra para comentarlo. */
export function WritingResponse({
  data,
  task,
  feedback,
  readOnly,
  onAnnotate,
  form,
}: {
  data: GradingData;
  task: GradingTask;
  feedback: Feedback[];
  readOnly: boolean;
  onAnnotate: (draft: AnnotationDraft) => void;
  form: ReactNode;
}) {
  const response = data.responses.find((r) => r.task_id === task.id && r.item_key === "text");
  const payload = response?.payload as { text?: string; option_key?: string | null } | undefined;
  const text = payload?.text ?? "";
  const c = normalizeTaskContent("writing", task.content) as unknown as WritingContent;
  const option = c.options?.find((o) => o.key === payload?.option_key);
  const bullets = option?.bullets ?? c.bullets ?? [];
  const stimulus = option?.stimulus ?? c.stimulus;
  const min = option?.word_min ?? c.word_min;
  const max = option?.word_max ?? c.word_max;
  const words = countWords(text);
  const range = wordRangeStatus(words, min, max);
  const revisions = data.revisions.filter((r) => r.response_id === response?.id);

  const textRef = useRef<HTMLDivElement | null>(null);
  const [bar, setBar] = useState<{ top: number; left: number; quote: string; start: number; end: number } | null>(null);

  const capture = () => {
    if (readOnly || !textRef.current) return;
    const off = selectionOffsets(textRef.current);
    const quote = off ? text.slice(off.start, off.end) : "";
    if (!off || !quote.trim()) return setBar(null);
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    const box = textRef.current.getBoundingClientRect();
    setBar({ top: rect.top - box.top - 46, left: Math.max(0, Math.min(rect.left - box.left, box.width - 290)), quote, start: off.start, end: off.end });
  };

  useEffect(() => {
    const clear = () => {
      if (window.getSelection()?.isCollapsed) setBar(null);
    };
    document.addEventListener("selectionchange", clear);
    return () => document.removeEventListener("selectionchange", clear);
  }, []);

  return (
    <div className="space-y-4">
      <details className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm sm:px-5">
        <summary className="cursor-pointer font-medium text-ink">
          Enunciado{option ? ` · opción elegida: ${option.title}` : ""}
        </summary>
        <div className="mt-2 space-y-2 text-ink-2">
          <RichText text={option?.instructions ?? task.instructions} className="space-y-1" />
          {bullets.length ? (
            <ol className="ml-5 list-decimal space-y-0.5">
              {bullets.map((b, i) => (
                <li key={i}>{inline(b)}</li>
              ))}
            </ol>
          ) : null}
          {stimulus ? (
            <div className="rounded-lg bg-surface-2 p-3">
              {stimulus.title ? <p className="font-semibold text-ink">{stimulus.title}</p> : null}
              <RichText text={stimulus.body} className="space-y-1" />
            </div>
          ) : null}
          {task.teacher_notes ? <p className="rounded-lg bg-brand-soft px-3 py-2">{task.teacher_notes}</p> : null}
        </div>
      </details>

      <article className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <p className="font-semibold text-ink">
            <span className={cn("tabular-nums", range === "within" ? "text-ok" : range === "below" ? "text-warn" : range === "above" ? "text-danger" : "text-ink")}>{words} palabras</span>
            {min || max ? <span className="font-normal text-ink-3"> · recomendado {min}–{max}</span> : null}
          </p>
          <p className="text-ink-3">Última modificación: {formatDateTime(response?.updated_at)}</p>
        </div>
        {text.trim() ? (
          <>
            {!readOnly ? <p className="mb-2 text-sm text-ink-3">Seleccione cualquier fragmento para comentarlo.</p> : null}
            <div className="relative" ref={textRef} onMouseUp={capture} onTouchEnd={() => window.setTimeout(capture, 50)}>
              <AnnotatedText text={text} annotations={feedback.map((f) => ({ id: f.id, quote: f.quote, char_start: f.char_start, char_end: f.char_end, kind: f.kind }))} />
              {bar ? (
                <div role="toolbar" aria-label="Comentar el fragmento seleccionado" className="absolute z-10 flex gap-1 rounded-xl bg-ink p-1 shadow-lg" style={{ top: Math.max(-46, bar.top), left: bar.left }} onMouseDown={(e) => e.preventDefault()}>
                  {QUICK.map((q) => (
                    <button
                      key={q.kind}
                      type="button"
                      onClick={() => {
                        onAnnotate({ quote: bar.quote, charStart: bar.start, charEnd: bar.end, recordingId: null, audioMs: null, kind: q.kind });
                        setBar(null);
                        window.getSelection()?.removeAllRanges();
                      }}
                      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap text-white hover:bg-white/15"
                    >
                      <span className={cn("size-2 rounded-full", q.dot)} aria-hidden /> {q.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-ink-3">El estudiante no escribió ningún texto en esta tarea.</p>
        )}
      </article>
      {form}

      {revisions.length > 1 ? (
        <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium">Versiones anteriores ({revisions.length})</summary>
          <ol className="mt-2 space-y-2">
            {revisions.map((r) => (
              <li key={r.id} className="rounded-lg bg-surface-2 p-2">
                <p className="text-xs text-ink-3">
                  {formatDateTime(r.saved_at)} · {r.word_count} palabras · {r.kind === "resubmission" ? "nueva entrega" : r.kind === "final" ? "entrega final" : "borrador"}
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{(r.payload as { text?: string }).text}</p>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}
