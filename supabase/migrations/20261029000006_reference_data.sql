-- Datos de referencia: fuentes consultadas, reglas con su respaldo documental, rúbricas y tablas.
-- Las tablas de puntuación proceden de la Guía oficial para preparadores (edición 28/10/2016).
-- Se marcan como 'verified_older_edition': su vigencia actual debe confirmarse antes de presentarlas como actuales.

insert into public.sources (code, title, url, edition, consulted_at, notes) values
  ('SIELE_EXAMEN_WEB', 'SIELE — Tipos de examen (página oficial)', 'https://siele.org/examen', 'Página web vigente',
   '2026-10-29', 'Confirma tareas, ítems y tiempos máximos de las cuatro pruebas, escala 0–250 por prueba (0–1000 global), validez de cinco años y 15 minutos de descanso entre Comprensión auditiva y Expresión e interacción escritas.'),
  ('SIELE_GUIA_PREP_2016', 'Guía oficial para preparadores SIELE', 'https://info.siele.org/GuiaOficialPreparadores/SIELE_GuiaOficialPreparadores_20161028.pdf', 'Edición 28/10/2016',
   '2026-10-29', 'Especificaciones por tarea, funcionamiento técnico, escalas de calificación (bandas 0–5), ponderaciones, tablas de puntos por banda y puntos de corte. Documento antiguo: puede no coincidir en todo con la versión vigente del examen.'),
  ('SIELE_DEMO', 'Examen de demostración SIELE', 'https://examendemo.siele.org/?language=es', 'Capturas de pantalla facilitadas por la usuaria (30/09/2026)',
   '2026-09-30', 'Referencia de experiencia de usuario y de tiempos mostrados en pantalla (p. ej., 30 s para elegir opción oral, 1–2 min de grabación en la Tarea 2 oral, 250–300 palabras en la Tarea 2 escrita).'),
  ('CERVANTES_SIELE_COMO', 'Instituto Cervantes — Cómo es el SIELE', 'https://examenes.cervantes.es/es/siele/como', 'No disponible',
   '2026-10-29', 'La dirección responde con una redirección permanente (301) a la página del DELE. No se obtuvo información del SIELE desde esta URL.'),
  ('MCER', 'Marco común europeo de referencia para las lenguas (Consejo de Europa)', 'https://www.coe.int/es/web/common-european-framework-reference-languages', '2001 y Volumen complementario 2020',
   '2026-10-29', 'Referencia general para las descripciones educativas de niveles del manual docente. Los resúmenes de la plataforma son originales.');

