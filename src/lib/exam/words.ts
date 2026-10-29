/**
 * Cuenta palabras con la misma definición que public.count_words() en la base de datos:
 * fragmentos separados por espacios que contienen al menos una letra o cifra.
 * («—», «...» o «¿» aislados no cuentan; «¿Qué» sí.)
 */
const WORD_CHAR = /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/;

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  let count = 0;
  for (const token of trimmed.split(/\s+/)) {
    if (WORD_CHAR.test(token)) count++;
  }
  return count;
}

export type WordRangeStatus = "empty" | "below" | "within" | "above";

export function wordRangeStatus(count: number, min?: number | null, max?: number | null): WordRangeStatus {
  if (count === 0) return "empty";
  if (min && count < min) return "below";
  if (max && count > max) return "above";
  return "within";
}
