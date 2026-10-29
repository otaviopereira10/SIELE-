"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Clock, Hourglass, Lock } from "lucide-react";
import type { Skill } from "@/lib/exam/content-schema";
import { SKILL_META, formatDuration } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";

export function skillTone(skill: Skill) {
  return SKILL_META[skill].tone;
}

const activeTab: Record<ReturnType<typeof skillTone>, string> = {
  comprehension: "bg-gold text-white border-gold",
  writing: "bg-blue text-white border-blue",
  speaking: "bg-orange text-white border-orange",
};

/** Cabecera oscura del examen con franja de color por destreza. */
export function ExamHeader({ title, subtitle, skill, right }: { title: string; subtitle?: string; skill: Skill; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 shadow-sm">
      <div className="flex items-center justify-between gap-3 bg-exam-header px-4 py-3 text-white sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-lg font-medium sm:text-xl">{title}</p>
          {subtitle ? <p className="truncate text-xs text-white/65">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className={cn("h-2", `stripe-${skillTone(skill)}`)} />
    </header>
  );
}

export interface TabInfo {
  position: number;
  title: string;
  done: boolean;
  locked: boolean;
}

/** Navegación por tareas. Las tareas bloqueadas (sin retorno) se muestran deshabilitadas. */
export function TaskTabs({ tabs, current, skill, onSelect }: { tabs: TabInfo[]; current: number; skill: Skill; onSelect: (position: number) => void }) {
  return (
    <nav aria-label="Tareas de la prueba" className="overflow-x-auto">
      <ol className="inline-flex border border-ink/80">
        {tabs.map((t) => {
          const isCurrent = t.position === current;
          return (
            <li key={t.position} className="border-r border-ink/80 last:border-r-0">
              <button
                type="button"
                disabled={t.locked && !isCurrent}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(t.position)}
                className={cn(
                  "flex min-h-11 items-center gap-1.5 px-3.5 py-2 text-[0.95rem] whitespace-nowrap transition-colors",
                  isCurrent ? activeTab[skillTone(skill)] : "bg-surface text-ink hover:bg-surface-2",
                  t.locked && !isCurrent && "cursor-not-allowed text-ink-3 hover:bg-surface",
                )}
              >
                {t.locked && !isCurrent ? <Lock className="size-3.5" aria-hidden /> : null}
                Tarea {t.position}
                {t.done && !isCurrent ? <Check className="size-3.5 text-ok" aria-label="con respuestas" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Reloj que avanza con un intervalo (el estado se actualiza en el callback, no en el efecto). */
export function useNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/**
 * Temporizador basado en la hora límite del servidor. Corrige el desfase del reloj local con
 * server_now, de modo que manipular el reloj del dispositivo no da más tiempo (el servidor
 * rechaza cualquier respuesta fuera de plazo).
 */
export function useCountdown(deadline: string | null, serverOffsetMs: number, onExpire?: () => void) {
  const now = useNow(500);
  const remaining = deadline ? Math.max(0, Math.round((new Date(deadline).getTime() - (now + serverOffsetMs)) / 1000)) : null;
  const firedFor = useRef<string | null>(null);
  const expireRef = useRef(onExpire);
  useEffect(() => {
    expireRef.current = onExpire;
  }, [onExpire]);
  useEffect(() => {
    if (deadline && remaining === 0 && firedFor.current !== deadline) {
      firedFor.current = deadline;
      expireRef.current?.();
    }
  }, [deadline, remaining]);
  return remaining;
}

export function TimerBox({ seconds, label = "Tiempo prueba" }: { seconds: number | null; label?: string }) {
  const low = seconds != null && seconds <= 300;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border-2 bg-surface px-3 py-1.5 text-ink",
        low ? "border-danger text-danger" : "border-accent/70",
      )}
      role="timer"
      aria-live={low ? "assertive" : "off"}
      aria-label={`${label}: ${seconds != null ? formatDuration(seconds) : "sin límite"}`}
    >
      <Clock className="size-4" aria-hidden />
      <span className="text-sm">{label}:</span>
      <span className="text-xl font-semibold tabular-nums">{seconds != null ? formatDuration(seconds) : "--:--"}</span>
    </div>
  );
}

/**
 * Cuenta atrás corta y local (elegir opción, preparar, grabar). Se monta solo mientras la fase está
 * activa: al desmontarse se reinicia de forma natural.
 */
export function Timed({ seconds, onDone, children }: { seconds: number; onDone?: () => void; children: (left: number) => ReactNode }) {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(250);
  const left = Math.max(0, seconds - Math.floor((now - startedAt) / 1000));
  const doneRef = useRef(onDone);
  const fired = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);
  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      doneRef.current?.();
    }
  }, [left]);
  return <>{children(left)}</>;
}

export function PhaseCountdown({ label, seconds, tone = "accent" }: { label: string; seconds: number; tone?: "accent" | "danger" }) {
  return (
    <div className={cn("flex items-center gap-3 text-lg font-medium", tone === "danger" ? "text-danger" : "text-accent")} role="timer" aria-live="polite">
      <Hourglass className="size-9 shrink-0" aria-hidden />
      <span>
        {label}: <span className="tabular-nums">{formatDuration(seconds)}</span>
      </span>
    </div>
  );
}

export function ExamFooter({ progressLabel, progress, children }: { progressLabel: string; progress: number; children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-20 border-t border-line bg-surface-2/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1 sm:max-w-xs">
          <span className="text-sm font-medium text-accent">{progressLabel}</span>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-accent/25" aria-hidden>
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">{children}</div>
      </div>
    </footer>
  );
}
