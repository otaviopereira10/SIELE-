import type { Skill } from "@/lib/exam/content-schema";

export type CategoryArea = "grammar" | "spelling" | "lexis" | "cohesion" | "task" | "oral";

export interface ErrorCategory {
  key: string;
  label: string;
  area: CategoryArea;
  skills: Skill[];
  /** criterio de la rúbrica con el que se relaciona normalmente */
  criterion: string;
  module: string;
  hint: string;
}

/**
 * Taxonomía de observaciones docentes. La profesora etiqueta cada evidencia del texto o de la
 * grabación con una categoría; el diagnóstico agrupa las repeticiones y propone el módulo de refuerzo.
 */
export const CATEGORIES: ErrorCategory[] = [
  { key: "gram.pasados", label: "Pretérito indefinido e imperfecto", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "pasados", hint: "Hechos terminados frente a descripciones y hábitos del pasado." },
  { key: "gram.ser_estar", label: "Ser y estar", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "ser-estar", hint: "Identidad y características frente a estados y ubicación." },
  { key: "gram.subjuntivo", label: "Usos del subjuntivo", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "subjuntivo", hint: "Deseo, valoración, duda y finalidad." },
  { key: "gram.por_para", label: "Por y para", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "por-para", hint: "Causa y medio frente a finalidad y destino." },
  { key: "gram.concordancia", label: "Concordancia de género y número", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "concordancia", hint: "Sustantivo, artículo, adjetivo y verbo deben concordar." },
  { key: "gram.preposiciones", label: "Preposiciones", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "preposiciones", hint: "Régimen de verbos frecuentes y expresiones de lugar y tiempo." },
  { key: "gram.pronombres", label: "Pronombres de objeto", area: "grammar", skills: ["writing", "speaking"], criterion: "correccion", module: "pronombres", hint: "lo / la / le, se lo, posición del pronombre." },
  { key: "gram.hipotesis", label: "Condicional e hipótesis", area: "grammar", skills: ["writing", "speaking"], criterion: "alcance", module: "hipotesis", hint: "Si + imperfecto de subjuntivo + condicional." },
  { key: "ort.acentuacion", label: "Acentuación", area: "spelling", skills: ["writing"], criterion: "correccion", module: "acentuacion", hint: "Agudas, llanas, esdrújulas y tilde diacrítica." },
  { key: "ort.puntuacion", label: "Puntuación", area: "spelling", skills: ["writing"], criterion: "cohesion", module: "puntuacion", hint: "Comas, punto y seguido, signos de apertura." },
  { key: "lex.precision", label: "Precisión léxica", area: "lexis", skills: ["writing", "speaking"], criterion: "alcance", module: "precision-lexica", hint: "Palabras generales (cosa, hacer, bueno) en lugar de términos precisos." },
  { key: "lex.repeticion", label: "Repetición de vocabulario", area: "lexis", skills: ["writing", "speaking"], criterion: "alcance", module: "variedad-lexica", hint: "Sinónimos, hiperónimos y reformulación." },
  { key: "lex.registro", label: "Registro formal o informal", area: "lexis", skills: ["writing", "speaking"], criterion: "cumplimiento", module: "registro", hint: "Tú / usted, saludos, despedidas y fórmulas." },
  { key: "coh.conectores", label: "Conectores del discurso", area: "cohesion", skills: ["writing", "speaking"], criterion: "cohesion", module: "conectores", hint: "Añadir, contraponer, explicar causa y consecuencia, concluir." },
  { key: "coh.organizacion", label: "Organización del texto", area: "cohesion", skills: ["writing"], criterion: "cohesion", module: "organizacion", hint: "Párrafos con una idea central y progresión." },
  { key: "coh.referencia", label: "Mecanismos de referencia", area: "cohesion", skills: ["writing", "speaking"], criterion: "cohesion", module: "variedad-lexica", hint: "Pronombres, sinónimos y elipsis para no repetir." },
  { key: "task.puntos", label: "Puntos del enunciado sin tratar", area: "task", skills: ["writing", "speaking"], criterion: "cumplimiento", module: "cumplir-enunciado", hint: "Responder a todos los puntos, también saludo y despedida." },
  { key: "task.desarrollo", label: "Desarrollo insuficiente", area: "task", skills: ["writing", "speaking"], criterion: "cumplimiento", module: "desarrollar-ideas", hint: "Detalles, ejemplos y explicaciones en cada punto." },
  { key: "task.genero", label: "Convenciones del género textual", area: "task", skills: ["writing"], criterion: "cumplimiento", module: "generos", hint: "Mensaje personal, artículo de opinión, carta al director." },
  { key: "oral.argumentacion", label: "Argumentación oral", area: "oral", skills: ["speaking"], criterion: "cumplimiento", module: "argumentar-oral", hint: "Opinión, razones, ejemplo, objeción, respuesta y conclusión." },
  { key: "oral.fluidez", label: "Fluidez y pausas", area: "oral", skills: ["speaking"], criterion: "uso_lengua", module: "fluidez", hint: "Recursos para ganar tiempo y enlazar ideas sin bloquearse." },
  { key: "oral.inteligibilidad", label: "Inteligibilidad y pronunciación", area: "oral", skills: ["speaking"], criterion: "uso_lengua", module: "inteligibilidad", hint: "Sonidos que cambian el significado y entonación de la pregunta." },
  { key: "oral.descripcion", label: "Descripción de imágenes", area: "oral", skills: ["speaking"], criterion: "cumplimiento", module: "describir-imagen", hint: "Personas, acciones, lugar, objetos y sensaciones." },
  { key: "oral.respuesta_breve", label: "Respuestas demasiado breves", area: "oral", skills: ["speaking"], criterion: "cumplimiento", module: "desarrollar-ideas", hint: "Ampliar con razones, ejemplos y experiencias." },
];

const byKey = new Map(CATEGORIES.map((c) => [c.key, c]));

export function categoryLabel(key: string): string {
  return byKey.get(key)?.label ?? key;
}

export function getCategory(key: string): ErrorCategory | undefined {
  return byKey.get(key);
}

export const AREA_LABEL: Record<CategoryArea, string> = {
  grammar: "Gramática",
  spelling: "Ortografía",
  lexis: "Léxico",
  cohesion: "Cohesión",
  task: "Cumplimiento de la tarea",
  oral: "Expresión oral",
};
