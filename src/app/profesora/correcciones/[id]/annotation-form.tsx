"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { AREA_LABEL, CATEGORIES, type CategoryArea } from "@/lib/diagnosis/taxonomy";
import { formatDuration } from "@/lib/exam/skills";
import { addFeedback } from "../../actions";

export interface AnnotationDraft {
  quote: string;
  charStart: number | null;
  charEnd: number | null;
  recordingId: string | null;
  audioMs: number | null;
}

/** Formulario de observación docente: evidencia, explicación, corrección y versión mejorada. */
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
  initial?: Partial<{ kind: "error" | "strength" | "suggestion"; category: string; explanation: string; correction: string; improved: string }>;
}) {
  const [kind, setKind] = useState<"error" | "strength" | "suggestion">(initial?.kind ?? "error");
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES.find((c) => c.skills.includes(skill))?.key ?? CATEGORIES[0].key);
  const [criterion, setCriterion] = useState<string>(CATEGORIES.find((c) => c.key === (initial?.category ?? category))?.criterion ?? "");
  const [quote, setQuote] = useState(draft.quote);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [correction, setCorrection] = useState(initial?.correction ?? "");
  const [improved, setImproved] = useState(initial?.improved ?? "");
  const [systematic, setSystematic] = useState(false);
  const [severity, setSeverity] = useState(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const groups = Object.entries(AREA_LABEL) as [CategoryArea, string][];

  const save = () =>
    start(async () => {
      setError(null);
      const quoteChanged = quote !== draft.quote;
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
    });

  return (
    <div className="space-y-3 rounded-xl border border-brand/30 bg-brand-soft/60 p-4">
      <p className="text-sm font-semibold">
        Nueva observación{draft.audioMs != null ? ` en ${formatDuration(draft.audioMs / 1000)}` : ""}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de observación">
        {(
          [
            ["error", "Error / a mejorar"],
            ["strength", "Acierto"],
            ["suggestion", "Sugerencia"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-10 rounded-lg border px-3 text-sm ${kind === k ? "border-brand bg-brand text-white" : "border-line-strong bg-surface"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Categoría" htmlFor="fb-category">
          <Select
            id="fb-category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCriterion(CATEGORIES.find((c) => c.key === e.target.value)?.criterion ?? "");
            }}
          >
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
        <Field label="Criterio de la rúbrica" htmlFor="fb-criterion">
          <Select id="fb-criterion" value={criterion} onChange={(e) => setCriterion(e.target.value)}>
            <option value="">—</option>
            {criteria.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Evidencia (cita literal)" htmlFor="fb-quote" hint={draft.recordingId ? "Opcional: lo que dice el estudiante en ese momento." : "Seleccionada en el texto; puede ajustarla."}>
        <Input id="fb-quote" value={quote} onChange={(e) => setQuote(e.target.value)} />
      </Field>
      {kind !== "strength" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cómo corregirlo" htmlFor="fb-correction">
            <Input id="fb-correction" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Forma correcta" />
          </Field>
          <Field label="Versión mejorada de la frase" htmlFor="fb-improved">
            <Input id="fb-improved" value={improved} onChange={(e) => setImproved(e.target.value)} placeholder="Ejemplo más natural" />
          </Field>
        </div>
      ) : null}
      <Field label={kind === "strength" ? "Por qué funciona bien" : "Por qué (explicación para el estudiante)"} htmlFor="fb-expl">
        <Textarea id="fb-expl" value={explanation} onChange={(e) => setExplanation(e.target.value)} className="min-h-20" />
      </Field>
      {kind === "error" ? (
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={systematic} onChange={(e) => setSystematic(e.target.checked)} />
            Error sistemático (se repite)
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
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar observación"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
