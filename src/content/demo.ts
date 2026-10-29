import type { Skill } from "@/lib/exam/content-schema";
import type { RunnerOption, RunnerQuestion, RunnerTask } from "@/lib/exam/types";

/**
 * Demostración pública: una tarea breve de cada prueba con contenido original.
 * Es material de muestra (no de examen): las claves viajan al navegador y nada se guarda.
 */
export interface DemoStep {
  skill: Skill;
  task: RunnerTask;
  questions: RunnerQuestion[];
  bank: RunnerOption[];
  keys: Record<string, { correct: string[]; explanation: string }>;
  media: Record<string, { url: string; synthetic?: boolean }>;
}

const q = (id: string, position: number, prompt: string, options: [string, string][]) => ({
  id,
  position,
  prompt,
  max_selections: 1,
  options: options.map(([oid, body], i) => ({ id: oid, label: String.fromCharCode(97 + i), body })),
});

export const DEMO_STEPS: DemoStep[] = [
  {
    skill: "reading",
    task: {
      id: "demo-cl",
      position: 1,
      title: "Tarea 1",
      interaction_type: "single_choice",
      instructions: "Va a leer dos textos breves. Elija la opción correcta para cada pregunta.",
      declared_items: 2,
      max_audio_plays: 0,
      content: {
        media: {},
        texts: [
          {
            key: "a",
            label: "Texto 1",
            title: "Piscina municipal",
            body: "A partir del lunes, la piscina abre de 7:00 a 21:00. Los menores de 12 años tienen que venir con una persona adulta. Es obligatorio usar gorro de baño.",
            question_positions: [1],
          },
          {
            key: "b",
            label: "Texto 2",
            body: "Hola, Rosa: Esta tarde no puedo ir a clase de baile porque tengo que llevar a mi hijo al médico. ¿Me puedes contar luego qué pasos aprendisteis? Gracias, Leo",
            question_positions: [2],
          },
        ],
      },
    },
    questions: [
      q("d1", 1, "En la piscina, los niños pequeños…", [
        ["d1a", "no pueden entrar."],
        ["d1b", "deben ir acompañados."],
        ["d1c", "no necesitan gorro."],
      ]),
      q("d2", 2, "Leo escribe a Rosa para…", [
        ["d2a", "invitarla al médico."],
        ["d2b", "cancelar la clase de baile."],
        ["d2c", "pedirle información sobre la clase."],
      ]),
    ],
    bank: [],
    keys: {
      d1: { correct: ["d1b"], explanation: "«Los menores de 12 años tienen que venir con una persona adulta»." },
      d2: { correct: ["d2c"], explanation: "Leo no puede ir y pregunta qué pasos aprendieron." },
    },
    media: {},
  },
  {
    skill: "listening",
    task: {
      id: "demo-ca",
      position: 1,
      title: "Tarea 1",
      interaction_type: "single_choice",
      instructions: "Va a escuchar un mensaje en un contestador. Elija la opción correcta. Puede escuchar el mensaje dos veces.",
      declared_items: 2,
      max_audio_plays: 2,
      content: { audio_key: "main", media: { main: { asset_id: "00000000-0000-4000-8000-000000000001", kind: "audio", label: "Mensaje" } } },
    },
    questions: [
      q("d3", 1, "Paula propone ir al cine…", [
        ["d3a", "el viernes."],
        ["d3b", "el sábado."],
        ["d3c", "el domingo."],
      ]),
      q("d4", 2, "¿Dónde quedan?", [
        ["d4a", "En la puerta del cine."],
        ["d4b", "En casa de Paula."],
        ["d4c", "En la taquilla, para comprar las entradas."],
      ]),
    ],
    bank: [],
    keys: {
      d3: { correct: ["d3b"], explanation: "El viernes trabaja hasta tarde y propone el sábado." },
      d4: { correct: ["d4a"], explanation: "«Podemos quedar a las siete en la puerta». Ella compra las entradas por internet." },
    },
    media: { main: { url: "/demo/demo-ca.mp3", synthetic: true } },
  },
  {
    skill: "writing",
    task: {
      id: "demo-eie",
      position: 1,
      title: "Tarea 1",
      interaction_type: "writing",
      instructions: "Responda al mensaje de Paula. En su respuesta debe:",
      declared_items: 0,
      max_audio_plays: 0,
      content: {
        media: {},
        bullets: ["saludarla;", "decir si puede ir al cine el sábado;", "proponer qué hacer después de la película;", "despedirse."],
        stimulus: { body: "¡Hola! Al final no puedo ir al cine el viernes. ¿Te va bien el sábado a las siete? Después podemos hacer algo. ¡Dime algo! Paula" },
        word_min: 60,
        word_max: 90,
        keyboard: true,
      },
    },
    questions: [],
    bank: [],
    keys: {},
    media: {},
  },
  {
    skill: "speaking",
    task: {
      id: "demo-eio",
      position: 1,
      title: "Tarea 1",
      interaction_type: "speaking",
      instructions: "Conteste a una pregunta personal.",
      declared_items: 0,
      max_audio_plays: 2,
      content: {
        media: { q1: { asset_id: "00000000-0000-4000-8000-000000000002", kind: "audio" } },
        parts: [
          {
            key: "p1",
            instructions: "Escuche la pregunta. La grabación empieza automáticamente a los 10 segundos, o antes si pulsa «Grabar». Tiene 30 segundos para responder.",
            read_seconds: 0,
            prep_seconds: 0,
            notes: false,
            segments: [{ key: "q1", prompt_audio_key: "q1", wait_seconds: 10, record_seconds: 30 }],
          },
        ],
      },
    },
    questions: [],
    bank: [],
    keys: {},
    media: { q1: { url: "/demo/demo-eio.mp3", synthetic: true } },
  },
];