insert into public.rule_sources (rule_key, area, description, value, source_id, verification, verified_at, notes)
select v.rule_key, v.area, v.description, v.value, s.id, v.verification::public.verification_status, v.verified_at::date, v.notes
from (values
  ('structure.reading', 'Estructura', 'Comprensión de lectura', '5 tareas · 38 ítems · 60 minutos', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', ''),
  ('structure.listening', 'Estructura', 'Comprensión auditiva', '6 tareas · 38 ítems · 55 minutos', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', ''),
  ('structure.writing', 'Estructura', 'Expresión e interacción escritas', '2 tareas · 50 minutos', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', ''),
  ('structure.speaking', 'Estructura', 'Expresión e interacción orales', '5 tareas · 15 minutos (máx.)', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', 'La guía de 2016 indicaba 15–20 minutos según la extensión de las intervenciones.'),
  ('structure.break', 'Estructura', 'Descanso entre pruebas', '15 minutos entre Comprensión auditiva y Expresión e interacción escritas', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', 'Configurable en cada versión (pause_after_seconds).'),
  ('scale.per_test', 'Puntuación', 'Escala oficial', '0–250 puntos por prueba; 0–1000 global', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', 'La plataforma no emite puntuaciones oficiales; solo estimaciones de preparación.'),
  ('reading.tasks', 'Comprensión de lectura', 'Ítems y nivel por tarea', 'T1: 5 (A1) · T2: 5 (A2) · T3: 8 (B1) · T4: 8 (B2) · T5: 12 (2 B2 + 10 C1)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'Coherente con las capturas del simulador (T4: dos textos con cuatro huecos; T5: doce huecos).'),
  ('reading.navigation', 'Comprensión de lectura', 'Volver a tareas anteriores', 'No permitido (solo entre textos de T1 y T4)', 'SIELE_GUIA_PREP_2016', 'contradictory', null, 'Las capturas de 2026 muestran la lista de tareas con estilo de enlace; no se ha podido confirmar si permite volver. Por defecto se aplica la regla documentada (no volver). Ajustable por versión.'),
  ('reading.scoring', 'Comprensión de lectura', 'Corrección', '1 punto por ítem; los errores no restan', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('reading.cutoffs', 'Comprensión de lectura', 'Aciertos → nivel e intervalo de puntos', 'C1 33–38 (217–250) · B2 27–32 (178–216,99) · B1 18–26 (118–177,99) · A2 10–17 (66–117,99) · A1 5–9 (33–65,99)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'Solo se muestra el intervalo; no se inventa una conversión exacta a 0–250.'),
  ('listening.tasks', 'Comprensión auditiva', 'Ítems y nivel por tarea', 'T1: 5 (A1) · T2: 5 (A2) · T3: 8 (B1) · T4: 8 (B2) · T5: 6 (2 B2 + 4 C1) · T6: 6 (C1)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('listening.plays', 'Comprensión auditiva', 'Reproducciones del audio', 'Dos veces por audio', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'Configurable por tarea (max_audio_plays).'),
  ('listening.navigation', 'Comprensión auditiva', 'Volver a tareas anteriores', 'No permitido', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('listening.timing', 'Comprensión auditiva', 'Tiempos pautados', 'Lectura previa 30/30/30/45/45/50 s · 10 s entre escuchas · 30 s finales', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'En modo formal el reproductor sigue esta pauta; en práctica el estudiante controla las escuchas.'),
  ('listening.cutoffs', 'Comprensión auditiva', 'Aciertos → nivel e intervalo de puntos', 'C1 33–38 (211–250) · B2 27–32 (164–210,99) · B1 18–26 (112–163,99) · A2 10–17 (66–111,99) · A1 5–9 (33–65,99)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('writing.words', 'Expresión escrita', 'Extensión recomendada', 'T1: 100–150 palabras · T2: 250–300 palabras', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'La tabla resumen de la guía indica 200–250 para la T2, pero el texto de la guía y el simulador de 2026 indican 250–300.'),
  ('writing.navigation', 'Expresión escrita', 'Volver a la Tarea 1', 'Permitido dentro del tiempo de la prueba', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('writing.weights', 'Expresión escrita', 'Ponderación por tarea', 'Cohesión 22 % · Corrección 22 % · Alcance 22 % · Cumplimiento de la tarea 34 %', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('writing.band_points', 'Expresión escrita', 'Puntos por banda (sobre 250)', 'Tablas distintas para T1 y T2 (ver rúbrica EIE-GUIA2016)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('writing.cutoffs', 'Expresión escrita', 'Puntos de corte', 'C1 215 · B2 167 · B1 104 · A2 69 · A1 34', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('speaking.tasks', 'Expresión oral', 'Tareas', 'T1 preguntas personales (A1–A2) · T2 descripción de foto (A2) · T3 dos situaciones (B1) · T4 preguntas sobre un tema (B2) · T5 argumentación (C1)', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('speaking.t1_times', 'Expresión oral', 'T1: tiempo de grabación', 'Preguntas 1–2: 15 s · Preguntas 3–4: 30 s · cada pregunta se puede escuchar dos veces', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('speaking.t2_times', 'Expresión oral', 'T2: preparación y grabación', 'Elegir: 30 s · Preparación: 30 s de lectura + 2 min · Grabación: hasta 2 min', 'SIELE_DEMO', 'contradictory', null, 'La guía de 2016 indica un máximo de 1 min 30 s de grabación; el simulador actual indica «de uno a dos minutos».'),
  ('speaking.t3_times', 'Expresión oral', 'T3: elección y grabación', 'Elegir: 30 s por situación · 1 min antes de la grabación automática · Grabación: hasta 1 min 30 s', 'SIELE_DEMO', 'contradictory', null, 'La guía de 2016 indica hasta 1 minuto para elegir; el simulador muestra una cuenta atrás de 30 s.'),
  ('speaking.t4_times', 'Expresión oral', 'T4: lectura y respuestas', 'Elegir tema: 30 s · Lectura: 35 s · 3 preguntas · Respuesta: hasta 1 min cada una', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', 'El tema elegido se mantiene en la Tarea 5.'),
  ('speaking.t5_times', 'Expresión oral', 'T5: preparación y argumentación', 'Elegir: 30 s · Preparación: 2 min · Grabación: hasta 4 min', 'SIELE_DEMO', 'contradictory', null, 'La guía de 2016 indica 45 s para elegir; el simulador muestra 30 s.'),
  ('speaking.platform_limit', 'Expresión oral', 'Límite técnico de la prueba en la plataforma', '25 minutos como red de seguridad; el ritmo real lo marcan los tiempos de cada tarea', 'SIELE_EXAMEN_WEB', 'contradictory', null, 'La web oficial indica 15 minutos para la prueba oral y la guía de 2016, 15–20 minutos. La suma de los tiempos máximos de elección, preparación y grabación configurados ronda los 25 minutos; por eso el límite global es más amplio y se informa al estudiante.'),
  ('speaking.weights', 'Expresión oral', 'Ponderación', 'Uso de la lengua 66 % · Cumplimiento de la tarea 34 % · todas las tareas valen lo mismo', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('speaking.cutoffs', 'Expresión oral', 'Puntos de corte', 'C1 215 · B2 176 · B1 125 · A2 76 · A1 40', 'SIELE_GUIA_PREP_2016', 'verified_older_edition', '2026-10-29', ''),
  ('certificate.validity', 'Certificado', 'Validez', 'Cinco años', 'SIELE_EXAMEN_WEB', 'verified', '2026-10-29', 'La guía de 2016 indicaba dos años: dato actualizado.'),
  ('platform.non_official', 'Plataforma', 'Naturaleza de los resultados', 'Estimaciones pedagógicas de preparación; nunca calificación oficial SIELE', null, 'verified', '2026-10-29', 'Regla propia del producto.')
) as v(rule_key, area, description, value, source_code, verification, verified_at, notes)
left join public.sources s on s.code = v.source_code;

-- ---------------------------------------------------------------------------
-- Rúbrica escrita (descriptores: resúmenes originales; consulte la guía para los oficiales)
-- ---------------------------------------------------------------------------
insert into public.rubric_versions (code, version_no, skill, title, criteria, points_table, source_id, verification, status)
select 'EIE-GUIA2016', 1, 'writing', 'Expresión e interacción escritas — rúbrica pedagógica',
$json$[
  {"key": "cohesion", "label": "Cohesión", "weight": 22,
   "description": "Organización del texto, progresión de las ideas, conectores y mecanismos de referencia, puntuación y facilidad para seguir el discurso.",
   "focus": ["Organización en párrafos y progresión lógica", "Variedad y precisión de conectores", "Referencias (pronombres, sinónimos, elipsis)", "Puntuación al servicio del sentido"],
   "bands": [
     {"band": 0, "summary": "No hay texto suficiente para valorar la cohesión."},
     {"band": 1, "summary": "Enumera frases sueltas unidas con «y», «pero» o «porque»; cuesta seguir el texto. (Uso de la lengua de nivel A1)"},
     {"band": 2, "summary": "Enlaza ideas con conectores básicos; organización lineal y limitada. (A2)"},
     {"band": 3, "summary": "Texto lineal y comprensible; usa conectores frecuentes y algunas subordinadas; la puntuación ayuda casi siempre. (B1)"},
     {"band": 4, "summary": "Texto claro y estructurado; conectores variados y referencias eficaces, aunque con algún salto. (B2)"},
     {"band": 5, "summary": "Texto fluido y bien articulado; recursos de cohesión variados y precisos. (C1)"}
   ]},
  {"key": "correccion", "label": "Corrección", "weight": 22,
   "description": "Control gramatical, morfosintáctico, ortográfico y léxico; distinción entre errores aislados y sistemáticos y su efecto en la comprensión.",
   "focus": ["Errores sistemáticos frente a puntuales", "Tiempos verbales y modos", "Concordancias", "Ortografía y acentuación", "Efecto de los errores en la comprensión"],
   "bands": [
     {"band": 0, "summary": "No hay texto suficiente para valorar la corrección."},
     {"band": 1, "summary": "Control muy limitado de estructuras memorizadas; los errores dificultan a menudo la comprensión. (A1)"},
     {"band": 2, "summary": "Usa estructuras sencillas con corrección, pero comete errores básicos sistemáticos; el mensaje suele entenderse. (A2)"},
     {"band": 3, "summary": "Control razonable de estructuras frecuentes; errores que no impiden la comprensión. (B1)"},
     {"band": 4, "summary": "Buen control gramatical (pasados, subjuntivo frecuente…); errores ocasionales que no generan malentendidos. (B2)"},
     {"band": 5, "summary": "Alto grado de corrección; los errores son escasos y difíciles de detectar. (C1)"}
   ]},
  {"key": "alcance", "label": "Alcance", "weight": 22,
   "description": "Amplitud, precisión y variedad del vocabulario y de las estructuras para expresarse sobre el tema y con la complejidad que pide la tarea.",
   "focus": ["Variedad léxica y precisión", "Repertorio de estructuras", "Capacidad para tratar el tema planteado", "Repeticiones y circunloquios"],
   "bands": [
     {"band": 0, "summary": "No hay texto suficiente para valorar el alcance."},
     {"band": 1, "summary": "Repertorio muy básico de palabras y frases sobre datos personales. (A1)"},
     {"band": 2, "summary": "Repertorio suficiente para necesidades sencillas y situaciones frecuentes. (A2)"},
     {"band": 3, "summary": "Puede describir experiencias, hechos y planes con cierta variedad, aunque con repeticiones. (B1)"},
     {"band": 4, "summary": "Expresa puntos de vista y argumenta con vocabulario amplio y algo de variedad estructural. (B2)"},
     {"band": 5, "summary": "Repertorio amplio y preciso; matiza y reformula sin esfuerzo aparente. (C1)"}
   ]},
  {"key": "cumplimiento", "label": "Cumplimiento de la tarea", "weight": 34,
   "description": "Respuesta a todos los puntos del enunciado, pertinencia, desarrollo y adecuación al destinatario, al registro y al género.",
   "focus": ["Puntos del enunciado tratados", "Desarrollo con detalles y ejemplos", "Destinatario y registro", "Género discursivo (mensaje, artículo, carta)"],
   "bands": [
     {"band": 0, "summary": "No responde a ningún punto de forma adecuada o el texto no es comprensible."},
     {"band": 1, "summary": "Falta la mitad o más de los puntos relevantes; no se adecúa a la situación."},
     {"band": 2, "summary": "Tarea incompleta: falta algún punto importante o se trata con excesiva brevedad."},
     {"band": 3, "summary": "Resuelve la tarea de forma básica; algún punto se trata de manera limitada."},
     {"band": 4, "summary": "Resuelve la tarea: trata todos los puntos con detalle suficiente y se adecúa a la situación."},
     {"band": 5, "summary": "Resolución completa y muy eficaz, con detalles y ejemplos en todos los puntos y adecuación plena."}
   ]}
]$json$::jsonb,
$json${
  "1": {"cohesion": [0, 8.25, 16.5, 24.75, 26.125, 27.5],
        "correccion": [0, 8.25, 16.5, 24.75, 26.125, 27.5],
        "alcance": [0, 8.25, 16.5, 24.75, 26.125, 27.5],
        "cumplimiento": [0, 10.09, 20.19, 30.28, 40.38, 42.5]},
  "2": {"cohesion": [0, 1.375, 2.75, 4.125, 15.812, 27.5],
        "correccion": [0, 1.375, 2.75, 4.125, 15.812, 27.5],
        "alcance": [0, 1.375, 2.75, 4.125, 15.812, 27.5],
        "cumplimiento": [0, 2.125, 4.25, 17, 29.75, 42.5]}
}$json$::jsonb,
(select id from public.sources where code = 'SIELE_GUIA_PREP_2016'), 'verified_older_edition', 'published';

insert into public.rubric_versions (code, version_no, skill, title, criteria, points_table, source_id, verification, status)
select 'EIO-GUIA2016', 1, 'speaking', 'Expresión e interacción orales — rúbrica pedagógica',
$json$[
  {"key": "uso_lengua", "label": "Uso de la lengua", "weight": 66,
   "description": "Cohesión y organización del discurso, fluidez, pronunciación e inteligibilidad, corrección y alcance léxico y gramatical. No se penaliza ninguna variedad geográfica del español.",
   "focus": ["Organización y conectores del discurso", "Fluidez, ritmo, pronunciación e inteligibilidad", "Corrección y efecto de los errores en la comunicación", "Alcance y precisión del vocabulario", "Desarrollo del discurso con recursos adecuados"],
   "bands": [
     {"band": 0, "summary": "No hay producción evaluable."},
     {"band": 1, "summary": "Palabras y frases aisladas con muchas pausas; inteligible con esfuerzo. Muy por debajo de lo que pide la tarea."},
     {"band": 2, "summary": "Frases sencillas enlazadas con conectores básicos; pausas frecuentes y errores que a veces obstaculizan."},
     {"band": 3, "summary": "Discurso comprensible y bastante continuo; repertorio suficiente con errores que no impiden la comunicación."},
     {"band": 4, "summary": "Discurso fluido y organizado; buen control y variedad, con errores ocasionales."},
     {"band": 5, "summary": "Uso de la lengua plenamente adecuado al nivel que exige la tarea: fluido, preciso y bien articulado."}
   ]},
  {"key": "cumplimiento", "label": "Cumplimiento de la tarea", "weight": 34,
   "description": "Respuesta a todos los puntos, pertinencia, adecuación a la situación comunicativa, desarrollo suficiente y uso del estímulo (imagen, texto o pregunta).",
   "focus": ["Todos los puntos solicitados", "Pertinencia y coherencia con el enunciado", "Adecuación a la situación", "Desarrollo suficiente (no solo duración)", "Uso del estímulo proporcionado"],
   "bands": [
     {"band": 0, "summary": "No responde a la tarea."},
     {"band": 1, "summary": "Responde de forma mínima o fuera de tema a una parte de la tarea."},
     {"band": 2, "summary": "Cumple parcialmente; faltan varios puntos o el desarrollo es muy escaso."},
     {"band": 3, "summary": "Cumple la mayoría de los puntos con un desarrollo limitado."},
     {"band": 4, "summary": "Cumple todos los puntos con desarrollo adecuado y se adapta a la situación."},
     {"band": 5, "summary": "Cumplimiento completo y eficaz, con desarrollo, ejemplos y plena adecuación."}
   ]}
]$json$::jsonb,
$json${"*": {"uso_lengua": [0, 6.6, 13.2, 19.8, 26.4, 33], "cumplimiento": [0, 3.4, 6.8, 10.2, 13.6, 17]}}$json$::jsonb,
(select id from public.sources where code = 'SIELE_GUIA_PREP_2016'), 'verified_older_edition', 'published';

-- ---------------------------------------------------------------------------
-- Tablas de puntuación (guía 2016)
-- ---------------------------------------------------------------------------
insert into public.scoring_tables (skill, kind, bands, max_raw, max_points, source_id, verification, notes)
select v.skill::public.exam_skill, v.kind, v.bands::jsonb, v.max_raw, 250, s.id, 'verified_older_edition', v.notes
from (values
  ('reading', 'raw_to_level', '[
    {"level": "C1", "min_raw": 33, "max_raw": 38, "min_points": 217, "max_points": 250},
    {"level": "B2", "min_raw": 27, "max_raw": 32, "min_points": 178, "max_points": 216.99},
    {"level": "B1", "min_raw": 18, "max_raw": 26, "min_points": 118, "max_points": 177.99},
    {"level": "A2", "min_raw": 10, "max_raw": 17, "min_points": 66, "max_points": 117.99},
    {"level": "A1", "min_raw": 5, "max_raw": 9, "min_points": 33, "max_points": 65.99},
    {"level": "pre_A1", "min_raw": 0, "max_raw": 4, "min_points": 0, "max_points": 32.99}]', 38,
   'Solo determina un intervalo de puntos por nivel. Válida únicamente para pruebas de 38 ítems.'),
  ('listening', 'raw_to_level', '[
    {"level": "C1", "min_raw": 33, "max_raw": 38, "min_points": 211, "max_points": 250},
    {"level": "B2", "min_raw": 27, "max_raw": 32, "min_points": 164, "max_points": 210.99},
    {"level": "B1", "min_raw": 18, "max_raw": 26, "min_points": 112, "max_points": 163.99},
    {"level": "A2", "min_raw": 10, "max_raw": 17, "min_points": 66, "max_points": 111.99},
    {"level": "A1", "min_raw": 5, "max_raw": 9, "min_points": 33, "max_points": 65.99},
    {"level": "pre_A1", "min_raw": 0, "max_raw": 4, "min_points": 0, "max_points": 32.99}]', 38,
   'Solo determina un intervalo de puntos por nivel. Válida únicamente para pruebas de 38 ítems.'),
  ('writing', 'points_to_level', '[
    {"level": "C1", "min_points": 215, "max_points": 250},
    {"level": "B2", "min_points": 167, "max_points": 214.99},
    {"level": "B1", "min_points": 104, "max_points": 166.99},
    {"level": "A2", "min_points": 69, "max_points": 103.99},
    {"level": "A1", "min_points": 34, "max_points": 68.99},
    {"level": "pre_A1", "min_points": 0, "max_points": 33.99}]', null,
   'Aplicable con la rúbrica EIE-GUIA2016 y las dos tareas completas (250 puntos).'),
  ('speaking', 'points_to_level', '[
    {"level": "C1", "min_points": 215, "max_points": 250},
    {"level": "B2", "min_points": 176, "max_points": 214.99},
    {"level": "B1", "min_points": 125, "max_points": 175.99},
    {"level": "A2", "min_points": 76, "max_points": 124.99},
    {"level": "A1", "min_points": 40, "max_points": 75.99},
    {"level": "pre_A1", "min_points": 0, "max_points": 39.99}]', null,
   'Aplicable con la rúbrica EIO-GUIA2016 y las cinco tareas completas (250 puntos).')
) as v(skill, kind, bands, max_raw, notes)
cross join (select id from public.sources where code = 'SIELE_GUIA_PREP_2016') s;

insert into public.retention_policies (entity, retain_days) values
  ('oral_recordings', 365), ('attempt_events', 365), ('response_revisions', 365), ('audit_logs', 730);

insert into public.app_settings (key, value) values
  ('ai.enabled', 'false'::jsonb),
  ('ai.max_input_chars', '6000'::jsonb),
  ('ai.daily_limit_per_teacher', '40'::jsonb);
