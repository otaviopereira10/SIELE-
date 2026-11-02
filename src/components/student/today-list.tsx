"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { togglePlanItem } from "@/app/estudiante/actions";
import { cn } from "@/lib/utils";

export interface TodayItem {
  id: string;
  title: string;
  minutes: number;
  module_key: string | null;
  completed_at: string | null;
}

/** Actividades de hoy: se pueden abrir y marcar sin salir del inicio. */
export function TodayList({ items }: { items: TodayItem[] }) {
  const [optimistic, setDone] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, completed_at: change.done ? new Date().toISOString() : null } : i)),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <ul className="space-y-2">
      {error ? (
        <li role="alert" className="text-sm text-danger">
          {error}
        </li>
      ) : null}
      {optimistic.map((i) => (
        <li key={i.id} className={cn("flex items-start gap-3 rounded-lg px-3 py-2.5", i.completed_at ? "bg-ok-soft" : "bg-surface-2")}>
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0"
            checked={Boolean(i.completed_at)}
            aria-label={`Marcar «${i.title}» como hecha`}
            onChange={(e) => {
              const done = e.target.checked;
              start(async () => {
                setError(null);
                setDone({ id: i.id, done });
                const res = await togglePlanItem(i.id, done).catch(() => null);
                if (!res?.ok) setError(res?.error ?? "No se pudo guardar. Compruebe la conexión.");
              });
            }}
          />
          <div className="min-w-0 text-sm">
            {i.module_key ? (
              <Link href={`/estudiante/refuerzo/${i.module_key}`} className={cn("font-medium text-ink underline-offset-2 hover:underline", i.completed_at && "line-through decoration-ink-3")}>
                {i.title}
              </Link>
            ) : (
              <p className={cn("font-medium", i.completed_at && "line-through decoration-ink-3")}>{i.title}</p>
            )}
            <p className="text-xs text-ink-3">{i.module_key ? `${i.minutes} min` : "Unas 3 h 15 min"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
