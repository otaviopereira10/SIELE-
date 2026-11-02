import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Zona horaria fija: el servidor (UTC en producción) y el navegador deben pintar la misma hora;
 * si no, React detecta una diferencia al hidratar la página y la vuelve a generar entera.
 */
const timeZone = process.env.NEXT_PUBLIC_TIME_ZONE || "America/Sao_Paulo";
const dateFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone });
const dateTimeFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone,
});
const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", timeZone });

const dateOnlyFmt = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const isoDayFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone });

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  // una fecha sin hora es un día del calendario: al pasarla a la zona local mostraría el día anterior
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateOnlyFmt.format(new Date(`${value}T00:00:00Z`));
  return dateFmt.format(typeof value === "string" ? new Date(value) : value);
}

/** El día de hoy (AAAA-MM-DD) en la zona horaria de la aplicación. */
export function todayISO(now: number | Date): string {
  return isoDayFmt.format(now);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return dateTimeFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return timeFmt.format(typeof value === "string" ? new Date(value) : value);
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: digits }).format(value);
}

/** Convierte el marcado mínimo de los textos (párrafos, **negrita**, *cursiva*) en fragmentos seguros. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
