"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Clock, Headphones, Mic, PenLine, Puzzle, Timer } from "lucide-react";
import { togglePlanItem } from "@/app/estudiante/actions";
import { Badge, ProgressBar } from "@/components/ui/primitives";
import { dayLabel, isControlItem, itemDate, planPosition } from "@/lib/plan/schedule";
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
  timed_mock: { label: "Contra el reloj", icon: Timer },
};

export function PlanView({
  items,
  startsOn,
  weeks,
  today,
  moduleBase,
  editable,
}: {
  items: PlanItemView[];
  startsOn: string;
  weeks: number;
  today: string;
  moduleBase: string;
  editable: boolean;
}) {
  const [optimistic, setDone] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, completed_at: change.done ? new Date().toISOString() : null } : i)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const weekNumbers = [...new Set(optimistic.map((i) => i.week_no))].sort((a, b) => a - b);
  const done = optimistic.filter((i) => i.completed_at).length;
  const position = planPosition(startsOn, today, weeks);
  const currentWeek = position.state === "active" ? position.week : position.state === "finished" ? weeks : 1;
  const overdue = optimistic.filter((i) => !i.completed_at && itemDate(startsOn, i.week_no, i.day_no) < today).length;

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1 flex flex-wrap justify-between gap-2 text-sm">
          <span>
            {position.state === "upcoming" ? "El plan todavía no ha empezado" : position.state === "finished" ? "Plan terminado" : `Semana ${position.week} de ${weeks}`}
            {overdue > 0 ? <span className="text-warn"> · {overdue} {overdue === 1 ? "actividad atrasada" : "actividades atrasadas"}</span> : null}
          </span>
          <span className="tabular-nums">
            {done} de {optimistic.length} hechas
          </span>
        </div>
        <ProgressBar value={done} max={optimistic.length} tone="ok" label="Progreso del plan" />
        {error ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </div>
      {weekNumbers.map((w) => {
        const weekItems = optimistic.filter((i) => i.week_no === w);
        const weekDone = weekItems.filter((i) => i.completed_at).length;
        return (
          <details key={w} open={w === currentWeek} className="group rounded-xl border border-line bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span className="flex flex-wrap items-center gap-2 font-semibold">
                Semana {w}
                {w === currentWeek && position.state === "active" ? <Badge tone="brand">Esta semana</Badge> : null}
              </span>
              <span className="flex items-center gap-2 text-sm text-ink-3 tabular-nums">
                {weekDone} de {weekItems.length}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((d) => {
                const dayItems = weekItems.filter((i) => i.day_no === d).sort((a, b) => a.position - b.position);
                if (!dayItems.length) return null;
                const date = itemDate(startsOn, w, d);
                const isToday = date === today;
                return (
                  <div key={d} className={cn("rounded-xl border p-3", isToday ? "border-brand ring-1 ring-brand" : "border-line")}>
                    <p className="mb-2 flex items-center justify-between text-sm font-medium">
                      <span>{dayLabel(date, today)}</span>
                      <span className="flex items-center gap-1 text-xs font-normal text-ink-3">
                        <Clock className="size-3.5" aria-hidden />
                        {dayItems.reduce((s, i) => s + i.minutes, 0)} min
                      </span>
                    </p>
                    <ul className="space-y-2">
                      {dayItems.map((i) => {
                        const A = ACT[i.activity];
                        const late = !i.completed_at && date < today;
                        return (
                          <li key={i.id} className={cn("rounded-lg px-2 py-2", i.completed_at ? "bg-ok-soft" : "bg-surface-2")}>
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                className="mt-0.5 size-5 shrink-0"
                                checked={Boolean(i.completed_at)}
                                disabled={!editable}
                                onChange={(e) => {
                                  const next = e.target.checked;
                                  start(async () => {
                                    setError(null);
                                    setDone({ id: i.id, done: next });
                                    const res = await togglePlanItem(i.id, next).catch(() => null);
                                    if (!res?.ok) setError(res?.error ?? "No se pudo guardar. Compruebe la conexión.");
                                  });
                                }}
                                aria-label={`Marcar «${i.title}» como hecha`}
                              />
                              <div className="min-w-0 text-sm">
                                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
                                  <A.icon className="size-3.5" aria-hidden /> {A.label} · {isControlItem(i) ? "unas 3 h 15 min" : `${i.minutes} min`}
                                  {late ? <span className="font-medium text-warn">· Atrasada</span> : null}
                                </p>
                                {i.module_key ? (
                                  <Link href={`${moduleBase}/${i.module_key}`} className={cn("block font-medium text-ink underline-offset-2 hover:underline", i.completed_at && "line-through decoration-ink-3")}>
                                    {i.title}
                                  </Link>
                                ) : (
                                  <p className={cn("font-medium", i.completed_at && "line-through decoration-ink-3")}>{i.title}</p>
                                )}
                                <p className="text-xs text-ink-3">{i.description}</p>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}
    </div>
  );
}
