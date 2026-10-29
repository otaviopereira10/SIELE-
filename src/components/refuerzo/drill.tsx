"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DrillExercise } from "@/content/refuerzo";
import { cn } from "@/lib/utils";

/** Ejercicios de refuerzo autocorregibles; el resultado se guarda para medir el progreso. */
export function Drill({ exercises, onFinish }: { exercises: DrillExercise[]; onFinish?: (score: number, max: number) => Promise<unknown> }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => exercises.map(() => null));
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const score = answers.filter((a, i) => a === exercises[i].answer).length;

  const check = () => {
    setChecked(true);
    if (onFinish) {
      start(async () => {
        const res = (await onFinish(score, exercises.length)) as { ok?: boolean; error?: string } | undefined;
        setSaved(res && res.ok === false ? (res.error ?? "No se pudo guardar.") : "Resultado guardado en su progreso.");
      });
    }
  };

  return (
    <div className="space-y-4">
      <ol className="space-y-4">
        {exercises.map((ex, i) => (
          <li key={i} className="rounded-lg border border-line p-4">
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
                    key={j}
                    type="button"
                    disabled={checked}
                    onClick={() => setAnswers((a) => a.map((v, k) => (k === i ? j : v)))}
                    aria-pressed={selected}
                    className={cn(
                      "min-h-11 rounded-lg border px-3 py-2 text-left text-[0.95rem]",
                      selected ? "border-ink bg-surface-2" : "border-line hover:bg-surface-2",
                      right && "border-ok bg-ok-soft",
                      wrong && "border-danger bg-danger-soft",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
            {checked ? (
              <p className={cn("mt-2 flex items-start gap-1.5 text-sm", answers[i] === ex.answer ? "text-ok" : "text-danger")}>
                {answers[i] === ex.answer ? <CheckCircle2 className="mt-0.5 size-4" aria-hidden /> : <XCircle className="mt-0.5 size-4" aria-hidden />}
                <span className="text-ink-2">{ex.explanation}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
      {!checked ? (
        <Button onClick={check} disabled={answers.some((a) => a === null)}>
          Corregir
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold">
            Resultado: {score}/{exercises.length}
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setAnswers(exercises.map(() => null));
              setChecked(false);
              setSaved(null);
            }}
          >
            <RotateCcw className="size-4" aria-hidden /> Repetir
          </Button>
          {pending ? <span className="text-sm text-ink-3">Guardando…</span> : saved ? <span className="text-sm text-ink-3">{saved}</span> : null}
        </div>
      )}
    </div>
  );
}
