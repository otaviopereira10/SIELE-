import type { InteractionType } from "./content-schema";

type Dict = Record<string, unknown>;

function asList(value: unknown): Dict[] {
  return Array.isArray(value) ? (value as Dict[]) : [];
}

function oralSegment(segment: Dict): Dict {
  return { ...segment, wait_seconds: segment.wait_seconds ?? 10 };
}

function oralOption(option: Dict): Dict {
  const segments = option.segments === undefined ? undefined : asList(option.segments).map(oralSegment);
  return { ...option, bullets: option.bullets ?? [], ...(segments ? { segments } : {}) };
}

function oralPart(part: Dict): Dict {
  const choice = part.choice as Dict | undefined;
  const segments = part.segments === undefined ? undefined : asList(part.segments).map(oralSegment);
  return {
    ...part,
    read_seconds: part.read_seconds ?? 0,
    prep_seconds: part.prep_seconds ?? 0,
    notes: part.notes ?? false,
    ...(segments ? { segments } : {}),
    ...(choice ? { choice: { ...choice, options: asList(choice.options).map(oralOption) } } : {}),
  };
}

/**
 * El contenido guardado no siempre incluye los campos con valor por defecto del esquema
 * (por ejemplo, una opción oral sin viñetas). Se completan aquí, una sola vez, antes de pintar la tarea.
 */
export function normalizeTaskContent(type: InteractionType, content: Dict | null | undefined): Dict {
  const c = content ?? {};
  const base = { ...c, media: c.media ?? {} };
  if (type === "speaking") return { ...base, parts: asList(c.parts).map(oralPart) };
  if (type === "writing") {
    return {
      ...base,
      bullets: c.bullets ?? [],
      keyboard: c.keyboard ?? true,
      ...(c.options === undefined ? {} : { options: asList(c.options).map((o) => ({ ...o, bullets: o.bullets ?? [] })) }),
    };
  }
  return base;
}
