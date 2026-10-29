import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { CATEGORIES } from "@/lib/diagnosis/taxonomy";

/**
 * Capa opcional de IA (desacoplada): propone una lectura inicial de un texto escrito para que la
 * profesora la revise. Nunca asigna notas: la profesora acepta, edita o descarta cada sugerencia.
 *
 * - Solo se ejecuta en el servidor; la clave (ANTHROPIC_API_KEY) nunca llega al navegador.
 * - Se envía únicamente el enunciado y el texto del estudiante (sin nombre ni correo).
 * - Las citas que no aparecen literalmente en el texto se descartan (no se inventan errores).
 */

export const AI_MODEL = process.env.AI_MODEL ?? "claude-opus-5-5";

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SuggestionSchema = z.object({
  criteria: z.array(
    z.object({
      key: z.string(),
      suggested_band: z.number().int().min(0).max(5),
      justification: z.string(),
      evidence_quotes: z.array(z.string()),
    }),
  ),
  observations: z.array(
    z.object({
      kind: z.enum(["error", "strength", "suggestion"]),
      category: z.string(),
      quote: z.string(),
      explanation: z.string(),
      correction: z.string(),
      improved_example: z.string(),
      confidence: z.enum(["alta", "media", "baja"]),
    }),
  ),
  uncertainty: z.string(),
  summary_for_teacher: z.string(),
});

export type AiSuggestion = z.infer<typeof SuggestionSchema>;

const SYSTEM = `Eres un asistente para profesoras de español como lengua extranjera que preparan el examen SIELE.
Tu tarea es proponer una lectura inicial de un texto escrito para que la profesora la revise. Ella decide todo.

Reglas:
- Cada observación debe citar un fragmento copiado LITERALMENTE del texto del estudiante (mismas letras, tildes y signos). Si no puedes citar, no hagas la observación.
- No inventes errores. Si dudas de que algo sea un error, no lo marques o indica confianza baja.
- Todas las variedades del español son válidas (por ejemplo, «ustedes» por «vosotros», «computadora» u «ordenador», voseo). No las marques como errores.
- Distingue errores sistemáticos de errores puntuales y valora si afectan a la comprensión.
- Las bandas van de 0 a 5 según los descriptores de la rúbrica que recibes. Son sugerencias; justifícalas con evidencias.
- Valora el cumplimiento de la tarea respecto a los puntos concretos del enunciado, no por la cantidad de palabras.
- En «uncertainty» explica qué no puedes valorar con seguridad.
- Escribe en español, con frases breves y claras.`;

export interface SuggestInput {
  instructions: string;
  bullets: string[];
  stimulus?: string;
  studentText: string;
  wordRange?: string;
  criteria: { key: string; label: string; description: string; bands: { band: number; summary: string }[] }[];
  maxChars: number;
}

export type SuggestResult = { ok: true; suggestion: AiSuggestion; model: string; inputChars: number } | { ok: false; error: string };

export async function suggestWritingFeedback(input: SuggestInput): Promise<SuggestResult> {
  if (!isAiConfigured()) return { ok: false, error: "La IA no está configurada en el servidor." };
  if (!input.studentText.trim()) return { ok: false, error: "No hay texto que analizar." };
  if (input.studentText.length > input.maxChars) {
    return { ok: false, error: `El texto supera el máximo configurado para la IA (${input.maxChars} caracteres). Evalúelo manualmente.` };
  }

  const categories = CATEGORIES.map((c) => `${c.key}: ${c.label}`).join("\n");
  const rubric = input.criteria
    .map((c) => `## ${c.label} (clave: ${c.key})\n${c.description}\n${c.bands.map((b) => `Banda ${b.band}: ${b.summary}`).join("\n")}`)
    .join("\n\n");
  const prompt = `ENUNCIADO DE LA TAREA
${input.instructions}
${input.bullets.map((b) => `- ${b}`).join("\n")}
${input.stimulus ? `\nTEXTO DE ESTÍMULO\n${input.stimulus}` : ""}
${input.wordRange ? `\nExtensión recomendada: ${input.wordRange}` : ""}

RÚBRICA
${rubric}

CATEGORÍAS PERMITIDAS PARA LAS OBSERVACIONES (usa solo estas claves)
${categories}

TEXTO DEL ESTUDIANTE (entre las marcas)
<<<
${input.studentText}
>>>`;

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // fallback automático en el servidor si el modelo declina la petición
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(SuggestionSchema) },
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    if (response.stop_reason === "refusal") return { ok: false, error: "El modelo no pudo analizar este texto. Evalúelo manualmente." };
    if (response.stop_reason === "max_tokens") return { ok: false, error: "La respuesta de la IA quedó incompleta. Inténtelo de nuevo." };
    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, error: "La IA devolvió una respuesta no válida." };

    // Control de calidad en servidor: solo citas literales, categorías y criterios conocidos
    const validCategories = new Set(CATEGORIES.map((c) => c.key));
    const validCriteria = new Set(input.criteria.map((c) => c.key));
    const suggestion: AiSuggestion = {
      ...parsed,
      criteria: parsed.criteria
        .filter((c) => validCriteria.has(c.key))
        .map((c) => ({ ...c, evidence_quotes: c.evidence_quotes.filter((q) => q && input.studentText.includes(q)) })),
      observations: parsed.observations.filter((o) => o.quote && input.studentText.includes(o.quote) && validCategories.has(o.category)),
    };
    return { ok: true, suggestion, model: response.model, inputChars: input.studentText.length };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return { ok: false, error: "Límite de uso de la IA alcanzado. Inténtelo más tarde." };
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, error: "La clave de la IA no es válida." };
    if (error instanceof Anthropic.APIError) return { ok: false, error: `Error del proveedor de IA (${error.status ?? "red"}).` };
    return { ok: false, error: "No se pudo contactar con el proveedor de IA." };
  }
}
