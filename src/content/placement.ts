import type { DrillExercise } from "./refuerzo";

/**
 * Prueba de nivel: seis preguntas originales por nivel. Mide gramática, vocabulario y comprensión de
 * frases, de modo que orienta el punto de partida pero no sustituye a un simulacro corregido.
 */
export const PLACEMENT_BLOCKS: { level: "A1" | "A2" | "B1" | "B2" | "C1"; questions: DrillExercise[] }[] = [
  {
    level: "A1",
    questions: [
      { prompt: "Hola, me ___ Ana. ¿Y tú?", options: ["llamo", "llama", "llamas"], answer: 0, explanation: "Con «me», primera persona: «me llamo»." },
      { prompt: "¿De dónde ___ usted?", options: ["es", "está", "hay"], answer: 0, explanation: "El origen se expresa con «ser»." },
      { prompt: "Mi hermana ___ veinte años.", options: ["tiene", "es", "hace"], answer: 0, explanation: "La edad se expresa con «tener»." },
      { prompt: "En mi calle ___ dos farmacias.", options: ["hay", "están", "son"], answer: 0, explanation: "Para decir que algo existe se usa «hay»." },
      { prompt: "Los libros están ___ la mesa.", options: ["en", "de", "con"], answer: 0, explanation: "«En» indica el lugar." },
      { prompt: "Me gusta ___ café con leche.", options: ["el", "la", "los"], answer: 0, explanation: "«Café» es masculino y singular." },
    ],
  },
  {
    level: "A2",
    questions: [
      { prompt: "Ayer ___ al cine con mis amigos.", options: ["fui", "voy", "iré"], answer: 0, explanation: "«Ayer» pide un pasado terminado." },
      { prompt: "Cuando era pequeño, ___ en un pueblo.", options: ["vivía", "vivo", "viviré"], answer: 0, explanation: "Una etapa del pasado se describe en imperfecto." },
      { prompt: "¿Has ___ alguna vez en México?", options: ["estado", "estar", "estás"], answer: 0, explanation: "Pretérito perfecto: «haber» + participio." },
      { prompt: "Este verano es ___ caluroso que el anterior.", options: ["más", "muy", "mucho"], answer: 0, explanation: "Comparativo: «más… que»." },
      { prompt: "A mis padres no ___ gusta viajar en avión.", options: ["les", "los", "se"], answer: 0, explanation: "Con «gustar», el pronombre es indirecto: «les»." },
      { prompt: "Según la radio, mañana ___ a llover.", options: ["va", "es", "está"], answer: 0, explanation: "Futuro próximo: «ir a» + infinitivo." },
    ],
  },
  {
    level: "B1",
    questions: [
      { prompt: "Espero que ___ buen tiempo el fin de semana.", options: ["haga", "hace", "hizo"], answer: 0, explanation: "«Esperar que» pide subjuntivo." },
      { prompt: "Si tengo tiempo, te ___ esta noche.", options: ["llamaré", "llamaría", "llamara"], answer: 0, explanation: "Si + presente, futuro en la consecuencia." },
      { prompt: "Cuando ___ a casa, te aviso.", options: ["llegue", "llegaré", "llegaba"], answer: 0, explanation: "«Cuando» con valor de futuro lleva subjuntivo." },
      { prompt: "Me dijo que ___ cansado y que no vendría.", options: ["estaba", "estará", "esté"], answer: 0, explanation: "Estilo indirecto en pasado: el presente pasa a imperfecto." },
      { prompt: "No encuentro las llaves: creo que ___ he dejado en el coche.", options: ["las", "les", "lo"], answer: 0, explanation: "Objeto directo femenino plural: «las»." },
      { prompt: "He estudiado mucho; ___, el examen me ha parecido difícil.", options: ["sin embargo", "por eso", "además"], answer: 0, explanation: "Contraste entre las dos ideas: «sin embargo»." },
    ],
  },
  {
    level: "B2",
    questions: [
      { prompt: "Si hubiera salido antes, no ___ el tren.", options: ["habría perdido", "perdí", "he perdido"], answer: 0, explanation: "Condición pasada no cumplida: «habría» + participio." },
      { prompt: "Busco un piso que ___ cerca del trabajo; de momento no he encontrado ninguno.", options: ["esté", "está", "estaba"], answer: 0, explanation: "Algo que todavía no se conoce: subjuntivo." },
      { prompt: "Aunque ___ mañana, iremos de excursión: la decisión ya está tomada.", options: ["llueva", "llueve", "llovió"], answer: 0, explanation: "Hecho futuro no comprobado: «aunque» + subjuntivo." },
      { prompt: "El informe ___ por la directora la semana pasada.", options: ["fue revisado", "estuvo revisado", "ha revisado"], answer: 0, explanation: "Voz pasiva de un hecho puntual: «ser» + participio." },
      { prompt: "No es que no ___ ayudarte, es que hoy me resulta imposible.", options: ["quiera", "quiero", "querré"], answer: 0, explanation: "«No es que» niega una causa y pide subjuntivo." },
      { prompt: "La reunión se aplazó ___ la falta de asistentes.", options: ["debido a", "a pesar de", "con tal de"], answer: 0, explanation: "Expresa la causa." },
    ],
  },
  {
    level: "C1",
    questions: [
      { prompt: "De ___ sabido, habría actuado de otra manera.", options: ["haberlo", "lo haber", "habiéndolo"], answer: 0, explanation: "«De» + infinitivo compuesto equivale a una condición, y el pronombre va unido al infinitivo: «de haberlo sabido»." },
      { prompt: "Por mucho que ___, no lograrás convencerla.", options: ["insistas", "insistirás", "insististe"], answer: 0, explanation: "Concesión referida al futuro: subjuntivo." },
      { prompt: "Se marchó sin que nadie ___ cuenta.", options: ["se diera", "se da", "se dará"], answer: 0, explanation: "«Sin que» exige subjuntivo; aquí, en pasado." },
      { prompt: "El ministro ha ___ su dimisión esta mañana.", options: ["presentado", "hecho", "puesto"], answer: 0, explanation: "La combinación habitual es «presentar la dimisión»." },
      { prompt: "Decir que alguien «tiene mano izquierda» significa que…", options: ["sabe tratar con tacto las situaciones difíciles", "es zurdo y escribe mal", "no es una persona de fiar"], answer: 0, explanation: "Expresión idiomática: habilidad y tacto." },
      { prompt: "No solo no se disculpó, ___ encima nos culpó a nosotros.", options: ["sino que", "pero que", "aunque"], answer: 0, explanation: "Tras «no solo», con un verbo, se usa «sino que»." },
    ],
  },
];
