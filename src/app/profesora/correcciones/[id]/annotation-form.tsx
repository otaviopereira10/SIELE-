"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { AREA_LABEL, CATEGORIES, type CategoryArea } from "@/lib/diagnosis/taxonomy";
import { formatDuration } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";
import { addFeedback } from "../../actions";

export type FeedbackKind = "error" | "strength" | "suggestion";

export interface AnnotationDraft {
  quote: string;
  charStart: number | null;
  charEnd: number | null;
  recordingId: string | null;
  audioMs: number | null;
  kind?: FeedbackKind;
}

const KINDS: { key: FeedbackKind; label: string; on: string }[] = [
  { key: "error", label: "A corregir", on: "border-danger bg-danger text-white" },
  { key: "suggestion", label: "Sugerencia", on: "border-warn bg-warn text-white" },
  { key: "strength", label: "Acierto", on: "border-ok bg-ok text-white" },
];

/** Observación docente sobre un fragmento del texto o un momento del audio. Lo esencial primero; el resto, plegado. */
export function AnnotationForm({
  attemptId,
  taskId,
  skill,
  criteria,
  draft,
  onDone,
  initial,
}: {
  attemptId: string;
  taskId: string;
  skill: "writing" | "speaking";
  criteria: { key: string; label: string }[];
  draft: AnnotationDraft;
  onDone: () => void;
  initial?: Partial<{ kind: FeedbackKind; category: string; explanation: string; correction: string; improved: string }>;
}) {
  const [kind, setKind] = useState<FeedbackKind>(initial?.kind ?? draft.kind ?? "error");
  // sin valor por defecto: una categoría puesta por descuido falsearía el diagnóstico del estudiante
  const [category, setCategory] = useState(initial?.category ?? "");
  const [criterion, setCriterion] = useState<string>(CATEGORIES.find((c) => c.key === (initial?.category ?? category))?.criterion ?? "");
  const [quote, setQuote] = useState(draft.quote);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [correction, setCorrection] = useState(initial?.correction ?? "");
  const [improved, setImproved] = useState(initial?.improved ?? "");
  const [systematic, setSystematic] = useState(false);
  const [severity, setSeverity] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = (Object.entries(AREA_LABEL) as [CategoryArea, string][]).filter(([area]) => CATEGORIES.some((c) => c.area === area && c.skills.includes(skill)));
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const save = () =>
    start(async () => {
      setError(null);
      const quoteChanged = quote !== draft.quote;
      try {
        const res = await addFeedback({
          attemptId,
          taskId,
          kind,
          category,
          criterionKey: criteria.some((c) => c.key === criterion) ? criterion : null,
          quote,
          charStart: quoteChanged ? null : draft.charStart,
          charEnd: quoteChanged ? null : draft.charEnd,
          recordingId: draft.recordingId,
          audioMs: draft.audioMs,
          explanation,
          correction,
          improvedExample: improved,
          isSystematic: systematic,
          severity,
        });
        if (!res?.ok) setError(res?.error ?? "No se pudo guardar.");
        else onDone();
      } catch {
        setError("Sin conexión con el servidor. Inténtelo de nuevo.");
      }
    });

  return (
    <div ref={box} className="space-y-3 rounded-2xl border border-brand/30 bg-brand-soft/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{draft.audioMs != null ? `Observación en el minuto ${formatDuration(draft.audioMs / 1000)}` : "Nueva observación"}</p>
        <div className="flex gap-1" role="radiogroup" aria-label="Tipo de observación">
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              onClick={() => setKind(k.key)}
              className={cn("h-9 rounded-lg border px-3 text-sm font-medium transition-colors", kind === k.key ? k.on : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2")}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      {draft.recordingId ? (
        <Field label="Lo que dice el estudiante (opcional)" htmlFor="fb-quote">
          <Input id="fb-quote" value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Transcriba la frase si ayuda a entender la observación" />
        </Field>
      ) : (
        <blockquote className="rounded-lg border-l-4 border-brand/40 bg-surface px-3 py-2 font-reading text-[0.98rem]">{quote || "Sin fragmento seleccionado"}</blockquote>
      )}
      <div className={cn("grid gap-3", kind !== "strength" && "sm:grid-cols-2")}>
        <Field label="Tipo de error o aspecto" htmlFor="fb-category">
          <Select
            id="fb-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCriterion(CATEGORIES.find((c) => c.key === e.target.value)?.criterion ?? "");
            }}
          >
            <option value="" disabled>
              Elija una opción
            </option>
            {groups.map(([area, label]) => (
              <optgroup key={area} label={label}>
                {CATEGORIES.filter((c) => c.area === area && c.skills.includes(skill)).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        {kind !== "strength" ? (
          <Field label="Forma correcta" htmlFor="fb-correction">
            <Input id="fb-correction" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Cómo debería decirse" />
          </Field>
        ) : null}
      </div>
      <Field label={kind === "strength" ? "Por qué funciona bien" : "Explicación para el estudiante"} htmlFor="fb-expl">
        <Textarea id="fb-expl" value={explanation} onChange={(e) => setExplanation(e.target.value)} className="min-h-[4.5rem]" />
      </Field>
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-2 hover:text-ink">Más detalles (criterio, versión mejorada, gravedad)</summary>
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Criterio de la rúbrica" htmlFor="fb-criterion">
              <Select id="fb-criterion" value={criterion} onChange={(e) => setCriterion(e.target.value)}>
                <option value="">Ninguno</option>
                {criteria.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            {kind !== "strength" ? (
              <Field label="Versión mejorada de la frase" htmlFor="fb-improved">
                <Input id="fb-improved" value={improved} onChange={(e) => setImproved(e.target.value)} placeholder="Ejemplo más natural" />
              </Field>
            ) : null}
          </div>
          {kind === "error" ? (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="size-4" checked={systematic} onChange={(e) => setSystematic(e.target.checked)} />
                Se repite (error sistemático)
              </label>
              <label className="flex items-center gap-2">
                Gravedad
                <select value={severity} onChange={(e) => setSeverity(Number(e.target.value))} className="min-h-9 rounded-md border border-line-strong bg-surface px-2">
                  <option value={1}>Leve: no afecta a la comprensión</option>
                  <option value={2}>Media</option>
                  <option value={3}>Alta: dificulta la comprensión</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      </details>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={pending || !category}>
          {pending ? "Guardando…" : "Guardar observación"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
