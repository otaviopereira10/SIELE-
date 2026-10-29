import type { ReactNode } from "react";

/**
 * Manual de evaluación y preparación del SIELE (contenido original de SIELE Trainer Pro).
 * Los datos de formato proceden de fuentes públicas citadas en el capítulo F y en
 * «Fuentes, versión y metodología». Las rúbricas se leen de la base de datos (capítulo C).
 */

export const MANUAL_UPDATED = "29/10/2026";

export interface Chapter {
  id: string;
  letter: string;
  title: string;
  body: ReactNode;
}

const H = ({ children }: { children: ReactNode }) => <h3 className="mt-6 mb-2 text-lg font-semibold">{children}</h3>;
const P = ({ children }: { children: ReactNode }) => <p className="mb-3 leading-relaxed">{children}</p>;
const Box = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="my-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
    <p className="mb-1 font-semibold">{title}</p>
    <div className="text-ink-2">{children}</div>
  </div>
);
const Pair = ({ a, b, why, example }: { a: string; b: string; why: string; example: ReactNode }) => (
  <div className="my-3 rounded-lg border border-line p-4">
    <p className="font-semibold">
      {a} <span className="text-ink-3">frente a</span> {b}
    </p>
    <p className="mt-1 text-ink-2">{why}</p>
    <div className="mt-2 rounded-md bg-surface-2 px-3 py-2 text-sm">{example}</div>
  </div>
);

