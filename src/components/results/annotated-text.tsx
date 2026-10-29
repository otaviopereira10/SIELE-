import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface Annotation {
  id: string | number;
  quote: string;
  char_start?: number | null;
  char_end?: number | null;
  kind: "strength" | "error" | "suggestion";
}

interface Range {
  start: number;
  end: number;
  index: number;
  kind: Annotation["kind"];
}

/** Localiza cada evidencia en el texto: primero por posición guardada; si no coincide, por la cita. */
export function locate(text: string, annotations: Annotation[]): Range[] {
  const ranges: Range[] = [];
  annotations.forEach((a, index) => {
    let start = -1;
    let end = -1;
    if (a.char_start != null && a.char_end != null && a.char_end <= text.length && text.slice(a.char_start, a.char_end) === a.quote) {
      start = a.char_start;
      end = a.char_end;
    } else if (a.quote) {
      start = text.indexOf(a.quote);
      end = start >= 0 ? start + a.quote.length : -1;
    }
    if (start >= 0 && end > start && !ranges.some((r) => start < r.end && end > r.start)) {
      ranges.push({ start, end, index, kind: a.kind });
    }
  });
  return ranges.sort((a, b) => a.start - b.start);
}

const markTone = {
  error: "bg-danger-soft decoration-danger",
  strength: "bg-ok-soft decoration-ok",
  suggestion: "bg-warn-soft decoration-warn",
};

/** Texto del estudiante con las evidencias resaltadas y numeradas. */
export function AnnotatedText({ text, annotations, className }: { text: string; annotations: Annotation[]; className?: string }) {
  const ranges = locate(text, annotations);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, r.start)}</Fragment>);
    parts.push(
      <mark key={`m${r.start}`} className={cn("rounded px-0.5 text-ink underline decoration-2 underline-offset-4", markTone[r.kind])}>
        {text.slice(r.start, r.end)}
        <sup data-ignore="" className="ml-0.5 font-sans text-[0.7rem] font-semibold">{r.index + 1}</sup>
      </mark>,
    );
    cursor = r.end;
  }
  if (cursor < text.length) parts.push(<Fragment key="end">{text.slice(cursor)}</Fragment>);
  return <div className={cn("reading-text whitespace-pre-wrap", className)}>{parts}</div>;
}
