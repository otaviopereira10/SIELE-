/**
 * Calendario de los planes de estudio. Un plan se organiza en semanas de 7 días contados desde su
 * inicio (6 de trabajo y uno de descanso); todas las fechas son días del calendario (AAAA-MM-DD).
 */
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export function daysBetween(from: string, to: string): number {
  return Math.round((toMs(to) - toMs(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

export function itemDate(startsOn: string, week: number, day: number): string {
  return addDays(startsOn, (week - 1) * 7 + (day - 1));
}

export interface PlanPosition {
  state: "upcoming" | "active" | "finished";
  week: number;
  day: number;
  /** el séptimo día de cada semana es de descanso */
  rest: boolean;
}

export function planPosition(startsOn: string, today: string, weeks: number): PlanPosition {
  const elapsed = daysBetween(startsOn, today);
  if (elapsed < 0) return { state: "upcoming", week: 1, day: 1, rest: false };
  if (elapsed >= weeks * 7) return { state: "finished", week: weeks, day: 7, rest: false };
  const day = (elapsed % 7) + 1;
  return { state: "active", week: Math.floor(elapsed / 7) + 1, day, rest: day === 7 };
}

/** «Hoy», «Mañana», «Ayer» o el día de la semana con la fecha. */
export function dayLabel(iso: string, today: string): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  const date = new Date(toMs(iso));
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

export const MAX_PLAN_WEEKS = 12;

/** Semanas que caben hasta la fecha objetivo; sin fecha (o ya pasada) se usa la duración propuesta. */
export function weeksUntil(today: string, target: string | null | undefined, fallback = 4): number {
  if (!target) return fallback;
  const days = daysBetween(today, target);
  if (days <= 0) return fallback;
  return Math.max(1, Math.min(MAX_PLAN_WEEKS, Math.ceil(days / 7)));
}

export interface ScheduledItem {
  week_no: number;
  day_no: number;
  position: number;
  completed_at: string | null;
}

/** Actividades que tocan un día concreto. */
export function itemsOn<T extends ScheduledItem>(items: readonly T[], startsOn: string, date: string): T[] {
  return items.filter((i) => itemDate(startsOn, i.week_no, i.day_no) === date).sort((a, b) => a.position - b.position);
}

/** La actividad pendiente más antigua hasta hoy: primero se recupera lo que quedó atrás. */
export function firstPending<T extends ScheduledItem>(items: readonly T[], startsOn: string, today: string): { item: T; overdue: boolean } | null {
  const pending = items
    .filter((i) => !i.completed_at && itemDate(startsOn, i.week_no, i.day_no) <= today)
    .sort((a, b) => a.week_no - b.week_no || a.day_no - b.day_no || a.position - b.position);
  const item = pending[0];
  return item ? { item, overdue: itemDate(startsOn, item.week_no, item.day_no) < today } : null;
}

export interface FittableItem {
  week_no: number;
  day_no: number;
  position: number;
  activity: string;
  module_key: string | null;
  minutes: number;
}

/** El simulacro de control es la única actividad cronometrada sin lección asociada. */
export function isControlItem(item: { activity: string; module_key: string | null }): boolean {
  return item.activity === "timed_mock" && !item.module_key;
}

/**
 * Ajusta el plan a la fecha del examen: nada se programa ese día ni después, y el simulacro de control
 * pasa al último día de trabajo que deje margen (si se puede, dos días antes del examen).
 */
export function fitPlanToDate<T extends FittableItem>(items: readonly T[], startsOn: string, examDate: string): T[] {
  const dateOf = (i: T) => itemDate(startsOn, i.week_no, i.day_no);
  const kept = items.filter((i) => dateOf(i) < examDate);
  const control = items.find(isControlItem);
  if (!control || kept.includes(control)) return kept;
  const days = [...new Set(kept.map(dateOf))].sort();
  const day = [...days].reverse().find((d) => daysBetween(d, examDate) >= 2) ?? days.at(-1);
  if (!day) return kept;
  const replaced = kept.filter((i) => dateOf(i) === day).sort((a, b) => a.position - b.position)[0];
  return kept.map((i) => (i === replaced ? { ...control, week_no: i.week_no, day_no: i.day_no, position: i.position, minutes: i.minutes } : i));
}