export const CHAPTERS: Chapter[] = [
  {
    id: "a",
    letter: "A",
    title: "Cómo funciona el examen",
    body: (
      <>
        <P>
          El SIELE Global consta de cuatro pruebas que se realizan en ordenador. Cada prueba se califica de 0 a 250 puntos y la suma da una puntuación global
          de 0 a 1000. No se aprueba ni se suspende: el resultado sitúa al candidato en una franja relacionada con los niveles A1–C1 del MCER. Según la página
          oficial consultada, el certificado tiene una validez de cinco años y hay un descanso de 15 minutos entre la comprensión auditiva y la expresión escrita.
        </P>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-2">Prueba</th>
                <th>Tareas</th>
                <th>Ítems</th>
                <th>Tiempo</th>
                <th>Corrección</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2">Comprensión de lectura</td>
                <td>5</td>
                <td>38</td>
                <td>60 min</td>
                <td>Automática</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2">Comprensión auditiva</td>
                <td>6</td>
                <td>38</td>
                <td>55 min</td>
                <td>Automática</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2">Expresión e interacción escritas</td>
                <td>2</td>
                <td>—</td>
                <td>50 min</td>
                <td>Calificador con rúbrica</td>
              </tr>
              <tr>
                <td className="py-2">Expresión e interacción orales</td>
                <td>5</td>
                <td>—</td>
                <td>15 min aprox.</td>
                <td>Calificador con rúbrica</td>
              </tr>
            </tbody>
          </table>
        </div>
        <H>Comprensión de lectura</H>
        <P>
          Las tareas aumentan de dificultad: T1 (A1) cinco textos breves con una pregunta cada uno; T2 (A2) un texto con cinco preguntas; T3 (B1) tres textos
          y ocho enunciados que hay que relacionar con la persona o el texto adecuado; T4 (B2) dos textos con cuatro huecos cada uno y cinco fragmentos por
          texto (sobra uno); T5 (B2–C1) un texto con doce huecos y tres opciones por hueco, centrados en gramática, léxico y conectores. Los errores no restan.
        </P>
        <H>Comprensión auditiva</H>
        <P>
          Seis tareas de A1 a C1. Antes de cada audio hay un tiempo de lectura de las preguntas (30 a 50 segundos según la tarea); el audio se escucha dos
          veces, con una pausa breve entre escuchas y 30 segundos finales para revisar. No es posible volver a una tarea anterior. En la plataforma, el modo
          formal reproduce esta pauta automáticamente y el servidor limita el número de escuchas; en práctica el estudiante decide cuándo escuchar.
        </P>
        <H>Expresión e interacción escritas</H>
        <P>
          T1 (A1–B1): responder a un mensaje personal tratando cinco puntos, 100–150 palabras recomendadas. T2 (B2–C1): elegir entre un artículo de opinión y
          una carta al director a partir de un breve texto periodístico, 250–300 palabras. Se puede pasar de una tarea a otra durante los 50 minutos. La
          cantidad de palabras no se puntúa por sí misma, pero un texto muy corto difícilmente cumple la tarea.
        </P>
        <H>Expresión e interacción orales</H>
        <P>
          T1: cuatro preguntas personales escuchadas (15 s de respuesta en las dos primeras y 30 s en las dos últimas). T2: elegir y describir una fotografía
          (preparación con notas). T3: dos situaciones simuladas de la vida cotidiana. T4: elegir un tema, leer un texto breve y responder a tres preguntas
          (opinión, información e hipótesis). T5: argumentar a favor o en contra de una afirmación relacionada con el tema de T4, tras dos minutos de
          preparación. La grabación empieza automáticamente al terminar el tiempo de espera y el candidato no puede escucharse.
        </P>
        <H>Práctica y simulacro formal en la plataforma</H>
        <ul className="mb-3 list-disc space-y-1 pl-5">
          <li>
            <strong>Práctica:</strong> la profesora puede activar la corrección inmediata (el estudiante comprueba cada tarea de comprensión y ve las
            explicaciones), permitir varios intentos y la repetición de grabaciones.
          </li>
          <li>
            <strong>Formal:</strong> instrucciones previas, comprobación de sonido y micrófono, tiempos controlados por el servidor, audio pautado, una sola
            grabación por pregunta, aviso de respuestas en blanco y bloqueo tras el envío. Se registran los eventos relevantes (cambios de pestaña,
            reconexiones, reproducciones).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "b",
    letter: "B",
    title: "Qué evalúa cada prueba",
    body: (
      <>
        <H>Comprensión (lectura y audición)</H>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Información global:</strong> captar el tema, el propósito o la idea principal sin necesidad de entender cada palabra. <em>Ej.: «Este
            mensaje sirve para cancelar una cita».</em>
          </li>
          <li>
            <strong>Información específica:</strong> localizar un dato concreto (una hora, un lugar, una condición) entre otros parecidos.
          </li>
          <li>
            <strong>Detalles:</strong> comprender matices de una afirmación (por ejemplo, «solo los martes» frente a «sobre todo los martes»).
          </li>
          <li>
            <strong>Inferencia:</strong> deducir lo que no se dice explícitamente a partir de pistas del texto (ironía, valoraciones, consecuencias).
          </li>
          <li>
            <strong>Intención comunicativa:</strong> reconocer para qué se dice algo: quejarse, convencer, advertir, matizar o conceder.
          </li>
        </ul>
        <P>
          En la plataforma cada ítem puede etiquetarse con su foco (global, específica, detalle, inferencia, intención, gramática, léxico, conector) y su nivel,
          de modo que el informe muestra en qué tipo de comprensión falla el estudiante, no solo cuántos errores comete.
        </P>
        <H>Producción (escrita y oral)</H>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <li>
            <strong>Realización o cumplimiento de la tarea:</strong> responder a todos los puntos, con desarrollo y adecuación al destinatario, al registro y
            al género. Es el criterio de mayor peso en la escritura (34 % según la guía de 2016).
          </li>
          <li>
            <strong>Cohesión:</strong> organización, progresión de las ideas, conectores, referencias y puntuación (en oral, organización del discurso).
          </li>
          <li>
            <strong>Corrección:</strong> control gramatical, léxico y ortográfico, distinguiendo errores sistemáticos de despistes y valorando su efecto en la
            comprensión.
          </li>
          <li>
            <strong>Alcance y precisión léxica:</strong> variedad y exactitud del vocabulario y de las estructuras para el tema y el nivel que pide la tarea.
          </li>
          <li>
            <strong>Fluidez (oral):</strong> continuidad del discurso, pausas, ritmo, autocorrección y recursos para no bloquearse.
          </li>
          <li>
            <strong>Inteligibilidad (oral):</strong> que se entienda sin esfuerzo. No se valora un acento concreto: todas las variedades del español son válidas.
          </li>
          <li>
            <strong>Desarrollo del discurso:</strong> ampliar con razones, ejemplos y matices, no solo hablar o escribir más.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "c",
    letter: "C",
    title: "Cómo utilizar las rúbricas",
    body: (
      <>
        <P>
          Cada criterio se valora en bandas de 0 a 5. En la plataforma, la descripción de cada banda es un resumen educativo original; consulte la guía
          oficial para los descriptores completos. Elija la banda cuyo descriptor encaje mejor con el conjunto de la evidencia, no con un único rasgo aislado,
          y justifíquela con citas concretas del texto o momentos de la grabación.
        </P>
        <P>Las rúbricas activas, con sus ponderaciones y descriptores, aparecen al final de este capítulo tal como están configuradas en el sistema.</P>
        <H>Distinciones que conviene tener claras</H>
        <Pair
          a="Respuesta incompleta"
          b="respuesta lingüísticamente incorrecta"
          why="La primera afecta sobre todo al cumplimiento de la tarea; la segunda, a la corrección. Un texto impecable que olvida dos puntos no puede tener una banda alta en cumplimiento."
          example={<>Texto correcto que no se despide ni da consejos → cumplimiento 2–3, corrección 4. Texto con muchos errores que trata todos los puntos → cumplimiento 4, corrección 2.</>}
        />
        <Pair
          a="Error puntual"
          b="patrón sistemático"
          why="Un despiste no rebaja la banda de corrección como un error que se repite en estructuras básicas. Marque «sistemático» solo si aparece varias veces."
          example={<>«ayer fui… y era muy bonito… después fuimos…» con una sola confusión → puntual. Todos los hechos terminados en imperfecto → sistemático.</>}
        />
        <Pair
          a="Vocabulario sencillo adecuado"
          b="repertorio insuficiente"
          why="Para una tarea A2 un léxico sencillo es apropiado; se considera insuficiente cuando impide expresar lo que pide la tarea o produce repeticiones y rodeos constantes."
          example={<>«Mi casa es pequeña pero tiene mucha luz» es adecuado en T1. En T2, «hay cosas buenas y cosas malas» repetido no permite argumentar.</>}
        />
        <Pair
          a="Respuesta memorizada"
          b="discurso adaptado a la tarea"
          why="Las fórmulas aprendidas son útiles, pero un bloque memorizado que no responde a la pregunta concreta no demuestra dominio. Valore la adaptación."
          example={<>Ante «¿Qué hace los fines de semana?», recitar una presentación personal completa no responde a la pregunta.</>}
        />
        <Pair
          a="Intervención larga"
          b="intervención desarrollada"
          why="La duración no es un criterio. Un discurso desarrollado añade razones, ejemplos y matices; uno largo puede repetir la misma idea."
          example={<>Dos minutos repitiendo «es importante el medio ambiente» frente a un minuto con opinión, dos razones y un ejemplo.</>}
        />
        <Pair
          a="Opinión presentada"
          b="opinión justificada"
          why="Decir «estoy de acuerdo» no es argumentar. La justificación exige razones, ejemplos y, en niveles altos, considerar objeciones."
          example={<>«Estoy en contra.» frente a «Estoy en contra porque…; por ejemplo…; es cierto que…, pero…».</>}
        />
        <Pair
          a="Texto gramaticalmente correcto"
          b="texto coherente y adecuado"
          why="Frases correctas sin conexión ni adecuación al destinatario no cumplen la tarea. Valore cohesión y registro por separado de la corrección."
          example={<>Una carta al director con «¡Hola, chicos!» puede ser correcta y, sin embargo, inadecuada.</>}
        />
        <H>Cómo justificar una puntuación</H>
        <ol className="mb-3 list-decimal space-y-1 pl-5">
          <li>Cite la evidencia (selección del texto o marca de tiempo).</li>
          <li>Diga qué rasgo del descriptor aparece y cuál falta para la banda superior.</li>
          <li>Proponga la corrección y, si es útil, una versión mejorada de la frase.</li>
          <li>Indique qué debe practicar el estudiante: la plataforma enlazará el módulo de refuerzo correspondiente.</li>
        </ol>
      </>
    ),
  },
  {
    id: "d",
    letter: "D",
    title: "Proceso de evaluación",
    body: (
      <>
        <P>Siga siempre el mismo procedimiento; así las puntuaciones son comparables entre alumnos y entre intentos.</P>
        <ol className="mb-4 list-decimal space-y-2 pl-5">
          <li>Lea el enunciado y enumere todos sus requisitos (la pantalla de corrección los muestra numerados).</li>
          <li>Lea o escuche la respuesta completa sin asignar todavía ninguna banda.</li>
          <li>Identifique evidencias concretas: selecciónelas en el texto o pulse «Marcar momento» en la grabación.</li>
          <li>Seleccione una banda para cada criterio.</li>
          <li>Contraste la elección con el descriptor de la banda y con el de la banda superior.</li>
          <li>Revise las ponderaciones aplicadas (la plataforma calcula el porcentaje pedagógico y los puntos según la tabla configurada).</li>
          <li>Explique la calificación con comentarios específicos en cada criterio.</li>
          <li>Revise la coherencia entre tareas del mismo alumno y con otros alumnos de nivel parecido.</li>
          <li>Guarde el borrador (puede volver más tarde sin perder nada).</li>
          <li>Publique los resultados: el estudiante recibe el informe y el plan de mejora.</li>
        </ol>
        <Box title="Lista de comprobación antes de publicar">
          <ul className="list-disc space-y-1 pl-5">
            <li>Todos los criterios tienen banda y comentario.</li>
            <li>Hay al menos una fortaleza y los errores prioritarios están identificados.</li>
            <li>Cada error importante tiene una cita, una corrección y una explicación.</li>
            <li>Los errores sistemáticos están marcados como tales.</li>
            <li>Se indica qué practicar antes del próximo intento.</li>
            <li>Ninguna variedad legítima del español se ha marcado como error.</li>
            <li>Se han revisado las sugerencias de IA (si se usaron): ninguna se publica sin su revisión.</li>
          </ul>
        </Box>
      </>
    ),
  },
  {
    id: "e",
    letter: "E",
    title: "Referencia MCER",
    body: (
      <>
        <P>
          Resumen educativo de las capacidades generales asociadas a cada nivel. Comprensión y producción suelen avanzar a ritmos distintos: un estudiante
          puede leer en B2 y escribir en B1. Por eso la plataforma nunca asigna un nivel global a partir de una sola destreza.
        </P>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left align-bottom">
                <th className="py-2 pr-3">Nivel</th>
                <th className="pr-3">Comprensión</th>
                <th>Producción</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-b border-line">
                <td className="py-2 pr-3 font-semibold">A1</td>
                <td className="pr-3">Entiende palabras y frases muy básicas sobre sí mismo y su entorno, en textos muy breves o habla lenta.</td>
                <td>Da información personal con frases aisladas y memorizadas.</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3 font-semibold">A2</td>
                <td className="pr-3">Comprende textos breves y sencillos sobre temas cotidianos y encuentra información previsible.</td>
                <td>Describe y cuenta experiencias sencillas con frases enlazadas por conectores básicos.</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3 font-semibold">B1</td>
                <td className="pr-3">Entiende las ideas principales de textos claros sobre temas conocidos y sigue conversaciones cotidianas.</td>
                <td>Narra, describe y explica planes y opiniones con un discurso lineal comprensible.</td>
              </tr>
              <tr className="border-b border-line">
                <td className="py-2 pr-3 font-semibold">B2</td>
                <td className="pr-3">Comprende textos complejos, argumentaciones y entrevistas, incluido lo que se da a entender.</td>
                <td>Argumenta con claridad y detalle, matiza y defiende un punto de vista con ventajas e inconvenientes.</td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-semibold">C1</td>
                <td className="pr-3">Entiende textos largos y exigentes, conferencias y matices implícitos con facilidad.</td>
                <td>Se expresa con fluidez y precisión, organiza discursos complejos y adapta el registro con flexibilidad.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <H>Ejemplos originales para distinguir niveles (misma tarea: «Hable de su ciudad»)</H>
        <ul className="mb-3 space-y-2">
          <li className="rounded-md bg-surface-2 px-3 py-2">
            <strong>A2:</strong> «Mi ciudad es grande. Tiene un parque bonito. Me gusta porque hay muchas tiendas, pero hay mucho tráfico.»
          </li>
          <li className="rounded-md bg-surface-2 px-3 py-2">
            <strong>B1:</strong> «Vivo en una ciudad bastante grande. Lo que más me gusta es el parque del centro, donde voy a correr los domingos. Aunque
            hay mucho tráfico, el transporte público funciona bien.»
          </li>
          <li className="rounded-md bg-surface-2 px-3 py-2">
            <strong>B2:</strong> «Es una ciudad con mucha vida cultural, aunque en los últimos años el turismo ha encarecido tanto el centro que muchos vecinos
            se han ido a las afueras. Si el ayuntamiento no regula los alquileres, me temo que perderá su identidad.»
          </li>
          <li className="rounded-md bg-surface-2 px-3 py-2">
            <strong>C1:</strong> «Paradójicamente, aquello que la hace atractiva —su vida en la calle— es lo que más amenaza su equilibrio: cuanto más se promociona
            como destino, más se vacía de quienes le dan carácter. No se trata de frenar el turismo, sino de gestionarlo con criterios que prioricen a los
            residentes.»
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "f",
    letter: "F",
    title: "Límites de la evaluación",
    body: (
      <>
        <ul className="mb-3 list-disc space-y-2 pl-5">
          <li>Un simulacro de práctica no es una certificación oficial. Los resultados de la plataforma son estimaciones pedagógicas de preparación.</li>
          <li>
            La calidad de los ítems influye en el resultado: un ítem ambiguo o mal calibrado distorsiona la estimación. Revise los ítems con más errores de lo
            esperado y archive o corrija la versión si es necesario.
          </li>
          <li>
            Una conversión válida de aciertos o bandas a puntos necesita tablas verificadas y un procedimiento documentado. La plataforma solo aplica las tablas
            públicas de la Guía de preparadores (2016), marcadas como «edición antigua»; para la comprensión solo muestra el intervalo de puntos de la franja,
            y nunca convierte un porcentaje directamente a la escala 0–250.
          </li>
          <li>
            Si la evaluadora no es calificadora acreditada por SIELE, el resultado se identifica como evaluación pedagógica de preparación, no como calificación
            oficial.
          </li>
          <li>La puntuación global solo se muestra cuando las cuatro pruebas tienen una conversión aplicable; si no, se presenta un perfil por destreza.</li>
          <li>Ninguna práctica garantiza un resultado concreto en el examen oficial.</li>
        </ul>
        <P>Actualizado el {MANUAL_UPDATED}. Las fuentes consultadas y el estado de verificación de cada regla figuran a continuación.</P>
      </>
    ),
  },
];
