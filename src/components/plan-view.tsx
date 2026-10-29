"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { BookOpen, Clock, Headphones, Mic, PenLine, Puzzle, Timer } from "lucide-react";
import { togglePlanItem } from "@/app/estudiante/actions";
import { ProgressBar } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export interface PlanItemView {
  id: string;
  week_no: number;
  day_no: number;
  position: number;
  activity: "receptive" | "writing" | "speaking" | "vocabulary" | "grammar" | "timed_mock";
  title: string;
  description: string;
  module_key: string | null;
  minutes: number;
  completed_at: string | null;
}

const ACT = {
  receptive: { label: "Comprensión", icon: Headphones },
  writing: { label: "Escritura", icon: PenLine },
  speaking: { label: "Oral", icon: Mic },
  vocabulary: { label: "Vocabulario", icon: BookOpen },
  grammar: { label: "Gramática", icon: Puzzle },
  timed_mock: { label: "Cronometrado", icon: Timer },
};

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function PlanView({ items, moduleBase, editable }: { items: PlanItemView[]; moduleBase: string; editable: boolean }) {
  const [optimistic, setDone] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, completed_at: change.done ? new Date().toISOString() : null } : i)),
  );
  const [, start] = useTransition();
  const weeks = [...new Set(optimistic.map((i) => i.week_no))].sort((a, b) => a - b);
  const done = optimistic.filter((i) => i.completed_at).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex justify-between text-sm">
          <span>Actividades completadas</span>
          <span className="tabular-nums">
            {done}/{optimistic.length}
          </span>
        </div>
        <ProgressBar value={done} max={optimistic.length} tone="ok" label="Progreso del plan" />
      </div>
      {weeks.map((w) => (
        <section key={w}>
          <h3 className="mb-3 font-semibold">Semana {w}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((d) => {
              const dayItems = optimistic.filter((i) => i.week_no === w && i.day_no === d).sort((a, b) => a.position - b.position);
              if (!dayItems.length) return null;
              return (
                <div key={d} className="rounded-xl border border-line bg-surface p-3">
                  <p className="mb-2 flex items-center justify-between text-sm font-medium">
                    {DAYS[d - 1]}
                    <span className="flex items-center gap-1 text-xs text-ink-3">
                      <Clock className="size-3.5" aria-hidden />
                      {dayItems.reduce((s, i) => s + i.minutes, 0)} min
                    </span>
                  </p>
                  <ul className="space-y-2">
                    {dayItems.map((i) => {
                      const A = ACT[i.activity];
                      return (
                        <li key={i.id} className={cn("rounded-lg px-2 py-2", i.completed_at ? "bg-ok-soft" : "bg-surface-2")}>
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 size-5 shrink-0"
                              checked={Boolean(i.completed_at)}
                              disabled={!editable}
                              onChange={(e) => {
                                const next = e.target.checked;
                                start(async () => {
                                  setDone({ id: i.id, done: next });
                                  await togglePlanItem(i.id, next);
                                });
                              }}
                              aria-label={`Marcar «${i.title}» como completada`}
                            />
                            <span className="min-w-0 text-sm">
                              <span className="flex items-center gap-1 text-xs text-ink-3">
                                <A.icon className="size-3.5" aria-hidden /> {A.label} · {i.minutes} min
                              </span>
                              <span className={cn("block font-medium", i.completed_at && "line-through decoration-ink-3")}>{i.title}</span>
                              <span className="block text-xs text-ink-3">{i.description}</span>
                            </span>
                          </label>
                          {i.module_key ? (
                            <Link href={`${moduleBase}/${i.module_key}`} className="mt-1 ml-7 inline-block text-xs text-brand underline">
                              Abrir el módulo
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
