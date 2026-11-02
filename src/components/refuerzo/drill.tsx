"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DrillExercise } from "@/content/refuerzo";
import { moduleStatus, prepareDrill } from "@/lib/exam/drill";
import { cn } from "@/lib/utils";

/**
 * Ejercicios de refuerzo autocorregibles. Cada tanda toma una selección distinta de preguntas y cambia
 * el orden de las opciones; el resultado se guarda para medir el progreso.
 */
export function Drill({
  exercises,
  seed = 1,
  onFinish,
  nextHref,
  nextLabel,
}: {
  exercises: DrillExercise[];
  /** semilla enviada por el servidor: la primera tanda se pinta igual en el servidor y en el navegador */
  seed?: number;
  onFinish?: (score: number, max: number) => Promise<unknown>;
  nextHref?: string;
  nextLabel?: string;
}) {
  // se fija al montar: al guardar el resultado, la página se vuelve a pintar con otra semilla y, si cambiaran
  // las preguntas, las respuestas ya dadas pasarían a corresponder a otras opciones
  const [firstSeed] = useState(seed);
  const [run, setRun] = useState(0);
  const questions = useMemo(() => prepareDrill(exercises, firstSeed + run), [exercises, firstSeed, run]);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null);
  const score = answers.filter((a, i) => a === questions[i]?.answer).length;
  const missing = answers.filter((a) => a === null).length;
  const mastered = moduleStatus({ score, max: questions.length }) === "mastered";

  const check = () => {
    setChecked(true);
    if (onFinish) {
      start(async () => {
        // sin conexión, las correcciones siguen a la vista: solo se avisa de que el resultado no se ha guardado
        const res = (await onFinish(score, questions.length).catch(() => ({ ok: false, error: "No se pudo guardar el resultado. Compruebe la conexión." }))) as
          | { ok?: boolean; error?: string; message?: string }
          | undefined;
        setSaved(res && res.ok === false ? (res.error ?? "No se pudo guardar el resultado.") : (res?.message ?? "Resultado guardado en su progreso."));
      });
    }
  };

  const again = () => {
    const next = run + 1;
    setRun(next);
    setAnswers(prepareDrill(exercises, firstSeed + next).map(() => null));
    setChecked(false);
    setSaved(null);
    list.current?.focus();
    list.current?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="space-y-4">
      <ol ref={list} tabIndex={-1} className="scroll-mt-20 space-y-4 outline-none">
        {questions.map((ex, i) => (
          <li key={`${run}-${ex.prompt}-${i}`} className="rounded-lg border border-line p-4">
            <p className="font-medium">
              {i + 1}. {ex.prompt}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {ex.options.map((o, j) => {
                const selected = answers[i] === j;
                const right = checked && j === ex.answer;
                const wrong = checked && selected && j !== ex.answer;
                return (
                  <button
                    key={o}
                    type="button"
                    disabled={checked}
                    onClick={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))}
                    aria-pressed={selected}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 py-2 text-left text-[0.95rem] transition-colors",
                      selected ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2",
                      right && "border-2 border-ok bg-ok-soft font-medium",
                      wrong && "border-danger bg-danger-soft line-through decoration-danger/60",
                    )}
                  >
                    {o}
                    {right ? <span className="sr-only"> (respuesta correcta)</span> : null}
                    {wrong ? <span className="sr-only"> (su respuesta, incorrecta)</span> : null}
                  </button>
                );
              })}
            </div>
            {checked ? (
              <p className={cn("mt-2 flex items-start gap-1.5 text-sm", answers[i] === ex.answer ? "text-ok" : "text-danger")}>
                {answers[i] === ex.answer ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
                <span className="text-ink-2">
                  <span className="sr-only">{answers[i] === ex.answer ? "Correcto. " : "Incorrecto. "}</span>
                  {ex.explanation}
                </span>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {!checked ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={missing > 0}>
            Corregir
          </Button>
          {missing > 0 ? <p className="text-sm text-ink-3">{missing === 1 ? "Falta 1 respuesta" : `Faltan ${missing} respuestas`}</p> : null}
        </div>
      ) : (
        <div role="status" className={cn("rounded-xl border p-4", mastered ? "border-ok/30 bg-ok-soft" : "border-warn/30 bg-warn-soft")}>
          <p className="font-semibold">
            {score} de {questions.length} aciertos · {mastered ? "Tema dominado" : "Conviene repasarlo"}
          </p>
          <p className="mt-0.5 text-sm text-ink-2">
            {mastered ? "Ya puede pasar a lo siguiente." : "Lea otra vez la explicación, fíjese en las respuestas de arriba y haga otra tanda: las preguntas cambian."}
          </p>
          {pending ? <p className="mt-1 text-sm text-ink-3">Guardando…</p> : saved ? <p className="mt-1 text-sm text-ink-3">{saved}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {nextHref ? (
              <Link
                href={nextHref}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-[0.95rem] font-medium transition-colors",
                  mastered ? "bg-brand text-white hover:bg-brand-hover" : "border border-line-strong bg-surface text-ink hover:bg-surface-2",
                )}
              >
                {nextLabel ?? "Continuar"} <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
            <Button variant={mastered || !nextHref ? "secondary" : "primary"} onClick={again}>
              <RotateCcw className="size-4" aria-hidden /> Otra tanda
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
