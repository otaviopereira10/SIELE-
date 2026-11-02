"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, CloudOff, Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { cn, formatNumber, formatTime } from "@/lib/utils";
import { saveEvaluation } from "../../actions";
import { previewScore, type EvaluationMeta, type EvaluationState } from "./grading-model";

export interface RubricCriterion {
  key: string;
  label: string;
  weight: number;
  description: string;
  focus?: string[];
  bands: { band: number; summary: string }[];
}

export interface RubricPanelHandle {
  /** Guarda lo pendiente; devuelve false si no se ha podido. */
  flush(): Promise<boolean>;
  setAllBands(band: number): void;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const FEEDBACK_FIELDS = [
  { key: "strengths", label: "Lo que hizo bien", placeholder: "Qué mantener: recursos que usa con acierto." },
  { key: "priorities", label: "Qué debe corregir primero", placeholder: "Los dos o tres errores que más le penalizan." },
  { key: "nextSteps", label: "Qué practicar antes del próximo intento", placeholder: "Una tarea concreta para esta semana." },
  { key: "globalComment", label: "Comentario general (opcional)", placeholder: "Cualquier otra observación para el estudiante." },
] as const;

/**
 * Rúbrica de 0 a 5 por criterio. Se guarda sola mientras se evalúa: no hay botón de guardar ni nada que perder,
 * y nada es visible para el estudiante hasta publicar.
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
  meta,
  readOnly,
  externalBand,
  onSaved,
  next,
  ref,
}: {
  attemptId: string;
  taskId: string;
  taskPosition: number;
  criteria: RubricCriterion[];
  pointsTable: Record<string, Record<string, number[]>>;
  rubricTitle: string;
  verification: string;
  initial: EvaluationState;
  meta: EvaluationMeta;
  readOnly: boolean;
  externalBand?: { criterion: string; band: number; nonce: number } | null;
  onSaved: (state: EvaluationState, meta: EvaluationMeta) => void;
  next: { label: string; onClick: () => void };
  ref?: Ref<RubricPanelHandle>;
}) {
  const [state, setState] = useState<EvaluationState>(initial);
  const [save, setSave] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(meta.updatedAt ? new Date(meta.updatedAt) : null);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<{ criterion: string; band: number } | null>(null);
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  const latest = useRef(state);
  const dirty = useRef(false);
  const running = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  const saveOnce = useCallback(async (): Promise<boolean> => {
    dirty.current = false;
    setSave("saving");
    setError(null);
    const snapshot = latest.current;
    try {
      const res = await saveEvaluation({
        attemptId,
        taskId,
        scores: criteria.map((c) => ({ criterion: c.key, band: snapshot.scores[c.key]?.band ?? null, comment: snapshot.scores[c.key]?.comment ?? "" })),
        globalComment: snapshot.globalComment,
        strengths: snapshot.strengths,
        priorities: snapshot.priorities,
        nextSteps: snapshot.nextSteps,
      });
      if (!res?.ok) throw new Error(res?.error ?? "No se pudo guardar.");
      const saved = res.data as { status: string; is_complete: boolean; points: number | null; max_points: number | null; pedagogical_percent: number | null; updated_at: string };
      setSave(dirty.current ? "dirty" : "saved");
      setSavedAt(new Date(saved.updated_at));
      onSavedRef.current(snapshot, {
        status: saved.status,
        isComplete: saved.is_complete,
        points: saved.points,
        max: saved.max_points,
        percent: saved.pedagogical_percent,
        updatedAt: saved.updated_at,
        started: Object.values(snapshot.scores).some((s) => s.band != null),
      });
      return true;
    } catch (err) {
      dirty.current = true;
      setSave("error");
      setError(err instanceof Error && !/fetch/i.test(err.message) ? err.message : "Sin conexión con el servidor. Se reintentará automáticamente; no cierre la página.");
      return false;
    }
  }, [attemptId, taskId, criteria]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    for (let i = 0; i < 5; i++) {
      if (running.current) await running.current;
      if (!dirty.current) return true;
      const run = saveOnce();
      running.current = run;
      const ok = await run;
      running.current = null;
      if (!ok) return false;
    }
    return !dirty.current;
  }, [saveOnce]);

  const update = useCallback(
    (fn: (s: EvaluationState) => EvaluationState) => {
      const value = fn(latest.current);
      latest.current = value;
      setState(value);
      dirty.current = true;
      setSave("dirty");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 900);
    },
    [flush],
  );

  useImperativeHandle(
    ref,
    () => ({
      flush,
      setAllBands: (band) => update((s) => ({ ...s, scores: Object.fromEntries(criteria.map((c) => [c.key, { comment: s.scores[c.key]?.comment ?? "", band }])) })),
    }),
    [flush, update, criteria],
  );

  // banda sugerida por la IA: se aplica como si la hubiera elegido la profesora
  const applied = useRef<number | null>(null);
  useEffect(() => {
    if (!externalBand || externalBand.nonce === applied.current) return;
    applied.current = externalBand.nonce;
    const t = window.setTimeout(() => update((s) => ({ ...s, scores: { ...s.scores, [externalBand.criterion]: { comment: s.scores[externalBand.criterion]?.comment ?? "", band: externalBand.band } } })), 0);
    return () => window.clearTimeout(t);
  }, [externalBand, update]);

  // reintento automático tras un fallo y aviso si se intenta salir con cambios pendientes
  useEffect(() => {
    if (save !== "error") return;
    const id = window.setInterval(() => void flush(), 8000);
    return () => window.clearInterval(id);
  }, [save, flush]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => {
      window.removeEventListener("beforeunload", h);
      if (dirty.current) void flush();
    };
  }, [flush]);

  const table = pointsTable[String(taskPosition)] ?? pointsTable["*"] ?? {};
  const score = previewScore(criteria, state, table);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-brand px-4 py-3.5 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/75">Evaluación de la tarea</p>
          <SaveBadge state={save} savedAt={savedAt} />
        </div>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4">
          <p className="text-2xl font-semibold tabular-nums">
            {score.points != null ? (
              <>
                {formatNumber(score.points, 2)} <span className="text-base font-normal text-white/70">/ {formatNumber(score.max, 2)} puntos</span>
              </>
            ) : (
              <span className="text-lg font-medium">
                {score.done} de {criteria.length} criterios
              </span>
            )}
          </p>
          {score.percent != null ? <p className="text-sm text-white/80 tabular-nums">Desempeño {formatNumber(score.percent)} %</p> : null}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" aria-hidden>
          <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${criteria.length ? (score.done / criteria.length) * 100 : 0}%` }} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
          <CloudOff className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
        </p>
      ) : null}

      <ol className="space-y-3">
        {criteria.map((c, index) => {
          const sel = state.scores[c.key]?.band ?? null;
          const shown = hover?.criterion === c.key ? hover.band : sel;
          const comment = state.scores[c.key]?.comment ?? "";
          const commentOpen = openComments[c.key] || comment.length > 0;
          return (
            <li key={c.key} className={cn("rounded-2xl border bg-surface p-4 transition-colors", sel != null ? "border-line" : "border-line-strong")}>
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-ink">
                  <span className="mr-1.5 text-ink-3 tabular-nums">{index + 1}.</span>
                  {c.label}
                </h3>
                <span className="shrink-0 text-xs text-ink-3 tabular-nums">{c.weight} %</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-2">{c.description}</p>
              {c.focus?.length ? (
                <details className="group mt-1 text-sm text-ink-3">
                  <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-ink-2">
                    <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden /> Qué observar
                  </summary>
                  <ul className="mt-1 ml-5 list-disc space-y-0.5">
                    {c.focus.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <div className="mt-3 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={`Banda de ${c.label}`} onMouseLeave={() => setHover(null)}>
                {[0, 1, 2, 3, 4, 5].map((b) => (
                  <button
                    key={b}
                    type="button"
                    role="radio"
                    aria-checked={sel === b}
                    disabled={readOnly}
                    onMouseEnter={() => setHover({ criterion: c.key, band: b })}
                    onFocus={() => setHover({ criterion: c.key, band: b })}
                    onBlur={() => setHover(null)}
                    onClick={() => update((s) => ({ ...s, scores: { ...s.scores, [c.key]: { comment: s.scores[c.key]?.comment ?? "", band: sel === b ? null : b } } }))}
                    className={cn(
                      "h-11 rounded-lg border text-base font-semibold tabular-nums transition-colors active:scale-[0.97] disabled:cursor-default",
                      sel === b ? "border-brand bg-brand text-white" : "border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
              <div className={cn("mt-2 min-h-[3.25rem] rounded-lg px-3 py-2 text-sm", shown != null ? "bg-surface-2 text-ink-2" : "text-ink-3")}>
                {shown != null ? (
                  <>
                    <span className="font-medium text-ink">Banda {shown}.</span> {c.bands.find((b) => b.band === shown)?.summary}
                    {table[c.key] ? <span className="text-ink-3 tabular-nums"> ({formatNumber(table[c.key][shown], 3)} puntos)</span> : null}
                  </>
                ) : (
                  "Pase por encima de cada número para leer su descriptor y pulse el que corresponda."
                )}
              </div>

              {commentOpen ? (
                <Textarea
                  aria-label={`Comentario sobre ${c.label}`}
                  placeholder="Justifique la banda con un ejemplo de la respuesta."
                  className="mt-2 min-h-16 text-sm"
                  value={comment}
                  readOnly={readOnly}
                  onChange={(e) => update((s) => ({ ...s, scores: { ...s.scores, [c.key]: { band: s.scores[c.key]?.band ?? null, comment: e.target.value } } }))}
                />
              ) : !readOnly ? (
                <button type="button" onClick={() => setOpenComments((o) => ({ ...o, [c.key]: true }))} className="mt-1 inline-flex items-center gap-1.5 rounded px-1 py-1 text-sm text-ink-3 hover:text-ink">
                  <MessageSquarePlus className="size-4" aria-hidden /> Añadir comentario
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      <section className="rounded-2xl border border-line bg-surface p-4">
        <h3 className="font-semibold text-ink">Mensaje para el estudiante</h3>
        <p className="text-sm text-ink-3">Es lo que leerá en su informe, junto a las bandas y las observaciones.</p>
        <div className="mt-3 space-y-3">
          {FEEDBACK_FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="block text-sm">
              <span className="mb-1 block font-medium text-ink">{label}</span>
              <Textarea className="min-h-[4.25rem] text-sm" value={state[key]} readOnly={readOnly} placeholder={placeholder} onChange={(e) => update((s) => ({ ...s, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
      </section>

      <div className="space-y-2">
        {score.complete ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-ok">
            <CheckCircle2 className="size-4" aria-hidden /> Tarea evaluada.
          </p>
        ) : null}
        <Button className="w-full" variant={score.complete ? "primary" : "secondary"} onClick={next.onClick}>
          {next.label} <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="text-xs text-ink-3">
          {rubricTitle} · {verification === "verified_older_edition" ? "ponderaciones de la Guía de preparadores 2016 (vigencia por verificar)" : verification}
        </p>
      </div>
    </div>
  );
}

function SaveBadge({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  if (state === "saving" || state === "dirty") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-white/80" role="status">
        <Loader2 className="size-3.5 animate-spin" aria-hidden /> Guardando…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-white" role="status">
        <CloudOff className="size-3.5" aria-hidden /> Sin guardar
      </span>
    );
  }
  return savedAt ? (
    <span className="flex items-center gap-1.5 text-xs text-white/80" role="status">
      <Check className="size-3.5" aria-hidden /> Guardado a las {formatTime(savedAt)}
    </span>
  ) : (
    <span className="text-xs text-white/70">Se guarda solo</span>
  );
}
