import { z } from "zod";

/**
 * Esquemas del contenido público de cada tipo de tarea (columna tasks.content).
 * Se validan en el servidor al guardar desde el editor y antes de publicar una versión.
 * Los textos admiten un marcado mínimo: párrafos separados por línea en blanco, **negrita**,
 * *cursiva* y, en los textos con huecos, marcadores [[n]] que remiten a la pregunta n.
 */

export const SKILLS = ["reading", "listening", "writing", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

export const INTERACTION_TYPES = [
  "single_choice",
  "matching",
  "dropdown_gap",
  "fragment_gap",
  "multi_select",
  "writing",
  "speaking",
] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

const key = z.string().regex(/^[a-z0-9_-]{1,30}$/, "Clave: minúsculas, números, guion o guion bajo");
const mediaKey = z.string().regex(/^[a-z0-9_.-]{1,80}$/);

export const mediaRefSchema = z.object({
  asset_id: z.uuid(),
  kind: z.enum(["audio", "image"]),
  label: z.string().max(120).optional(),
  max_plays: z.number().int().min(0).max(10).optional(),
});

export const textBlockSchema = z.object({
  key,
  label: z.string().max(40).optional(),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(20000),
  source: z.string().max(300).optional(),
  question_positions: z.array(z.number().int().min(1).max(60)).optional(),
});

export const listeningTimingSchema = z.object({
  read_seconds: z.number().int().min(0).max(300),
  between_seconds: z.number().int().min(0).max(120),
  after_seconds: z.number().int().min(0).max(300),
});

const baseContent = z.object({
  intro: z.string().max(4000).optional(),
  media: z.record(mediaKey, mediaRefSchema).default({}),
  texts: z.array(textBlockSchema).max(12).optional(),
  audio_key: mediaKey.optional(),
  image_key: mediaKey.optional(),
  timing: listeningTimingSchema.optional(),
  source: z.string().max(300).optional(),
  synthetic_voice_notice: z.boolean().optional(),
});

export const singleChoiceContent = baseContent;

export const matchingContent = baseContent.extend({
  bank_title: z.string().max(200).default("Opciones"),
  unique_use: z.boolean().default(false),
  layout: z.enum(["select", "grid"]).default("select"),
});

export const dropdownGapContent = baseContent.extend({
  passage_title: z.string().max(200).optional(),
  passage: z.string().min(1).max(20000),
});

export const fragmentGapContent = baseContent.extend({
  passages: z
    .array(
      z.object({
        key,
        title: z.string().max(200).optional(),
        body: z.string().min(1).max(20000),
        source: z.string().max(300).optional(),
        /** posiciones (1…n) del banco común que corresponden a este texto */
        bank_positions: z.array(z.number().int().min(1).max(30)).optional(),
      }),
    )
    .min(1)
    .max(4),
  bank_title: z.string().max(200).default("Fragmentos"),
});

export const multiSelectContent = baseContent.extend({
  prompt: z.string().max(1000).optional(),
});

const writingOption = z.object({
  key,
  title: z.string().min(1).max(200),
  instructions: z.string().min(1).max(4000),
  bullets: z.array(z.string().min(1).max(400)).max(10).default([]),
  stimulus: z.object({ title: z.string().max(200).optional(), body: z.string().max(6000) }).optional(),
  word_min: z.number().int().min(0).max(2000),
  word_max: z.number().int().min(1).max(3000),
});

export const writingContent = baseContent.extend({
  bullets: z.array(z.string().min(1).max(400)).max(10).default([]),
  stimulus: z.object({ title: z.string().max(200).optional(), body: z.string().max(6000) }).optional(),
  word_min: z.number().int().min(0).max(2000).optional(),
  word_max: z.number().int().min(1).max(3000).optional(),
  options: z.array(writingOption).max(3).optional(),
  keyboard: z.boolean().default(true),
});

export const oralSegmentSchema = z.object({
  key,
  prompt_text: z.string().max(1000).optional(),
  prompt_audio_key: mediaKey.optional(),
  /** segundos hasta el inicio automático de la grabación */
  wait_seconds: z.number().int().min(0).max(600).default(10),
  record_seconds: z.number().int().min(5).max(600),
  min_seconds: z.number().int().min(0).max(600).optional(),
});

export const oralOptionSchema = z.object({
  key,
  title: z.string().min(1).max(200),
  body: z.string().max(4000).optional(),
  bullets: z.array(z.string().min(1).max(400)).max(10).default([]),
  image_key: mediaKey.optional(),
  linked_option: key.optional(),
  segments: z.array(oralSegmentSchema).max(8).optional(),
});

export const oralPartSchema = z.object({
  key,
  title: z.string().max(200).optional(),
  instructions: z.string().min(1).max(4000),
  choice: z
    .object({
      seconds: z.number().int().min(5).max(180),
      options: z.array(oralOptionSchema).min(2).max(8),
      /** opciones filtradas por la elección hecha en otra tarea (T5 ← T4) */
      linked: z.object({ task_position: z.number().int().min(1).max(12), part_key: key }).optional(),
    })
    .optional(),
  read_seconds: z.number().int().min(0).max(600).default(0),
  prep_seconds: z.number().int().min(0).max(900).default(0),
  notes: z.boolean().default(false),
  segments: z.array(oralSegmentSchema).max(8).optional(),
});

export const speakingContent = baseContent.extend({
  parts: z.array(oralPartSchema).min(1).max(4),
});

export const contentSchemas = {
  single_choice: singleChoiceContent,
  matching: matchingContent,
  dropdown_gap: dropdownGapContent,
  fragment_gap: fragmentGapContent,
  multi_select: multiSelectContent,
  writing: writingContent,
  speaking: speakingContent,
} satisfies Record<InteractionType, z.ZodType>;

export type SingleChoiceContent = z.infer<typeof singleChoiceContent>;
export type MatchingContent = z.infer<typeof matchingContent>;
export type DropdownGapContent = z.infer<typeof dropdownGapContent>;
export type FragmentGapContent = z.infer<typeof fragmentGapContent>;
export type MultiSelectContent = z.infer<typeof multiSelectContent>;
export type WritingContent = z.infer<typeof writingContent>;
export type SpeakingContent = z.infer<typeof speakingContent>;
export type OralPart = z.infer<typeof oralPartSchema>;
export type OralOption = z.infer<typeof oralOptionSchema>;
export type OralSegment = z.infer<typeof oralSegmentSchema>;

export type ContentIssue = { path: string; message: string };

/** Valida el contenido de una tarea y comprueba la coherencia de referencias internas. */
export function validateTaskContent(
  type: InteractionType,
  content: unknown,
  questionPositions: number[] = [],
): { ok: true; content: Record<string, unknown> } | { ok: false; issues: ContentIssue[] } {
  const parsed = contentSchemas[type].safeParse(content);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  const data = parsed.data as Record<string, unknown> & { media: Record<string, { kind: string }> };
  const issues: ContentIssue[] = [];
  const media = data.media ?? {};
  const needMedia = (k: string | undefined, kind: "audio" | "image", path: string) => {
    if (k && media[k]?.kind !== kind) issues.push({ path, message: `El recurso «${k}» no existe o no es de tipo ${kind}.` });
  };
  needMedia(data.audio_key as string | undefined, "audio", "audio_key");
  needMedia(data.image_key as string | undefined, "image", "image_key");

  const markers = (text: string) => [...text.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
  if (type === "dropdown_gap") {
    const found = markers((data as DropdownGapContent).passage);
    checkMarkers(found, questionPositions, "passage", issues);
  }
  if (type === "fragment_gap") {
    const found = (data as FragmentGapContent).passages.flatMap((p) => markers(p.body));
    checkMarkers(found, questionPositions, "passages", issues);
  }
  if (type === "speaking") {
    for (const [pi, part] of (data as SpeakingContent).parts.entries()) {
      const segs = [...(part.segments ?? []), ...(part.choice?.options.flatMap((o) => o.segments ?? []) ?? [])];
      if (segs.length === 0) issues.push({ path: `parts.${pi}`, message: "La parte no tiene ningún segmento de grabación." });
      for (const s of segs) needMedia(s.prompt_audio_key, "audio", `parts.${pi}.segments.${s.key}`);
      for (const o of part.choice?.options ?? []) needMedia(o.image_key, "image", `parts.${pi}.options.${o.key}`);
    }
  }
  if (type === "writing") {
    const w = data as WritingContent;
    for (const o of w.options ?? []) {
      if (o.word_min > o.word_max) issues.push({ path: `options.${o.key}`, message: "El mínimo de palabras supera al máximo." });
    }
    if (w.word_min && w.word_max && w.word_min > w.word_max) issues.push({ path: "word_min", message: "El mínimo de palabras supera al máximo." });
  }
  return issues.length ? { ok: false, issues } : { ok: true, content: data };
}

function checkMarkers(found: number[], positions: number[], path: string, issues: ContentIssue[]) {
  const dup = found.filter((n, i) => found.indexOf(n) !== i);
  if (dup.length) issues.push({ path, message: `Huecos repetidos: ${[...new Set(dup)].join(", ")}.` });
  for (const p of positions) {
    if (!found.includes(p)) issues.push({ path, message: `La pregunta ${p} no tiene hueco [[${p}]] en el texto.` });
  }
  for (const n of found) {
    if (positions.length && !positions.includes(n)) issues.push({ path, message: `El hueco [[${n}]] no corresponde a ninguna pregunta.` });
  }
}
