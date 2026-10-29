import type { Skill } from "@/lib/exam/content-schema";

/**
 * Biblioteca de refuerzo: micro-lecciones originales con explicación breve, ejemplos y ejercicios
 * autocorregibles. Son material de aprendizaje (no de examen), por eso las soluciones viajan al navegador.
 */
export interface DrillExercise {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface RefuerzoModule {
  key: string;
  title: string;
  skill: Skill | "general";
  activity: "grammar" | "vocabulary" | "receptive" | "writing" | "speaking";
  level: string;
  minutes: number;
  summary: string;
  explanation: string[];
  examples: { wrong?: string; right: string; note: string }[];
  steps?: string[];
  speakingPrompt?: string;
  exercises: DrillExercise[];
}

export const MODULES: RefuerzoModule[] = [
  {
    key: "pasados",
    title: "Pretérito indefinido e imperfecto",
    skill: "general",
    activity: "grammar",
    level: "A2–B1",
    minutes: 15,
    summary: "Elegir entre «fui» y «iba» según si el hecho está terminado o si se describe el contexto.",
    explanation: [
      "El pretérito indefinido (fui, comí, vivió) presenta acciones terminadas y delimitadas: ocurrieron y se cerraron.",
      "El imperfecto (iba, comía, vivía) describe el escenario: cómo eran las cosas, qué pasaba habitualmente o qué estaba ocurriendo cuando sucedió otra cosa.",
      "Truco de narrador: el indefinido hace avanzar la historia; el imperfecto la detiene para describir.",
    ],
    examples: [
      { wrong: "Ayer era un día muy bonito y fuimos a la playa; el agua fue fría.", right: "Ayer fue un día muy bonito: fuimos a la playa, aunque el agua estaba fría.", note: "La valoración global de un día terminado va en indefinido; el estado del agua, en imperfecto o con «estar»." },
      { wrong: "Cuando fui pequeño, vivía en Lima.", right: "Cuando era pequeño, vivía en Lima.", note: "Una etapa de la vida se describe en imperfecto." },
      { right: "Estaba cocinando cuando sonó el teléfono.", note: "Acción en curso (imperfecto) interrumpida por un hecho puntual (indefinido)." },
    ],
    exercises: [
      { prompt: "El verano pasado ___ a Cuba con mis primos.", options: ["viajé", "viajaba"], answer: 0, explanation: "Viaje concreto y terminado: indefinido." },
      { prompt: "De niña, ___ todos los domingos a casa de mi abuela.", options: ["fui", "iba"], answer: 1, explanation: "Hábito en el pasado: imperfecto." },
      { prompt: "La casa ___ grande y tenía un jardín precioso.", options: ["fue", "era"], answer: 1, explanation: "Descripción del escenario: imperfecto." },
      { prompt: "Mientras yo leía, mi hermano ___ la cena.", options: ["preparó", "preparaba"], answer: 1, explanation: "Dos acciones simultáneas en desarrollo: imperfecto." },
      { prompt: "La fiesta ___ estupenda: bailamos hasta las tres.", options: ["fue", "era"], answer: 0, explanation: "Valoración de un acontecimiento terminado: indefinido." },
    ],
  },
  {
    key: "ser-estar",
    title: "Ser y estar",
    skill: "general",
    activity: "grammar",
    level: "A1–B1",
    minutes: 10,
    summary: "Ser identifica y caracteriza; estar sitúa y expresa estados o resultados.",
    explanation: [
      "Ser: identidad, origen, profesión, características que definen, hora, lugar de un evento («La reunión es en la sala 3»).",
      "Estar: ubicación de personas y cosas, estados físicos o de ánimo, resultado de un cambio («La tienda está cerrada»).",
      "Algunos adjetivos cambian de significado: ser listo (inteligente) / estar listo (preparado); ser aburrido / estar aburrido.",
    ],
    examples: [
      { wrong: "Mi casa es cerca del metro.", right: "Mi casa está cerca del metro.", note: "Ubicación: estar." },
      { wrong: "El concierto está en el estadio.", right: "El concierto es en el estadio.", note: "Lugar donde se celebra un evento: ser." },
      { right: "Mi hermana es muy tranquila, pero hoy está nerviosa.", note: "Carácter frente a estado puntual." },
    ],
    exercises: [
      { prompt: "La biblioteca ___ en la plaza mayor.", options: ["es", "está"], answer: 1, explanation: "Ubicación de un lugar: estar." },
      { prompt: "La boda ___ en una finca a las afueras.", options: ["es", "está"], answer: 0, explanation: "Evento: ser." },
      { prompt: "No puedo salir: ___ enferma desde el lunes.", options: ["soy", "estoy"], answer: 1, explanation: "Estado físico: estar." },
      { prompt: "Mi compañero de piso ___ ingeniero.", options: ["es", "está"], answer: 0, explanation: "Profesión: ser." },
    ],
  },
  {
    key: "subjuntivo",
    title: "Usos frecuentes del subjuntivo",
    skill: "general",
    activity: "grammar",
    level: "B1–B2",
    minutes: 15,
    summary: "Subjuntivo para deseos, valoraciones, dudas, finalidad y el futuro con «cuando».",
    explanation: [
      "Con verbos de deseo o influencia y dos sujetos distintos: «Quiero que vengas».",
      "Con valoraciones: «Es importante que los gobiernos inviertan…».",
      "Tras «para que», «cuando» (con valor de futuro), «aunque» (concesión no asumida) y «ojalá».",
      "Con «creo que» afirmativo va indicativo; con «no creo que», subjuntivo.",
    ],
    examples: [
      { wrong: "Es necesario que la gente recicla más.", right: "Es necesario que la gente recicle más.", note: "Valoración: subjuntivo." },
      { wrong: "Cuando terminaré la carrera, viajaré.", right: "Cuando termine la carrera, viajaré.", note: "«Cuando» + futuro → presente de subjuntivo." },
      { right: "No creo que sea la única solución.", note: "Opinión negada: subjuntivo." },
    ],
    exercises: [
      { prompt: "Te llamo para que me ___ con la mudanza.", options: ["ayudas", "ayudes"], answer: 1, explanation: "Finalidad con «para que»: subjuntivo." },
      { prompt: "Creo que el transporte público ___ la mejor opción.", options: ["es", "sea"], answer: 0, explanation: "«Creo que» afirmativo: indicativo." },
      { prompt: "Es fundamental que los jóvenes ___ acceso a la vivienda.", options: ["tienen", "tengan"], answer: 1, explanation: "Valoración: subjuntivo." },
      { prompt: "Ojalá ___ buen tiempo el sábado.", options: ["hace", "haga"], answer: 1, explanation: "Deseo con «ojalá»: subjuntivo." },
    ],
  },
  {
    key: "por-para",
    title: "Por y para",
    skill: "general",
    activity: "grammar",
    level: "A2–B1",
    minutes: 10,
    summary: "«Para» mira hacia el objetivo; «por» explica la causa, el medio o el recorrido.",
    explanation: [
      "Para: finalidad (para aprender), destinatario (es para ti), destino (salgo para Quito), plazo (para el lunes), opinión (para mí).",
      "Por: causa (por la lluvia), medio (por correo), lugar de paso (por el parque), tiempo aproximado (por la tarde), intercambio (por diez euros).",
    ],
    examples: [
      { wrong: "Estudio español por trabajar en México.", right: "Estudio español para trabajar en México.", note: "Finalidad." },
      { wrong: "Cancelaron el partido para la lluvia.", right: "Cancelaron el partido por la lluvia.", note: "Causa." },
    ],
    exercises: [
      { prompt: "Te envío el informe ___ correo electrónico.", options: ["por", "para"], answer: 0, explanation: "Medio: por." },
      { prompt: "Necesito el documento ___ el viernes.", options: ["por", "para"], answer: 1, explanation: "Plazo: para." },
      { prompt: "Gracias ___ tu ayuda.", options: ["por", "para"], answer: 0, explanation: "Causa del agradecimiento: por." },
      { prompt: "___ mí, la mejor solución es dialogar.", options: ["Por", "Para"], answer: 1, explanation: "Opinión: para mí." },
    ],
  },
  {
    key: "concordancia",
    title: "Concordancia de género y número",
    skill: "general",
    activity: "grammar",
    level: "A1–A2",
    minutes: 10,
    summary: "Artículos, adjetivos y verbos deben coincidir con el sustantivo al que acompañan.",
    explanation: [
      "Revise siempre el grupo completo: «las ciudades grandes», «el problema principal».",
      "Ojo con palabras frecuentes de género no previsible: el problema, el tema, el día, la mano, la gente (singular).",
      "«La gente» es singular: «La gente piensa…», no «La gente piensan…».",
    ],
    examples: [
      { wrong: "Los problemas ambiental son graves.", right: "Los problemas ambientales son graves.", note: "Adjetivo en plural." },
      { wrong: "La gente están preocupados.", right: "La gente está preocupada.", note: "«Gente» concuerda en singular femenino." },
    ],
    exercises: [
      { prompt: "Este ___ es muy interesante.", options: ["tema", "tema nueva"], answer: 0, explanation: "«Tema» es masculino: «este tema»." },
      { prompt: "La gente ___ más en transporte público.", options: ["viaja", "viajan"], answer: 0, explanation: "«Gente» va con verbo en singular." },
      { prompt: "Tengo unas vecinas muy ___.", options: ["simpáticos", "simpáticas"], answer: 1, explanation: "Femenino plural." },
      { prompt: "Fue ___ día inolvidable.", options: ["un", "una"], answer: 0, explanation: "«Día» es masculino." },
    ],
  },
  {
    key: "preposiciones",
    title: "Preposiciones frecuentes",
    skill: "general",
    activity: "grammar",
    level: "A2–B2",
    minutes: 10,
    summary: "Verbos con preposición fija y expresiones de lugar y tiempo.",
    explanation: [
      "Algunos verbos exigen preposición: pensar en, soñar con, depender de, consistir en, casarse con, acordarse de.",
      "Persona como objeto directo lleva «a»: «Visité a mi tía».",
      "Tiempo: en verano, el lunes (sin preposición), a las tres, por la mañana.",
    ],
    examples: [
      { wrong: "Pienso a mi familia.", right: "Pienso en mi familia.", note: "Pensar en." },
      { wrong: "Conocí mi pareja en la universidad.", right: "Conocí a mi pareja en la universidad.", note: "«a» personal." },
    ],
    exercises: [
      { prompt: "Todo depende ___ la financiación.", options: ["de", "en"], answer: 0, explanation: "Depender de." },
      { prompt: "El proyecto consiste ___ plantar árboles.", options: ["de", "en"], answer: 1, explanation: "Consistir en." },
      { prompt: "Nos vemos ___ las ocho.", options: ["a", "en"], answer: 0, explanation: "Hora: a las ocho." },
      { prompt: "Ayer llamé ___ mi abuelo.", options: ["—", "a"], answer: 1, explanation: "Objeto directo de persona." },
    ],
  },
  {
    key: "pronombres",
    title: "Pronombres de objeto",
    skill: "general",
    activity: "grammar",
    level: "A2–B1",
    minutes: 10,
    summary: "lo/la/los/las, le/les y la combinación «se lo».",
    explanation: [
      "Objeto directo: lo, la, los, las («El libro lo compré ayer»).",
      "Objeto indirecto: le, les («Le di las llaves a Marta»). Le + lo → se lo («Se lo di»).",
      "Posición: delante del verbo conjugado o unido al infinitivo, gerundio e imperativo afirmativo («Voy a dártelo», «Dímelo»).",
    ],
    examples: [
      { wrong: "Le lo expliqué a mi jefe.", right: "Se lo expliqué a mi jefe.", note: "le + lo → se lo." },
      { wrong: "La compré a mi madre un regalo.", right: "Le compré un regalo a mi madre.", note: "Destinatario: objeto indirecto." },
    ],
    exercises: [
      { prompt: "¿Las entradas? Ya ___ he comprado.", options: ["las", "les"], answer: 0, explanation: "Objeto directo femenino plural." },
      { prompt: "A mis padres ___ encanta viajar.", options: ["los", "les"], answer: 1, explanation: "Con «encantar», objeto indirecto." },
      { prompt: "¿Le diste el mensaje a Juan? Sí, ___ di ayer.", options: ["se lo", "le lo"], answer: 0, explanation: "le + lo → se lo." },
      { prompt: "Quiero ___ antes del viernes.", options: ["terminarlo", "lo terminar"], answer: 0, explanation: "Unido al infinitivo." },
    ],
  },
  {
    key: "hipotesis",
    title: "Hipótesis y condiciones",
    skill: "general",
    activity: "grammar",
    level: "B1–C1",
    minutes: 15,
    summary: "Si + presente, si + imperfecto de subjuntivo y si + pluscuamperfecto de subjuntivo.",
    explanation: [
      "Condición posible: «Si tengo tiempo, te llamo / te llamaré».",
      "Condición improbable o imaginaria en el presente: «Si tuviera más tiempo, aprendería a tocar el piano».",
      "Condición pasada no cumplida: «Si hubiera estudiado, habría aprobado».",
      "En la Tarea 4 oral suele haber una pregunta hipotética: conviene responder con esta estructura.",
    ],
    examples: [
      { wrong: "Si sería alcalde, construiría más parques.", right: "Si fuera alcalde, construiría más parques.", note: "Tras «si» nunca va condicional." },
      { right: "Si me hubieran avisado antes, habría ido.", note: "Pasado imaginario." },
    ],
    exercises: [
      { prompt: "Si ___ dinero, viajaría por toda Sudamérica.", options: ["tendría", "tuviera"], answer: 1, explanation: "Si + imperfecto de subjuntivo." },
      { prompt: "Si llueve mañana, ___ en casa.", options: ["nos quedaremos", "nos quedaríamos"], answer: 0, explanation: "Condición posible: futuro o presente." },
      { prompt: "Si hubiera salido antes, no ___ el tren.", options: ["perdería", "habría perdido"], answer: 1, explanation: "Pasado no cumplido." },
      { prompt: "Yo que tú, ___ con ella.", options: ["hablaría", "hable"], answer: 0, explanation: "Consejo con condicional." },
    ],
  },
  {
    key: "acentuacion",
    title: "Acentuación gráfica",
    skill: "writing",
    activity: "grammar",
    level: "A2–B2",
    minutes: 10,
    summary: "Reglas generales y tilde diacrítica en palabras frecuentes.",
    explanation: [
      "Agudas (acento en la última sílaba) llevan tilde si terminan en vocal, -n o -s: canción, café.",
      "Llanas llevan tilde si NO terminan en vocal, -n o -s: árbol, fácil.",
      "Esdrújulas siempre: teléfono, música.",
      "Diacríticas frecuentes: tú/tu, él/el, más/mas, sí/si, qué/que en preguntas y exclamaciones.",
    ],
    examples: [
      { wrong: "Tu tienes razon.", right: "Tú tienes razón.", note: "Pronombre «tú» y aguda en -n." },
      { wrong: "¿Que opinas?", right: "¿Qué opinas?", note: "Interrogativo." },
    ],
    exercises: [
      { prompt: "Elija la forma correcta:", options: ["Me gusta mucho la musica.", "Me gusta mucho la música."], answer: 1, explanation: "Esdrújula: siempre tilde." },
      { prompt: "Elija la forma correcta:", options: ["El dijo que si vendría.", "Él dijo que sí vendría."], answer: 1, explanation: "Pronombre «él» y afirmación «sí»." },
      { prompt: "Elija la forma correcta:", options: ["Es un problema dificil.", "Es un problema difícil."], answer: 1, explanation: "Llana terminada en -l." },
      { prompt: "Elija la forma correcta:", options: ["No se cuando llega.", "No sé cuándo llega."], answer: 1, explanation: "«sé» del verbo saber e interrogativo indirecto." },
    ],
  },
  {
    key: "puntuacion",
    title: "Puntuación que ordena el texto",
    skill: "writing",
    activity: "writing",
    level: "A2–B2",
    minutes: 10,
    summary: "Comas, puntos y signos de apertura para que el texto se lea con claridad.",
    explanation: [
      "En español se abren las preguntas y exclamaciones: ¿…? ¡…!",
      "Coma después de conectores al inicio de frase: «Sin embargo, …», «Por otro lado, …».",
      "No separe con coma el sujeto del verbo: «La contaminación en las ciudades, es grave» ✗.",
      "Use punto y seguido para separar ideas; evite frases de cinco líneas unidas por comas.",
    ],
    examples: [
      { wrong: "Que tal estas? Yo bien, te escribo porque, tengo noticias.", right: "¿Qué tal estás? Yo, bien. Te escribo porque tengo noticias.", note: "Apertura, tildes y comas." },
    ],
    exercises: [
      { prompt: "¿Qué opción está bien puntuada?", options: ["Sin embargo no todos están de acuerdo.", "Sin embargo, no todos están de acuerdo."], answer: 1, explanation: "Coma tras el conector inicial." },
      { prompt: "¿Qué opción está bien puntuada?", options: ["Los jóvenes de hoy, leen menos.", "Los jóvenes de hoy leen menos."], answer: 1, explanation: "No se separa sujeto y verbo." },
      { prompt: "¿Qué opción está bien puntuada?", options: ["¡Qué alegría verte!", "Qué alegría verte!"], answer: 0, explanation: "Signo de apertura." },
    ],
  },
  {
    key: "precision-lexica",
    title: "Precisión léxica",
    skill: "general",
    activity: "vocabulary",
    level: "B1–C1",
    minutes: 10,
    summary: "Sustituir palabras comodín (cosa, hacer, tener, bueno) por términos exactos.",
    explanation: [
      "Las palabras generales hacen el texto vago y bajan la valoración del alcance.",
      "Cambie «hacer» por el verbo preciso: hacer una pregunta → plantear; hacer daño → perjudicar; hacer una casa → construir.",
      "Cambie «cosa» por el sustantivo concreto: aspecto, medida, problema, ventaja, iniciativa.",
    ],
    examples: [
      { wrong: "Hay muchas cosas buenas en esta medida.", right: "Esta medida presenta numerosas ventajas.", note: "Sustantivo y verbo precisos." },
      { wrong: "El gobierno tiene que hacer algo con el tráfico.", right: "El gobierno debe adoptar medidas para reducir el tráfico.", note: "Colocación «adoptar medidas»." },
    ],
    exercises: [
      { prompt: "«Las redes sociales ___ la manera en que nos comunicamos.»", options: ["han hecho", "han transformado"], answer: 1, explanation: "Verbo preciso." },
      { prompt: "«Es necesario ___ conciencia sobre el reciclaje.»", options: ["hacer", "tomar"], answer: 1, explanation: "Colocación: tomar conciencia." },
      { prompt: "«Uno de los ___ más graves es el desempleo juvenil.»", options: ["problemas", "cosas"], answer: 0, explanation: "Sustantivo concreto." },
      { prompt: "«La empresa ___ un nuevo plan de igualdad.»", options: ["puso en marcha", "hizo"], answer: 0, explanation: "Expresión precisa." },
    ],
  },
  {
    key: "variedad-lexica",
    title: "Variedad léxica y referencia",
    skill: "general",
    activity: "vocabulary",
    level: "B1–B2",
    minutes: 10,
    summary: "Evitar repeticiones con sinónimos, hiperónimos, pronombres y elipsis.",
    explanation: [
      "Si repite una palabra clave, alterne con sinónimos («vivienda / piso / hogar») o con hiperónimos («el coche… este vehículo»).",
      "Use pronombres y demostrativos para retomar ideas: «esto», «dicha medida», «la cual».",
      "La elipsis evita repetir el sujeto: «Mi hermana vive en Madrid. Trabaja en un hospital».",
    ],
    examples: [
      { wrong: "El reciclaje es importante. El reciclaje ayuda al planeta. El reciclaje es fácil.", right: "El reciclaje es importante: ayuda al planeta y, además, es una práctica sencilla.", note: "Elipsis y reformulación." },
    ],
    exercises: [
      { prompt: "«Compré una bicicleta. ___ me permite ir al trabajo sin contaminar.»", options: ["La bicicleta", "Este medio de transporte"], answer: 1, explanation: "Hiperónimo para no repetir." },
      { prompt: "«El ayuntamiento aprobó la ley. ___ entrará en vigor en enero.»", options: ["Dicha norma", "La ley que aprobó el ayuntamiento"], answer: 0, explanation: "Referencia anafórica." },
      { prompt: "¿Qué sinónimo encaja? «Los ciudadanos… los ___»", options: ["habitantes", "edificios"], answer: 0, explanation: "Sinónimo contextual." },
    ],
  },
  {
    key: "registro",
    title: "Registro: tú, usted y fórmulas",
    skill: "general",
    activity: "writing",
    level: "A2–B2",
    minutes: 10,
    summary: "Adecuar saludo, tratamiento y despedida al destinatario.",
    explanation: [
      "Mensaje a un amigo: «¡Hola, Nuria! ¿Qué tal?» … «Un abrazo / Besos / Escríbeme pronto».",
      "Carta al director de un periódico: «Señor director:» … «Atentamente,». Tratamiento de usted si se dirige a alguien.",
      "No mezcle tratamientos en el mismo texto (tú y usted).",
    ],
    examples: [
      { wrong: "Estimada Nuria: ¿Qué tal estás, tía?", right: "¡Hola, Nuria! ¿Qué tal estás?", note: "Registro informal coherente." },
      { wrong: "Hola, periódico: os escribo porque…", right: "Señor director: Le escribo para expresar mi opinión sobre…", note: "Registro formal." },
    ],
    exercises: [
      { prompt: "Despedida adecuada en un artículo de opinión enviado a un periódico:", options: ["Besitos", "No lleva despedida; termina con una conclusión"], answer: 1, explanation: "El artículo cierra con conclusión, no con despedida personal." },
      { prompt: "Saludo adecuado para responder a una amiga:", options: ["Querida Laura:", "Muy señora mía:"], answer: 0, explanation: "Informal y afectuoso." },
      { prompt: "En una carta formal:", options: ["Le agradezco su atención.", "Te agradezco tu atención."], answer: 0, explanation: "Tratamiento de usted." },
    ],
  },
  {
    key: "conectores",
    title: "Conectores del discurso",
    skill: "general",
    activity: "writing",
    level: "B1–C1",
    minutes: 15,
    summary: "Ordenar, añadir, contraponer, explicar causa y consecuencia y concluir.",
    explanation: [
      "Ordenar: en primer lugar, por un lado / por otro, finalmente.",
      "Añadir: además, asimismo, no solo… sino también.",
      "Contraponer: sin embargo, no obstante, aunque, a pesar de (que).",
      "Causa y consecuencia: ya que, puesto que, debido a; por lo tanto, de ahí que (+ subjuntivo).",
      "Concluir: en definitiva, en conclusión, por todo lo anterior.",
      "En la Tarea 5 de lectura muchos huecos son conectores: identifique la relación lógica antes de mirar las opciones.",
    ],
    examples: [
      { wrong: "El teletrabajo ahorra tiempo. Pero aísla. Y es difícil separar vida y trabajo.", right: "Aunque el teletrabajo ahorra tiempo, puede aislar al trabajador; además, dificulta separar la vida personal de la profesional.", note: "Concesión y adición." },
    ],
    exercises: [
      { prompt: "«Las ciudades crecen; ___, faltan zonas verdes.»", options: ["sin embargo", "por lo tanto"], answer: 1, explanation: "Consecuencia." },
      { prompt: "«___ hacía frío, salimos a pasear.»", options: ["Aunque", "Ya que"], answer: 0, explanation: "Concesión." },
      { prompt: "«No solo reduce costes, ___ mejora la calidad.»", options: ["sino que también", "pero también"], answer: 0, explanation: "Estructura «no solo… sino que también»." },
      { prompt: "«___ todo lo expuesto, considero que la propuesta es positiva.»", options: ["Por", "Para"], answer: 0, explanation: "«Por todo lo expuesto» (conclusión)." },
      { prompt: "«Cerraron la carretera ___ las fuertes lluvias.»", options: ["debido a", "a pesar de"], answer: 0, explanation: "Causa." },
    ],
  },
  {
    key: "organizacion",
    title: "Organización en párrafos",
    skill: "writing",
    activity: "writing",
    level: "B1–C1",
    minutes: 15,
    summary: "Introducción, desarrollo con una idea por párrafo y conclusión.",
    explanation: [
      "Introducción: presente el tema y su relevancia en dos o tres frases.",
      "Desarrollo: un párrafo por argumento, con idea principal, explicación y ejemplo.",
      "Conclusión: recoja la postura y, si procede, una propuesta o reflexión final.",
      "En la Tarea 2 escrita (250–300 palabras) funcionan bien cuatro o cinco párrafos.",
    ],
    examples: [
      { right: "Párrafo 1 — tema y opinión · Párrafo 2 — argumento 1 + ejemplo · Párrafo 3 — argumento 2 + dato · Párrafo 4 — objeción y respuesta · Párrafo 5 — conclusión.", note: "Esquema eficaz para un texto de opinión." },
    ],
    steps: ["Escriba en una frase su opinión.", "Anote dos argumentos y un ejemplo para cada uno.", "Piense una objeción posible y cómo la respondería.", "Redacte la conclusión antes del desarrollo: le servirá de guía."],
    exercises: [
      { prompt: "¿Qué debe contener la introducción de un artículo de opinión?", options: ["Todos los ejemplos", "El tema y la postura"], answer: 1, explanation: "Los ejemplos van en el desarrollo." },
      { prompt: "¿Cuántas ideas principales conviene desarrollar por párrafo?", options: ["Una", "Todas las posibles"], answer: 0, explanation: "Una idea por párrafo facilita la lectura." },
    ],
  },
  {
    key: "cumplir-enunciado",
    title: "Cumplir todos los puntos del enunciado",
    skill: "general",
    activity: "writing",
    level: "A2–C1",
    minutes: 10,
    summary: "Convertir las pautas del enunciado en una lista de control antes de escribir o hablar.",
    explanation: [
      "El criterio «Cumplimiento de la tarea» pesa más que cualquier otro en la escritura (34 %).",
      "Antes de empezar, numere cada punto del enunciado; al terminar, compruebe que cada número aparece en su texto o grabación.",
      "Los puntos «menores» (saludo, despedida) también cuentan.",
    ],
    examples: [
      { wrong: "Respuesta que describe la casa y el barrio, pero no dice qué le gusta de su nueva vida ni se despide.", right: "Respuesta que trata los cinco puntos: saludo, casa y zona, gustos, experiencias en el extranjero y despedida.", note: "Cada punto, al menos dos o tres frases." },
    ],
    steps: ["Subraye los verbos del enunciado (describir, explicar, proponer…).", "Escriba una palabra clave por punto en sus notas.", "Al revisar, marque cada punto cumplido."],
    exercises: [
      { prompt: "Si el enunciado pide «explicar por qué no puede ir y proponer otra fecha», la respuesta…", options: ["puede omitir la propuesta si la disculpa es buena", "debe incluir la razón y una propuesta concreta"], answer: 1, explanation: "Ambos puntos son obligatorios." },
      { prompt: "¿Cuenta la despedida en el cumplimiento de la Tarea 1 escrita?", options: ["Sí", "No"], answer: 0, explanation: "Es un punto del enunciado." },
    ],
  },
  {
    key: "desarrollar-ideas",
    title: "Desarrollar las ideas",
    skill: "general",
    activity: "writing",
    level: "A2–C1",
    minutes: 10,
    summary: "Pasar de respuestas mínimas a respuestas con razón, detalle y ejemplo.",
    explanation: [
      "Fórmula R+D+E: Respuesta → Detalle o Razón → Ejemplo o experiencia personal.",
      "Un texto largo no es lo mismo que un texto desarrollado: cada frase debe aportar información nueva.",
    ],
    examples: [
      { wrong: "—¿Te gusta tu ciudad? —Sí, me gusta.", right: "—Sí, me encanta, sobre todo porque tiene mucha vida cultural: los fines de semana suelo ir a conciertos gratuitos en el parque.", note: "Respuesta + razón + ejemplo." },
    ],
    speakingPrompt: "Responda en 30 segundos: ¿Qué hace normalmente los fines de semana? Use la fórmula Respuesta + Razón + Ejemplo.",
    exercises: [
      { prompt: "¿Qué respuesta está más desarrollada?", options: ["Prefiero el campo.", "Prefiero el campo porque es más tranquilo; por ejemplo, allí duermo mucho mejor."], answer: 1, explanation: "Incluye razón y ejemplo." },
      { prompt: "¿Qué añade más información?", options: ["Repetir la idea con otras palabras", "Dar un ejemplo concreto"], answer: 1, explanation: "El ejemplo aporta información nueva." },
    ],
  },
  {
    key: "generos",
    title: "Géneros: mensaje, artículo de opinión y carta al director",
    skill: "writing",
    activity: "writing",
    level: "B1–C1",
    minutes: 15,
    summary: "Rasgos de los textos que se piden en la prueba escrita.",
    explanation: [
      "Mensaje o correo personal: saludo, tono cercano, preguntas a la otra persona, despedida.",
      "Artículo de opinión: título opcional, introducción del tema, tesis, argumentos, conclusión; sin saludo ni despedida.",
      "Carta al director: encabezamiento formal, referencia a la noticia, opinión argumentada, cierre formal y firma.",
    ],
    examples: [
      { right: "Señor director: He leído con interés el artículo publicado el pasado lunes sobre… En mi opinión… Atentamente, Ana López.", note: "Estructura de carta al director." },
    ],
    exercises: [
      { prompt: "¿Qué texto NO lleva saludo inicial?", options: ["Artículo de opinión", "Correo a un amigo"], answer: 0, explanation: "El artículo empieza presentando el tema." },
      { prompt: "Inicio adecuado para una carta al director:", options: ["¡Hola a todos!", "Señor director:"], answer: 1, explanation: "Fórmula formal." },
    ],
  },
  {
    key: "argumentar-oral",
    title: "Argumentar oralmente en seis pasos",
    skill: "speaking",
    activity: "speaking",
    level: "B2–C1",
    minutes: 15,
    summary: "Opinión, dos razones, ejemplo, objeción, respuesta y conclusión.",
    explanation: [
      "En la Tarea 5 oral dispone de dos minutos para preparar y de hasta cuatro para hablar: la estructura le evita quedarse sin ideas.",
      "Use marcadores para que la profesora siga su razonamiento: «en primer lugar», «además», «es cierto que…, pero…», «en definitiva».",
    ],
    examples: [
      { right: "«Estoy de acuerdo en que hay que limitar el uso del coche en el centro. En primer lugar, … Además, … Por ejemplo, en mi ciudad … Es cierto que algunos comerciantes temen perder clientes, pero … En definitiva, …»", note: "Los seis pasos en una intervención." },
    ],
    steps: [
      "Presentar la opinión: «En mi opinión…», «Estoy (totalmente / en parte) de acuerdo…».",
      "Dar la primera razón: «En primer lugar…».",
      "Dar la segunda razón: «Además…», «Por otra parte…».",
      "Ilustrar con un ejemplo: «Por ejemplo…», «Un caso que conozco bien es…».",
      "Expresar una objeción: «Es cierto que…», «Hay quien piensa que…».",
      "Responder a la objeción y concluir: «Sin embargo…», «En definitiva…».",
    ],
    speakingPrompt: "Prepare 2 minutos y argumente durante 3: «Las ciudades deberían prohibir los coches en el centro histórico».",
    exercises: [
      { prompt: "¿Qué expresión introduce una objeción?", options: ["Es cierto que…", "En definitiva…"], answer: 0, explanation: "«Es cierto que…, pero…» concede y responde." },
      { prompt: "¿Qué falta en esta intervención? «Estoy de acuerdo porque es bueno para el medio ambiente. Gracias.»", options: ["Un ejemplo, una segunda razón y una conclusión", "Nada, es completa"], answer: 0, explanation: "Está muy poco desarrollada." },
    ],
  },
  {
    key: "fluidez",
    title: "Fluidez: ganar tiempo sin bloquearse",
    skill: "speaking",
    activity: "speaking",
    level: "A2–B2",
    minutes: 10,
    summary: "Recursos para pensar mientras habla y reformular cuando falta una palabra.",
    explanation: [
      "Muletillas naturales para ganar tiempo: «a ver…», «pues…», «bueno, la verdad es que…», «¿cómo te diría?».",
      "Si no recuerda una palabra, descríbala: «es una cosa que sirve para…», «una persona que trabaja en…».",
      "Las pausas largas en silencio afectan más a la fluidez que un pequeño error.",
    ],
    examples: [{ right: "«Pues… a ver, en la foto hay una cosa que sirve para cortar el pan, creo que es un cuchillo grande.»", note: "Gana tiempo y reformula." }],
    speakingPrompt: "Hable 60 segundos sin parar sobre su barrio. Si le falta una palabra, descríbala.",
    exercises: [
      { prompt: "No recuerda la palabra «grifo». ¿Qué dice?", options: ["(silencio)", "la cosa de la cocina por donde sale el agua"], answer: 1, explanation: "Reformular mantiene la comunicación." },
      { prompt: "¿Qué recurso sirve para ganar tiempo?", options: ["«Bueno, la verdad es que…»", "Repetir la pregunta en otra lengua"], answer: 0, explanation: "Muletilla natural en español." },
    ],
  },
  {
    key: "inteligibilidad",
    title: "Inteligibilidad: sonidos y entonación",
    skill: "speaking",
    activity: "speaking",
    level: "A1–B2",
    minutes: 10,
    summary: "Sonidos que distinguen significados y entonación clara. No se trata de imitar un acento.",
    explanation: [
      "Se valora que se entienda, no un acento concreto: todas las variedades del español son válidas.",
      "Diferencie r simple y rr (pero / perro, caro / carro) y las vocales átonas (papa / papá).",
      "La sílaba tónica cambia el significado: «práctico / practico / practicó».",
    ],
    examples: [{ right: "«Ayer practiqué en el parque» — marque bien la sílaba tónica de cada palabra.", note: "Ritmo y acento." }],
    speakingPrompt: "Lea en voz alta y grábese: «El perro de Rosa corre por la carretera mientras yo practico el piano».",
    exercises: [
      { prompt: "¿Cuál significa «animal doméstico»?", options: ["pero", "perro"], answer: 1, explanation: "rr fuerte." },
      { prompt: "¿Qué forma es pasado?", options: ["practico", "practicó"], answer: 1, explanation: "Aguda con tilde: tercera persona del indefinido." },
    ],
  },
  {
    key: "describir-imagen",
    title: "Describir una imagen paso a paso",
    skill: "speaking",
    activity: "speaking",
    level: "A2–B1",
    minutes: 10,
    summary: "Personas, relación, ropa, acciones, sentimientos, lugar y objetos.",
    explanation: [
      "Siga el orden de las pautas del enunciado: así no olvidará ninguna.",
      "Use «estar + gerundio» para las acciones y expresiones de lugar: a la izquierda, al fondo, en primer plano, encima de, al lado de.",
      "Cuando no sea seguro, haga hipótesis: «parece que…», «seguramente son…», «quizás estén celebrando…».",
    ],
    examples: [{ right: "«En primer plano hay dos personas mayores; parecen un matrimonio. Él lleva una camisa de cuadros y está cortando una tarta…»", note: "Ubicación, relación, ropa y acción." }],
    speakingPrompt: "Describa durante un minuto y medio una foto de su teléfono siguiendo las cinco pautas.",
    exercises: [
      { prompt: "Para expresar una acción en curso en la foto:", options: ["Los niños juegan siempre.", "Los niños están jugando."], answer: 1, explanation: "Estar + gerundio." },
      { prompt: "Para hacer una hipótesis:", options: ["Parece que están celebrando algo.", "Celebran algo, seguro."], answer: 0, explanation: "Expresión de probabilidad." },
    ],
  },
  {
    key: "lectura-global",
    title: "Lectura: idea general e información específica",
    skill: "reading",
    activity: "receptive",
    level: "A1–B1",
    minutes: 15,
    summary: "Estrategias para las Tareas 1–3: leer primero las preguntas y localizar la información.",
    explanation: [
      "Lea las preguntas antes que el texto: le dicen qué buscar.",
      "Las preguntas siguen el orden del texto.",
      "Los distractores suelen repetir palabras del texto con otro sentido: compare significados, no palabras.",
    ],
    examples: [{ right: "Texto: «La piscina abre de lunes a sábado; el domingo, solo por la mañana». Pregunta: ¿Se puede nadar el domingo por la tarde? → No.", note: "Atención a las restricciones." }],
    exercises: [
      { prompt: "Aviso: «El museo es gratuito los miércoles para estudiantes con carné». ¿Quién no paga el miércoles?", options: ["Todos los visitantes", "Los estudiantes que lo acrediten"], answer: 1, explanation: "Condición: con carné." },
      { prompt: "Mensaje: «Te espero en la puerta del cine, no dentro, que no tengo entrada». ¿Dónde quedan?", options: ["Dentro del cine", "En la puerta del cine"], answer: 1, explanation: "Información explícita con distractor." },
      { prompt: "¿Qué conviene leer primero en la Tarea 1?", options: ["Las preguntas", "Solo los textos"], answer: 0, explanation: "Guía la lectura." },
    ],
  },
  {
    key: "inferencia",
    title: "Lectura y escucha: inferir intenciones y opiniones",
    skill: "general",
    activity: "receptive",
    level: "B2–C1",
    minutes: 15,
    summary: "Deducir lo que el autor da a entender sin decirlo directamente.",
    explanation: [
      "Fíjese en adjetivos valorativos, ironía y matizadores («apenas», «ni siquiera», «al fin y al cabo»).",
      "La respuesta correcta suele reformular la idea; desconfíe de la opción que copia literalmente una frase.",
    ],
    examples: [{ right: "«Tres meses después, el nuevo puente sigue sin abrirse. Eso sí, la inauguración fue espectacular.» → El autor critica la gestión del proyecto.", note: "Ironía." }],
    exercises: [
      { prompt: "«Ni siquiera llamó para avisar.» El hablante está…", options: ["molesto", "agradecido"], answer: 0, explanation: "«Ni siquiera» expresa reproche." },
      { prompt: "«Apenas quedaban entradas.» Significa que…", options: ["quedaban muy pocas", "no quedaba ninguna"], answer: 0, explanation: "«Apenas» = casi no." },
      { prompt: "«El proyecto, al fin y al cabo, beneficia a todos.» El autor…", options: ["concluye que es positivo", "lo rechaza"], answer: 0, explanation: "Conclusión favorable." },
    ],
  },
  {
    key: "cloze-gramatical",
    title: "Textos con huecos (Tareas 4 y 5 de lectura)",
    skill: "reading",
    activity: "receptive",
    level: "B2–C1",
    minutes: 15,
    summary: "Analizar la gramática y la lógica alrededor del hueco antes de ver las opciones.",
    explanation: [
      "Lea la frase completa, no solo las palabras cercanas al hueco.",
      "Pregúntese qué categoría falta (verbo, preposición, conector) y qué relación lógica hay.",
      "En los fragmentos, compruebe la coherencia con la frase anterior y la posterior (pronombres, conectores, tiempos verbales).",
    ],
    examples: [{ right: "«___ las críticas, el proyecto siguió adelante.» → «A pesar de» (concesión + sustantivo).", note: "Categoría y relación lógica." }],
    exercises: [
      { prompt: "«No vino ___ estaba enfermo.»", options: ["porque", "aunque"], answer: 0, explanation: "Causa." },
      { prompt: "«___ que llueva, saldremos.»", options: ["Aunque", "Aun"], answer: 0, explanation: "«Aunque» + subjuntivo." },
      { prompt: "«La medida, ___ objetivo es reducir el ruido, entra en vigor hoy.»", options: ["cuyo", "que"], answer: 0, explanation: "Relativo posesivo." },
    ],
  },
  {
    key: "escucha-estrategias",
    title: "Comprensión auditiva: aprovechar las dos escuchas",
    skill: "listening",
    activity: "receptive",
    level: "A1–C1",
    minutes: 10,
    summary: "Qué hacer en el tiempo de lectura previa, en la primera escucha y en la segunda.",
    explanation: [
      "Lectura previa: subraye la palabra clave de cada pregunta y anticipe el tipo de dato (hora, lugar, opinión).",
      "Primera escucha: responda lo que tenga claro; no se detenga en una pregunta difícil.",
      "Segunda escucha: confirme y complete las dudas.",
      "En la prueba no se puede volver a tareas anteriores: responda todo antes de avanzar (los errores no restan).",
    ],
    examples: [{ right: "Pregunta: «La reunión se ha cambiado a…» → espere un día u hora y atención a correcciones («no, perdón, el jueves»).", note: "Anticipar el dato y las rectificaciones." }],
    exercises: [
      { prompt: "Si no está seguro de una respuesta al final de la tarea…", options: ["la deja en blanco", "elige la opción más probable"], answer: 1, explanation: "Los errores no restan puntos." },
      { prompt: "En la primera escucha conviene…", options: ["responder lo que esté claro", "esperar a la segunda para todo"], answer: 0, explanation: "Aproveche ambas escuchas." },
    ],
  },
  {
    key: "escucha-conferencias",
    title: "Escuchar entrevistas y conferencias",
    skill: "listening",
    activity: "receptive",
    level: "B2–C1",
    minutes: 15,
    summary: "Seguir la estructura de un discurso largo gracias a sus marcadores.",
    explanation: [
      "Los conferenciantes anuncian la estructura: «voy a hablar de tres aspectos», «en primer lugar», «para terminar».",
      "Las ideas principales suelen ir tras «lo fundamental es…», «la clave está en…».",
      "En la Tarea 6 solo seis de doce enunciados son verdaderos: descarte los que contradicen o exageran lo dicho.",
    ],
    examples: [{ right: "«No digo que la tecnología sea mala; lo que defiendo es un uso consciente.» → Idea: defiende un uso responsable, no la rechaza.", note: "Matización." }],
    exercises: [
      { prompt: "«Lo que realmente importa no es cuánto se estudia, sino cómo.» La idea principal es…", options: ["la calidad del estudio", "estudiar más horas"], answer: 0, explanation: "«No… sino…»." },
      { prompt: "Un enunciado que dice «siempre» cuando el hablante dijo «a menudo»…", options: ["es falso", "es verdadero"], answer: 0, explanation: "Exagera lo dicho." },
    ],
  },
  {
    key: "gestion-tiempo",
    title: "Gestión del tiempo en el simulacro",
    skill: "general",
    activity: "receptive",
    level: "Todos",
    minutes: 5,
    summary: "Distribución orientativa del tiempo y hábitos para no dejar tareas sin hacer.",
    explanation: [
      "Lectura (60 min): orientación de la guía de preparadores de 2016 — T1 10 min, T2 10, T3 12, T4 14, T5 14.",
      "Escritura (50 min): reserve unos 20 minutos para la Tarea 1 y 30 para la Tarea 2, incluida la revisión.",
      "Practique con el temporizador visible y revise el número de respuestas en blanco antes de avanzar.",
    ],
    examples: [{ right: "Si una pregunta le bloquea más de un minuto, marque la opción más probable y continúe.", note: "Los errores no restan." }],
    exercises: [
      { prompt: "En la prueba de lectura, ¿qué tareas necesitan más tiempo?", options: ["Las primeras", "Las últimas (B2–C1)"], answer: 1, explanation: "La dificultad aumenta progresivamente." },
    ],
  },
];

const byKey = new Map(MODULES.map((m) => [m.key, m]));
export function getModule(key: string): RefuerzoModule | undefined {
  return byKey.get(key);
}
