"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, Circle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { cn, formatNumber } from "@/lib/utils";
import { saveEvaluation } from "../../actions";

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  description: string;
  focus?: string[];
  bands: { band: number; summary: string }[];
}

export interface EvaluationState {
  scores: Record<string, { band: number | null; comment: string }>;
  globalComment: string;
  strengths: string;
  priorities: string;
  nextSteps: string;
}

/**
 * Rúbrica de 0 a 5 por criterio con descriptores, comentarios y campos de retroalimentación.
 * Calcula en vivo el porcentaje pedagógico y los puntos según la tabla configurada; el servidor
 * recalcula y guarda los valores definitivos.
 */
export function RubricPanel({
  attemptId,
  taskId,
  taskPosition,
  criteria,
  pointsTable,
  rubricTitle,
  verification,
  initial,
  status,
  readOnly,
  externalBand,
  onDirtyChange,
}: {
  attemptId: string;
  taskId: string;
  taskPosition: number;
  criteria: RubricCriterion[];
  pointsTable: Record<string, Record<string, number[]>>;
  rubricTitle: string;
  verification: string;
  initial: EvaluationState;
  status: { status: string | null; points: number | null; max: number | null; percent: number | null; updatedAt: string | null };
  readOnly: boolean;
  externalBand?: { criterion: string; band: number; nonce: number } | null;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [state, setState] = useState<EvaluationState>(initial);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  // aplicar una banda sugerida (IA) cuando cambia: estado derivado durante el renderizado
  const [appliedNonce, setAppliedNonce] = useState<number | null>(null);
  if (externalBand && externalBand.nonce !== appliedNonce) {
    setAppliedNonce(externalBand.nonce);
    setState((s) => ({ ...s, scores: { ...s.scores, [externalBand.criterion]: { ...(s.scores[externalBand.criterion] ?? { comment: "" }), band: externalBand.band } } }));
    setDirty(true);
  }

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const table = pointsTable[String(taskPosition)] ?? pointsTable["*"] ?? {};
  const preview = (() => {
    const complete = criteria.every((c) => state.scores[c.key]?.band != null);
    const totalWeight = criteria.reduce((s, c) => s + c.weight, 0);
    const pct = complete ? (criteria.reduce((s, c) => s + ((state.scores[c.key].band as number) / 5) * c.weight, 0) / totalWeight) * 100 : null;
    const pts = complete ? criteria.reduce((s, c) => s + (table[c.key]?.[state.scores[c.key].band as number] ?? 0), 0) : null;
    const max = criteria.reduce((s, c) => s + (table[c.key]?.[5] ?? 0), 0);
    return { complete, pct, pts, max, done: criteria.filter((c) => state.scores[c.key]?.band != null).length };
  })();

  const update = (fn: (s: EvaluationState) => EvaluationState) => {
    setState(fn);
    setDirty(true);
    setMessage(null);
  };

  const save = () =>
    start(async () => {
      const res = await saveEvaluation({
        attemptId,
        taskId,
        scores: criteria.map((c) => ({ criterion: c.key, band: state.scores[c.key]?.band ?? null, comment: state.scores[c.key]?.comment ?? "" })),
        globalComment: state.globalComment,
        strengths: state.strengths,
        priorities: state.priorities,
        nextSteps: state.nextSteps,
      });
      if (res?.ok) {
        setDirty(false);
        setMessage({ ok: true, text: "Borrador guardado. Puede seguir más tarde: nada se publica hasta que pulse «Publicar resultados»." });
      } else setMessage({ ok: false, text: res?.error ?? "No se pudo guardar." });
    });

  const checklist = [
    { label: "Todos los criterios tienen banda", ok: preview.complete },
    { label: "Comentario en cada criterio", ok: criteria.every((c) => (state.scores[c.key]?.comment ?? "").trim().length > 0) },
    { label: "Lo que hizo bien", ok: state.strengths.trim().length > 0 },
    { label: "Errores prioritarios", ok: state.priorities.trim().length > 0 },
    { label: "Qué practicar antes del próximo intento", ok: state.nextSteps.trim().length > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{rubricTitle}</p>
          <p className="text-xs text-ink-3">{verification === "verified_older_edition" ? "Ponderaciones y tablas: Guía de preparadores 2016 (vigencia por verificar)" : verification}</p>
        </div>
        <Badge tone={status.status === "published" ? "ok" : status.status === "draft" ? "warn" : "neutral"}>
          {status.status === "published" ? "Publicada" : status.status === "draft" ? "Borrador" : "Sin evaluar"}
        </Badge>
      </div>

      <details className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" open={!preview.complete}>
        <summary className="cursor-pointer font-medium">
          Lista de comprobación ({checklist.filter((c) => c.ok).length}/{checklist.length})
        </summary>
        <ul className="mt-2 space-y-1">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              {c.ok ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <Circle className="size-4 text-ink-3" aria-hidden />}
              {c.label}
            </li>
          ))}
        </ul>
      </details>

      {criteria.map((c) => {
        const sel = state.scores[c.key]?.band ?? null;
        return (
          <fieldset key={c.key} className="rounded-xl border border-line bg-surface p-3">
            <legend className="px-1 text-sm font-semibold">
              {c.label} <span className="font-normal text-ink-3">· {c.weight} %</span>
            </legend>
            <p className="text-xs text-ink-3">{c.description}</p>
            {c.focus?.length ? (
              <details className="mt-1 text-xs text-ink-3">
                <summary className="cursor-pointer">Qué observar</summary>
                <ul className="mt-1 list-disc pl-4">
                  {c.focus.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
            ) : null}
            <div className="mt-2 grid grid-cols-6 gap-1" role="radiogroup" aria-label={`Banda de ${c.label}`}>
              {[0, 1, 2, 3, 4, 5].map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={sel === b}
                  disabled={readOnly}
                  onClick={() => update((s) => ({ ...s, scores: { ...s.scores, [c.key]: { ...(s.scores[c.key] ?? { comment: "" }), band: b } } }))}
                  className={cn(
                    "min-h-11 rounded-md border text-base font-semibold tabular-nums",
                    sel === b ? "border-brand bg-brand text-white" : "border-line-strong bg-surface hover:bg-surface-2",
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
            {sel != null ? (
              <p className="mt-2 rounded-md bg-surface-2 px-2 py-1.5 text-xs text-ink-2">
                <strong>Banda {sel}:</strong> {c.bands.find((b) => b.band === sel)?.summary}
                {table[c.key] ? <span className="text-ink-3"> · {formatNumber(table[c.key][sel], 3)} puntos</span> : null}
              </p>
            ) : null}
            <Textarea
              aria-label={`Comentario sobre ${c.label}`}
              placeholder="Justifique la banda con evidencias concretas"
              className="mt-2 min-h-16 text-sm"
              value={state.scores[c.key]?.comment ?? ""}
              readOnly={readOnly}
              onChange={(e) => update((s) => ({ ...s, scores: { ...s.scores, [c.key]: { ...(s.scores[c.key] ?? { band: null }), comment: e.target.value } } }))}
            />
          </fieldset>
        );
      })}

      <div className="grid gap-3">
        {(
          [
            ["strengths", "Lo que hizo bien"],
            ["priorities", "Errores prioritarios"],
            ["nextSteps", "Qué debe practicar antes del próximo intento"],
            ["globalComment", "Observaciones generales"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="text-sm">
            <span className="mb-1 block font-medium">{label}</span>
            <Textarea className="min-h-16 text-sm" value={state[k]} readOnly={readOnly} onChange={(e) => update((s) => ({ ...s, [k]: e.target.value }))} />
          </label>
        ))}
      </div>

      <div className="sticky bottom-0 space-y-2 rounded-xl border border-line bg-surface/95 p-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span>
            Criterios: {preview.done}/{criteria.length}
            {preview.pct != null ? (
              <>
                {" "}
                · Desempeño pedagógico <strong>{formatNumber(preview.pct)} %</strong>
              </>
            ) : null}
            {preview.pts != null ? (
              <>
                {" "}
                · {formatNumber(preview.pts, 2)}/{formatNumber(preview.max, 2)} pts (tabla)
              </>
            ) : null}
          </span>
          {dirty ? <Badge tone="warn">Cambios sin guardar</Badge> : null}
        </div>
        <Button onClick={save} disabled={pending || readOnly} className="w-full">
          <Save className="size-4" aria-hidden /> {pending ? "Guardando…" : "Guardar borrador"}
        </Button>
        {message ? (
          <p role="status" className={cn("text-sm", message.ok ? "text-ok" : "text-danger")}>
            {message.text}
          </p>
        ) : null}
        {status.updatedAt ? <p className="text-xs text-ink-3">Último guardado en el servidor: {new Date(status.updatedAt).toLocaleString("es-ES")}</p> : null}
      </div>
    </div>
  );
}
