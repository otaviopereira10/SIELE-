import "server-only";

/** Hora de la petición para componentes de servidor (se evalúa una vez por renderizado). */
export function requestTime(): number {
  return Date.now();
}
