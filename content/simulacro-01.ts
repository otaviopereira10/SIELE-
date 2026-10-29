import type { SeedExam, SeedOption } from "./types";

/**
 * Simulacro 01 — contenido 100 % original creado para SIELE Trainer Pro.
 * Reproduce la estructura pública del SIELE Global (tareas, número de ítems, tiempos y tipos de
 * actividad) sin copiar textos, audios ni imágenes oficiales.
 *
 * Aviso: este archivo forma parte del repositorio, por lo que sus claves son públicas. Úselo para
 * práctica y demostraciones; para simulacros formales cree contenido nuevo desde el panel.
 */

const abc = (...bodies: string[]): SeedOption[] => bodies.map((body, i) => ({ label: String.fromCharCode(97 + i), body }));
const letters = (...bodies: string[]): SeedOption[] => bodies.map((body, i) => ({ label: String.fromCharCode(65 + i), body }));

export const simulacro01: SeedExam = {
  code: "SIM-GLOBAL-01",
  title: "Simulacro SIELE Global 01",
  description: "Simulacro completo de las cuatro pruebas con contenido original: vida urbana, trabajo y aprendizaje.",
  format_label: "SIELE Global — formato público de referencia (siele.org, consulta 29/10/2026; Guía de preparadores 2016)",
  notes: "Audios generados con voces sintéticas de varias variedades del español (identificados en pantalla).",
  sections: [
    // =====================================================================
    // COMPRENSIÓN DE LECTURA — 5 tareas · 38 ítems · 60 minutos
    // =====================================================================
    {
      skill: "reading",
      title: "Comprensión de lectura",
      instructions:
        "Esta prueba tiene cinco tareas de dificultad creciente y 38 preguntas. Dispone de 60 minutos en total. Las respuestas incorrectas no restan puntos.",
      time_limit_seconds: 3600,
      allow_back: false,
      pause_after_seconds: 0,
      tasks: [
        {
          code: "CL-T1",
          title: "Tarea 1",
          type: "single_choice",
          level_label: "A1",
          instructions: "Va a leer cinco textos breves. Elija la opción correcta para cada una de las cinco preguntas.",
          declared_items: 5,
          suggested_seconds: 600,
          skill_focus: ["información general", "información específica"],
          lexical_topic: "Ocio, vivienda, servicios",
          content: {
            texts: [
              {
                key: "t1",
                label: "Texto 1",
                body: "Hola, Marcos:\n\nEl sábado es el cumpleaños de mi hermana Clara y vamos a hacer una comida en el parque, al lado del lago. Empezamos a las dos. Yo llevo la tarta y los refrescos. ¿Puedes traer tu guitarra? A Clara le encanta cuando tocas.\n\nUn beso,\nInés",
                question_positions: [1],
              },
              {
                key: "t2",
                label: "Texto 2",
                title: "Se alquila estudio",
                body: "Estudio de 35 m² en la calle Toledo, muy cerca de la estación de metro. Tiene cocina americana, baño completo y muebles nuevos. Ideal para una persona. No se aceptan animales. Precio: 480 € al mes. Llamar por las tardes al 600 112 233.",
                question_positions: [2],
              },
              {
                key: "t3",
                label: "Texto 3",
                title: "Biblioteca municipal: horario de verano",
                body: "Del 1 de julio al 31 de agosto, la biblioteca abre de lunes a viernes de 9:00 a 14:00. Los sábados y domingos está cerrada. Puede devolver los libros en el buzón de la entrada a cualquier hora.",
                question_positions: [3],
              },
              {
                key: "t4",
                label: "Texto 4",
                title: "Yoga en el parque",
                body: "Todos los domingos de junio, clase de yoga gratuita para adultos en el parque de la Ribera, de 10:00 a 11:00. Hay que traer una esterilla y agua. Si llueve, la clase se hace en el polideportivo municipal.",
                question_positions: [4],
              },
              {
                key: "t5",
                label: "Texto 5",
                body: "Vendo bicicleta de montaña, color azul, en muy buen estado. Solo tiene dos años. La vendo porque me voy a vivir a otra ciudad. Precio: 150 euros, con casco y luces. Interesados, escribir a Óscar: oscar.bici@correo.es",
                question_positions: [5],
              },
            ],
          },
          questions: [
            {
              prompt: "Inés escribe a Marcos para…",
              level: "A1",
              focus: "global",
              options: abc("invitarlo a una comida de cumpleaños.", "pedirle una tarta para Clara.", "decirle que la fiesta es en su casa."),
              correct: 0,
              explanation: "Inés anuncia la comida del cumpleaños de Clara en el parque y le pide que vaya con su guitarra.",
            },
            {
              prompt: "El estudio…",
              level: "A1",
              focus: "specific",
              options: abc("es para una familia.", "está cerca del metro.", "acepta perros y gatos."),
              correct: 1,
              explanation: "«Muy cerca de la estación de metro». Es ideal para una persona y no se aceptan animales.",
            },
            {
              prompt: "En agosto, la biblioteca…",
              level: "A1",
              focus: "specific",
              options: abc("abre por la tarde.", "cierra los fines de semana.", "no permite devolver libros."),
              correct: 1,
              explanation: "En verano abre de lunes a viernes por la mañana; sábados y domingos está cerrada.",
            },
            {
              prompt: "Si llueve el domingo, la clase de yoga…",
              level: "A1",
              focus: "specific",
              options: abc("se cancela.", "es en el polideportivo.", "empieza más tarde."),
              correct: 1,
              explanation: "«Si llueve, la clase se hace en el polideportivo municipal».",
            },
            {
              prompt: "Óscar vende la bicicleta porque…",
              level: "A1",
              focus: "global",
              options: abc("está rota.", "se cambia de ciudad.", "es muy vieja."),
              correct: 1,
              explanation: "«La vendo porque me voy a vivir a otra ciudad». Está en muy buen estado y solo tiene dos años.",
            },
          ],
        },
        {
          code: "CL-T2",
          title: "Tarea 2",
          type: "single_choice",
          level_label: "A2",
          instructions: "Va a leer un texto en el que una mujer cuenta una experiencia. Elija la opción correcta para cada una de las cinco preguntas.",
          declared_items: 5,
          suggested_seconds: 600,
          lexical_topic: "Vecindario, jardinería, relaciones sociales",
          grammar_topic: "Pretérito indefinido e imperfecto",
          content: {
            texts: [
              {
                key: "blog",
                title: "Mi huerto en la azotea",
                body: "Me llamo Carmen, tengo sesenta y dos años y vivo en un edificio antiguo de Barcelona. Hace dos años, cuando me jubilé, tenía mucho tiempo libre y no sabía qué hacer con él. Un día, mientras tendía la ropa en la azotea, pensé: «¿Por qué no plantamos aquí tomates y lechugas?».\n\nAl principio, los vecinos no estaban muy convencidos. El presidente de la comunidad decía que el agua podía estropear el techo y algunos pensaban que el huerto iba a atraer insectos. Así que pedí ayuda a una asociación del barrio que enseña a construir huertos urbanos. Ellos nos explicaron cómo usar cajas de madera y un sistema de riego que gasta muy poca agua.\n\nHoy somos once vecinos en el huerto, de edades muy diferentes. El más joven es Pau, un niño de ocho años que se encarga de las fresas. Nos reunimos los martes y los sábados por la mañana para trabajar juntos, aunque cada uno sube cuando quiere a regar o simplemente a tomar el sol.\n\nLo mejor no son las verduras, aunque están buenísimas, sino la relación entre los vecinos. Antes solo nos saludábamos en el ascensor; ahora celebramos los cumpleaños arriba y compartimos recetas. El verano pasado organizamos una cena con todo lo que habíamos cultivado.\n\nMi consejo para quien quiera empezar: no hace falta mucho dinero ni mucho espacio, pero sí paciencia. Las primeras lechugas tardaron dos meses en salir y los primeros tomates… ¡se los comieron los pájaros!",
                source: "Texto original de SIELE Trainer Pro",
              },
            ],
          },
          questions: [
            {
              prompt: "Carmen tuvo la idea del huerto…",
              level: "A2",
              focus: "specific",
              options: abc("cuando estaba en la azotea.", "porque se lo pidió un vecino.", "al leer un anuncio de una asociación."),
              correct: 0,
              explanation: "La idea surgió «mientras tendía la ropa en la azotea».",
            },
            {
              prompt: "Al principio, algunos vecinos…",
              level: "A2",
              focus: "specific",
              options: abc("querían plantar flores.", "tenían miedo de problemas en el edificio.", "no tenían tiempo para ayudar."),
              correct: 1,
              explanation: "Temían que el agua estropeara el techo y que llegaran insectos.",
            },
            {
              prompt: "La asociación del barrio…",
              level: "A2",
              focus: "specific",
              options: abc("pagó las cajas de madera.", "les enseñó a regar gastando poca agua.", "construyó el huerto para ellos."),
              correct: 1,
              explanation: "Les explicaron cómo usar cajas y «un sistema de riego que gasta muy poca agua». No dice que pagara ni que lo construyera.",
            },
            {
              prompt: "Según Carmen, lo más positivo del huerto es…",
              level: "A2",
              focus: "global",
              options: abc("ahorrar dinero en verduras.", "que los vecinos se conocen mejor.", "que los niños aprenden a cocinar."),
              correct: 1,
              explanation: "«Lo mejor no son las verduras […] sino la relación entre los vecinos».",
            },
            {
              prompt: "En el texto, Carmen recomienda…",
              level: "A2",
              focus: "global",
              options: abc("empezar con mucho espacio.", "tener paciencia.", "proteger los tomates con una red."),
              correct: 1,
              explanation: "Dice que no hace falta mucho dinero ni espacio, «pero sí paciencia». La red no aparece en el texto.",
            },
          ],
        },
        {
          code: "CL-T3",
          title: "Tarea 3",
          type: "matching",
          level_label: "B1",
          instructions:
            "Va a leer tres textos en los que tres personas cuentan su experiencia de trabajar a distancia desde un pueblo. Relacione cada enunciado con la persona correspondiente. Cada persona puede elegirse más de una vez.",
          declared_items: 8,
          suggested_seconds: 720,
          lexical_topic: "Trabajo, vivienda, medio rural",
          content: {
            bank_title: "Personas",
            unique_use: false,
            layout: "select",
            texts: [
              {
                key: "andrea",
                label: "A",
                title: "Andrea, diseñadora gráfica",
                body: "Me mudé a un pueblo de Teruel de doscientos habitantes justo antes de la pandemia, cuando nadie hablaba todavía del teletrabajo. Mis amigos pensaban que estaba loca. Lo que más me costó fue la conexión a internet: durante los primeros meses tenía que ir al bar de la plaza para enviar los archivos grandes a mis clientes. Ahora tenemos fibra óptica y trabajo desde casa sin problemas. Echo de menos los museos y las exposiciones de la ciudad, pero lo compenso con un viaje a Madrid una vez al mes. Lo mejor es que mi hija va a una escuela con solo doce alumnos y la conocen todos.",
              },
              {
                key: "rodrigo",
                label: "B",
                title: "Rodrigo, programador",
                body: "Volví al pueblo de mis abuelos, en Galicia, después de quince años en Londres. Allí ganaba más, pero pasaba dos horas al día en el metro. Ahora trabajo para la misma empresa británica, así que mi sueldo no ha cambiado y mis gastos son mucho menores: pago por una casa con huerto lo que antes pagaba por una habitación. El mayor inconveniente es la diferencia de horario con algunos compañeros de otros continentes, que me obliga a tener reuniones por la noche. También he tenido que aprender a separar el trabajo de la vida personal, porque al principio trabajaba a todas horas.",
              },
              {
                key: "lucia",
                label: "C",
                title: "Lucía, traductora",
                body: "Yo no elegí el pueblo por la tranquilidad, sino por el precio de la vivienda: en la ciudad era imposible comprar un piso con mi sueldo. Al principio me sentí bastante sola; los vecinos eran amables, pero yo no conocía a nadie de mi edad. Todo cambió cuando abrieron un espacio de trabajo compartido en el antiguo ayuntamiento. Allí conocí a otras personas que trabajan a distancia y ahora organizamos actividades culturales para el pueblo. Lo que no soporto es depender del coche para todo: el autobús pasa solo dos veces al día.",
              },
            ],
          },
          bank: letters("Andrea", "Rodrigo", "Lucía"),
          questions: [
            { prompt: "Al principio tuvo problemas para enviar su trabajo.", level: "B1", focus: "specific", correct: 0, explanation: "Andrea tenía que ir al bar de la plaza para enviar archivos grandes." },
            { prompt: "Mantiene el mismo salario que antes de mudarse.", level: "B1", focus: "specific", correct: 1, explanation: "Rodrigo trabaja para la misma empresa: «mi sueldo no ha cambiado»." },
            { prompt: "Se mudó porque no podía pagar una vivienda en la ciudad.", level: "B1", focus: "specific", correct: 2, explanation: "Lucía eligió el pueblo «por el precio de la vivienda»." },
            { prompt: "A veces trabaja fuera de su horario habitual por la hora de otros países.", level: "B1", focus: "detail", correct: 1, explanation: "Rodrigo tiene reuniones por la noche por la diferencia horaria." },
            { prompt: "Viaja con regularidad a la ciudad para disfrutar de la cultura.", level: "B1", focus: "detail", correct: 0, explanation: "Andrea va a Madrid una vez al mes porque echa de menos los museos." },
            { prompt: "Encontró compañía gracias a un lugar para trabajar con otras personas.", level: "B1", focus: "detail", correct: 2, explanation: "Lucía conoció gente en el espacio de trabajo compartido." },
            { prompt: "Considera que el transporte público es insuficiente.", level: "B1", focus: "inference", correct: 2, explanation: "Lucía depende del coche porque el autobús pasa solo dos veces al día." },
            { prompt: "Su decisión sorprendió a las personas de su entorno.", level: "B1", focus: "inference", correct: 0, explanation: "Los amigos de Andrea «pensaban que estaba loca»." },
          ],
        },
        {
          code: "CL-T4",
          title: "Tarea 4",
          type: "fragment_gap",
          level_label: "B2",
          instructions:
            "Va a leer dos textos en los que faltan cuatro fragmentos en cada uno. Elija el fragmento correcto para cada hueco. En cada texto sobra un fragmento.",
          declared_items: 8,
          suggested_seconds: 840,
          lexical_topic: "Psicología, consumo responsable",
          content: {
            bank_title: "Fragmentos",
            passages: [
              {
                key: "aburrimiento",
                title: "El arte de aburrirse",
                bank_positions: [1, 2, 3, 4, 5],
                body: "Vivimos rodeados de estímulos. En cuanto tenemos un minuto libre en la parada del autobús o en la cola del supermercado, sacamos el teléfono para llenar el vacío. [[1]] Sin embargo, cada vez más investigadores defienden que el aburrimiento cumple una función importante.\n\nSegún varios estudios de psicología, cuando la mente no tiene nada concreto que hacer, empieza a divagar y a establecer conexiones inesperadas. [[2]] No es casualidad que muchas personas tengan sus mejores ideas mientras se duchan o pasean sin rumbo.\n\nEl problema es que hemos perdido la costumbre de tolerar esos momentos. [[3]] Los niños, en particular, apenas tienen tiempo sin programar: pasan de la escuela a las actividades extraescolares y de ahí a las pantallas.\n\nAlgunos educadores proponen recuperar el derecho a no hacer nada. [[4]] Al principio cuesta, admiten, pero con el tiempo los alumnos descubren juegos, preguntas y proyectos que nadie les había propuesto.",
                source: "Texto original de SIELE Trainer Pro",
              },
              {
                key: "reparacion",
                title: "La segunda vida de los objetos",
                bank_positions: [6, 7, 8, 9, 10],
                body: "En un barrio de Madrid, un antiguo taller mecánico se ha convertido en un lugar muy especial: un café de reparación. Cada jueves, vecinos voluntarios con conocimientos de electricidad, costura o carpintería ayudan gratuitamente a quienes traen objetos estropeados. [[5]]\n\nLa iniciativa nació hace cinco años, cuando un grupo de jubilados se dio cuenta de que muchos aparatos acababan en la basura por averías muy sencillas. [[6]] Desde entonces, han pasado por sus mesas más de tres mil objetos, desde tostadoras hasta muñecas antiguas.\n\nLos organizadores insisten en que no se trata solo de ahorrar dinero. [[7]] Muchos visitantes llegan con un objeto roto y se marchan sabiendo cómo arreglarlo ellos mismos la próxima vez.\n\nEl modelo, que surgió en los Países Bajos, se ha extendido por Europa y América Latina. [[8]] Aun así, sus defensores reconocen que el gran cambio debe venir de los fabricantes: mientras los productos se diseñen para durar poco, los voluntarios seguirán teniendo mucho trabajo.",
                source: "Texto original de SIELE Trainer Pro",
              },
            ],
          },
          bank: letters(
            "Es en ese estado aparentemente improductivo donde surge buena parte de la creatividad.",
            "Así evitamos, aunque sea por unos segundos, la incómoda sensación de no tener nada que hacer.",
            "En algunas escuelas, por ejemplo, han introducido ratos sin ninguna actividad dirigida.",
            "A la mínima señal de inactividad buscamos algo que nos distraiga, como si el aburrimiento fuera una enfermedad.",
            "Por eso los expertos recomiendan llenar cada minuto libre con actividades útiles.",
            "La condición es que el propietario participe en la reparación y aprenda durante el proceso.",
            "Decidieron entonces compartir lo que sabían antes de que esos conocimientos se perdieran.",
            "También pretenden cambiar nuestra relación con las cosas y reducir los residuos.",
            "Hoy existen cafés de reparación en cientos de ciudades, y algunos ayuntamientos ya los financian.",
            "Por eso las empresas han empezado a fabricar aparatos más fáciles de reparar.",
          ),
          questions: [
            { prompt: "Hueco 1", level: "B2", focus: "connector", correct: 1, explanation: "«Así evitamos…» retoma la acción de sacar el teléfono; «Sin embargo» introduce después la idea contraria." },
            { prompt: "Hueco 2", level: "B2", focus: "inference", correct: 0, explanation: "«Ese estado» se refiere a la mente que divaga; la frase siguiente da ejemplos de buenas ideas." },
            { prompt: "Hueco 3", level: "B2", focus: "inference", correct: 3, explanation: "Desarrolla «hemos perdido la costumbre de tolerar esos momentos»." },
            { prompt: "Hueco 4", level: "B2", focus: "detail", correct: 2, explanation: "Ejemplo concreto de la propuesta; «al principio cuesta» se refiere a esos ratos sin actividad. El fragmento E contradice el texto." },
            { prompt: "Hueco 5", level: "B2", focus: "detail", correct: 5, explanation: "Completa el funcionamiento del café: el propietario participa y aprende." },
            { prompt: "Hueco 6", level: "B2", focus: "connector", correct: 6, explanation: "«Decidieron entonces» continúa la historia de los jubilados." },
            { prompt: "Hueco 7", level: "B2", focus: "inference", correct: 7, explanation: "«No se trata solo de ahorrar dinero. También…»." },
            { prompt: "Hueco 8", level: "B2", focus: "detail", correct: 8, explanation: "Habla de la expansión del modelo; el fragmento J contradice la última frase sobre los fabricantes." },
          ],
        },
        {
          code: "CL-T5",
          title: "Tarea 5",
          type: "dropdown_gap",
          level_label: "B2–C1",
          instructions: "Va a leer un texto en el que faltan doce palabras o expresiones. Elija la opción correcta para cada hueco.",
          declared_items: 12,
          suggested_seconds: 840,
          lexical_topic: "Urbanismo",
          grammar_topic: "Conectores, régimen preposicional, colocaciones",
          content: {
            passage_title: "La ciudad de los quince minutos",
            passage:
              "En los últimos años, pocas ideas urbanísticas han despertado tanto interés [[1]] la llamada «ciudad de los quince minutos». La propuesta parte de una premisa sencilla: cualquier vecino debería poder satisfacer sus necesidades básicas —trabajar, comprar, estudiar o cuidar su salud— a un cuarto de hora a pie o en bicicleta de su casa.\n\n[[2]] parezca una obviedad, el modelo supone un cambio radical respecto al urbanismo del siglo XX, que [[3]] las funciones de la ciudad en zonas separadas: barrios dormitorio por un lado, polígonos industriales por otro y grandes centros comerciales en las afueras. Esa separación obligó a millones de personas a [[4]] largos trayectos diarios, con el consiguiente coste en tiempo, dinero y contaminación.\n\nSus defensores sostienen que acercar los servicios a los ciudadanos no solo reduce las emisiones, [[5]] también fortalece el tejido social: quien hace sus recados en el barrio se cruza con sus vecinos, conoce a los comerciantes y [[6]] parte de una comunidad.\n\n[[7]], la idea no está exenta de críticas. Algunos urbanistas advierten de que, si no se acompaña de políticas de vivienda asequible, puede [[8]] el precio de los barrios mejor equipados y expulsar a sus habitantes más vulnerables. Otros señalan que no todas las actividades pueden descentralizarse: un gran hospital o una universidad difícilmente [[9]] a quince minutos de todos.\n\n[[10]] de estas objeciones, ciudades tan distintas como París, Melbourne o Bogotá han incorporado el concepto a sus planes estratégicos. Con todo, la mayor virtud del modelo no [[11]] en su aplicación literal, sino en la pregunta que plantea: ¿para quién diseñamos nuestras ciudades? Si la respuesta son las personas y no los coches, el reloj de los quince minutos habrá [[12]] su función.",
            source: "Texto original de SIELE Trainer Pro",
          },
          questions: [
            { prompt: "Hueco 1", level: "B2", focus: "grammar", options: abc("como", "que", "tanto"), correct: 0, explanation: "Comparativa de igualdad: «tanto interés como…»." },
            { prompt: "Hueco 2", level: "B2", focus: "connector", options: abc("Aunque", "Pese", "Si bien"), correct: 0, explanation: "«Aunque» + subjuntivo (parezca). «Pese» exige «a que»; «si bien» va con indicativo." },
            { prompt: "Hueco 3", level: "C1", focus: "grammar", options: abc("dividió", "dividiera", "dividiendo"), correct: 0, explanation: "Hecho pasado presentado como real en una relativa explicativa: indicativo." },
            { prompt: "Hueco 4", level: "C1", focus: "lexis", options: abc("realizar", "tardar", "llevar"), correct: 0, explanation: "Colocación: «realizar trayectos». «Tardar» y «llevar» no admiten ese complemento aquí." },
            { prompt: "Hueco 5", level: "C1", focus: "connector", options: abc("sino que", "pero que", "más bien"), correct: 0, explanation: "Estructura «no solo…, sino que también…» ante un verbo conjugado." },
            { prompt: "Hueco 6", level: "C1", focus: "lexis", options: abc("se siente", "se hace", "se queda"), correct: 0, explanation: "«Sentirse parte de una comunidad»." },
            { prompt: "Hueco 7", level: "C1", focus: "connector", options: abc("No obstante", "Por consiguiente", "Es decir"), correct: 0, explanation: "Introduce una idea que se opone a lo anterior (las críticas)." },
            { prompt: "Hueco 8", level: "C1", focus: "lexis", options: abc("disparar", "despegar", "alzar"), correct: 0, explanation: "Colocación: «disparar el precio» (hacerlo subir mucho)." },
            { prompt: "Hueco 9", level: "C1", focus: "grammar", options: abc("podrán estar", "podrían estando", "pueden estén"), correct: 0, explanation: "Futuro de probabilidad con infinitivo; las otras formas son agramaticales." },
            { prompt: "Hueco 10", level: "C1", focus: "connector", options: abc("A pesar", "Pese", "Aun"), correct: 0, explanation: "«A pesar de» + sustantivo. «Pese» iría con «a»." },
            { prompt: "Hueco 11", level: "C1", focus: "lexis", options: abc("radica", "consta", "supone"), correct: 0, explanation: "«Radicar en»: tener su origen o fundamento en algo." },
            { prompt: "Hueco 12", level: "C1", focus: "lexis", options: abc("cumplido", "hecho", "logrado"), correct: 0, explanation: "Colocación: «cumplir una función»." },
          ],
        },
      ],
    },

    // =====================================================================
    // COMPRENSIÓN AUDITIVA — 6 tareas · 38 ítems · 55 minutos · sin retorno
    // =====================================================================
    {
      skill: "listening",
      title: "Comprensión auditiva",
      instructions:
        "Esta prueba tiene seis tareas y 38 preguntas. Cada audio se escucha dos veces. No es posible volver a una tarea anterior. Al terminar la prueba tendrá un descanso de 15 minutos.",
      time_limit_seconds: 3300,
      allow_back: false,
      pause_after_seconds: 900,
      tasks: [
        {
          code: "CA-T1",
          title: "Tarea 1",
          type: "matching",
          level_label: "A1",
          instructions:
            "Va a escuchar una conversación entre Lucía y Tomás, un estudiante que habla de su piso nuevo. Lea las cinco frases y elija la opción correcta para cada hueco. Va a escuchar la conversación dos veces.",
          declared_items: 5,
          max_audio_plays: 2,
          transcript_from: ["ca-t1.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 30, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t1.mp3", kind: "audio", label: "Conversación" } },
            bank_title: "Opciones",
            unique_use: true,
            layout: "select",
          },
          bank: letters("dos estudiantes", "tres amigos", "un balcón", "una terraza", "ascensor", "calefacción", "bicicleta", "autobús", "350", "530"),
          questions: [
            { prompt: "Tomás vive con ______.", level: "A1", focus: "specific", correct: 0, explanation: "«Lo comparto con dos estudiantes»." },
            { prompt: "Su habitación tiene ______.", level: "A1", focus: "specific", correct: 2, explanation: "«Es pequeña, pero tiene un balcón»." },
            { prompt: "El edificio no tiene ______.", level: "A1", focus: "specific", correct: 4, explanation: "«No hay ascensor»." },
            { prompt: "Tomás va a la universidad en ______.", level: "A1", focus: "specific", correct: 6, explanation: "«Voy en bicicleta»; el autobús es más lento." },
            { prompt: "Paga ______ euros al mes.", level: "A1", focus: "specific", correct: 8, explanation: "«Pago trescientos cincuenta euros»." },
          ],
        },
        {
          code: "CA-T2",
          title: "Tarea 2",
          type: "single_choice",
          level_label: "A2",
          instructions: "Va a escuchar cinco noticias y anuncios de una emisora de radio. Elija la opción correcta para cada una de las cinco preguntas. Va a escuchar el audio dos veces.",
          declared_items: 5,
          max_audio_plays: 2,
          transcript_from: ["ca-t2.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 30, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t2.mp3", kind: "audio", label: "Noticias y anuncios" } },
          },
          questions: [
            { prompt: "Noticia 1. La parada del mercado…", level: "A2", focus: "global", options: abc("cambia de lugar durante tres semanas.", "tiene nuevos horarios.", "se cierra el lunes."), correct: 0, explanation: "Por las obras, la parada se traslada a la calle Hidalgo durante tres semanas; los horarios no cambian." },
            { prompt: "Anuncio 2. Para participar en los talleres de cocina hay que…", level: "A2", focus: "specific", options: abc("pagar una pequeña cantidad.", "inscribirse antes.", "llevar los ingredientes."), correct: 1, explanation: "Son gratuitos y las plazas son limitadas: hay que inscribirse. Solo hay que llevar un delantal." },
            { prompt: "Noticia 3. Según el pronóstico, el domingo…", level: "A2", focus: "specific", options: abc("hará sol todo el día.", "habrá tormentas por la tarde.", "bajarán mucho las temperaturas."), correct: 1, explanation: "«El domingo por la tarde llegarán tormentas fuertes»." },
            { prompt: "Noticia 4. Este año, la feria del libro…", level: "A2", focus: "global", options: abc("se celebra en otro lugar.", "dura menos días.", "cobra la entrada."), correct: 0, explanation: "Pasa de la plaza central al parque de la Ciudad Deportiva. La entrada es libre." },
            { prompt: "Anuncio 5. Los oyentes pueden ganar entradas si…", level: "A2", focus: "specific", options: abc("envían una canción.", "llaman antes que los demás.", "van al teatro el sábado."), correct: 1, explanation: "«Los oyentes que llamen primero ganarán dos entradas»." },
          ],
        },
        {
          code: "CA-T3",
          title: "Tarea 3",
          type: "matching",
          level_label: "B1",
          instructions:
            "Va a escuchar a ocho personas que hablan de su primer trabajo. Relacione a cada persona con el enunciado correspondiente. Hay once enunciados: elija solo ocho. Va a escuchar el audio dos veces.",
          declared_items: 8,
          max_audio_plays: 2,
          transcript_from: ["ca-t3.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 30, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t3.mp3", kind: "audio", label: "Ocho testimonios" } },
            bank_title: "Enunciados",
            unique_use: true,
            layout: "select",
          },
          bank: letters(
            "Aquel trabajo influyó en la profesión que eligió después.",
            "Ganó dinero, pero no pudo disfrutar del lugar donde estaba.",
            "Sus compañeros acabaron siendo muy importantes en su vida.",
            "Lo que aprendió le resultó útil en un empleo posterior.",
            "Al principio no le gustaba porque tenía otros planes.",
            "Vivió una situación muy embarazosa que terminó bien.",
            "Hoy se dedica al mismo producto con el que empezó.",
            "Aprendió a mostrarse amable aunque estuviera cansado.",
            "Lo despidieron por llegar tarde varias veces.",
            "Trabajaba con sus padres en un negocio familiar.",
            "Consiguió el empleo gracias a un anuncio en el periódico.",
          ),
          questions: [
            { prompt: "Persona 1", level: "B1", focus: "global", correct: 7, explanation: "«Aprendí a sonreír aunque estuviera cansado»." },
            { prompt: "Persona 2", level: "B1", focus: "global", correct: 0, explanation: "Dar clases particulares la llevó a estudiar para ser profesora." },
            { prompt: "Persona 3", level: "B1", focus: "global", correct: 1, explanation: "Ahorró, pero no vio el mar ni una vez." },
            { prompt: "Persona 4", level: "B1", focus: "global", correct: 2, explanation: "Sus compañeros se convirtieron «casi en mi familia»." },
            { prompt: "Persona 5", level: "B1", focus: "global", correct: 3, explanation: "Conocer las calles le sirvió como taxista." },
            { prompt: "Persona 6", level: "B1", focus: "global", correct: 4, explanation: "No le gustaba porque quería ser música. (Trabajaba en la tienda de su tío, no de sus padres.)" },
            { prompt: "Persona 7", level: "B1", focus: "global", correct: 5, explanation: "Se le cayó una bandeja delante de un cliente famoso, que se rio y le dejó propina." },
            { prompt: "Persona 8", level: "B1", focus: "global", correct: 6, explanation: "Empezó recogiendo café y hoy tiene una empresa de exportación de café." },
          ],
        },
        {
          code: "CA-T4",
          title: "Tarea 4",
          type: "single_choice",
          level_label: "B2",
          instructions:
            "Va a escuchar una entrevista radiofónica a Marta Ibáñez, arquitecta y urbanista. Elija la opción correcta para cada una de las ocho preguntas. Va a escuchar la entrevista dos veces.",
          declared_items: 8,
          max_audio_plays: 2,
          transcript_from: ["ca-t4.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 45, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t4.mp3", kind: "audio", label: "Entrevista" } },
          },
          questions: [
            { prompt: "Según Marta Ibáñez, en una supermanzana…", level: "B2", focus: "detail", options: abc("los coches no pueden entrar nunca.", "el tráfico de paso rodea la zona.", "solo circulan autobuses por el interior."), correct: 1, explanation: "El tráfico de paso circula por el perímetro; dentro pueden entrar, despacio, quienes viven o trabajan allí." },
            { prompt: "Al principio, los comerciantes…", level: "B2", focus: "specific", options: abc("apoyaron el proyecto con entusiasmo.", "creían que iban a perder ventas.", "pidieron más aparcamientos subterráneos."), correct: 1, explanation: "Temían perder clientes porque no se podía aparcar delante de las tiendas." },
            { prompt: "Un año después, el resultado en el comercio…", level: "B2", focus: "inference", options: abc("sorprendió incluso a los urbanistas.", "fue el que habían previsto.", "fue negativo para las tiendas pequeñas."), correct: 0, explanation: "«Eso no lo esperábamos ni nosotros»." },
            { prompt: "Lo que más emociona a la arquitecta es…", level: "B2", focus: "detail", options: abc("la reducción medida del ruido.", "ver a mayores y niños en la calle.", "el aumento del número de bancos."), correct: 1, explanation: "«Lo que más me emociona no son los datos, sino ver a personas mayores…» y a los niños." },
            { prompt: "Ante la crítica de que el tráfico se traslada, Marta…", level: "B2", focus: "intention", options: abc("la considera infundada.", "admite que tiene parte de razón.", "dice que solo afecta a las calles interiores."), correct: 1, explanation: "«Es una crítica razonable […] el tráfico aumentó un poco al principio»." },
            { prompt: "Para que una supermanzana funcione, debe…", level: "B2", focus: "detail", options: abc("aplicarse en un único barrio.", "formar parte de un plan de movilidad más amplio.", "eliminar los carriles para bicicletas."), correct: 1, explanation: "Una supermanzana aislada no tiene sentido; necesita un plan con transporte público y carriles bici." },
            { prompt: "Recomienda empezar con…", level: "B2", focus: "specific", options: abc("obras definitivas para evitar gastos.", "medidas provisionales y baratas.", "un estudio técnico de varios años."), correct: 1, explanation: "Pintura, macetas, mobiliario móvil: soluciones provisionales." },
            { prompt: "Según la entrevistada, los proyectos fracasan cuando…", level: "B2", focus: "inference", options: abc("no son técnicamente perfectos.", "se imponen sin contar con los vecinos.", "se hacen demasiado rápido."), correct: 1, explanation: "«Los proyectos impuestos desde un despacho suelen fracasar»." },
          ],
        },
        {
          code: "CA-T5",
          title: "Tarea 5",
          type: "single_choice",
          level_label: "B2–C1",
          instructions:
            "Va a escuchar una conferencia sobre la memoria y el aprendizaje de lenguas, dividida en seis fragmentos. Elija la opción que recoge una idea de cada fragmento. Va a escuchar la conferencia dos veces.",
          declared_items: 6,
          max_audio_plays: 2,
          transcript_from: ["ca-t5.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 45, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t5.mp3", kind: "audio", label: "Conferencia" } },
          },
          questions: [
            { prompt: "Fragmento 1", level: "B2", focus: "global", options: abc("Los adultos aprenden lenguas peor que los niños.", "Los adultos tienen ventajas propias para aprender.", "Los adultos solo aprenden si estudian gramática."), correct: 1, explanation: "Aprenden de otra manera, «no necesariamente peor», y saben organizar la información." },
            { prompt: "Fragmento 2", level: "B2", focus: "detail", options: abc("Repetir una palabra muchas veces seguidas es lo más eficaz.", "Conviene dejar intervalos entre los repasos.", "Hay que estudiar en lugares distintos."), correct: 1, explanation: "La práctica espaciada deja pasar tiempo entre repasos." },
            { prompt: "Fragmento 3", level: "C1", focus: "inference", options: abc("Intentar recordar ayuda aunque uno se equivoque.", "Intentar recordar genera inseguridad y conviene evitarlo.", "Releer los apuntes es la técnica más útil."), correct: 0, explanation: "Recordar antes de mirar la respuesta, aun con errores, mejora la memoria; releer solo da sensación de seguridad." },
            { prompt: "Fragmento 4", level: "C1", focus: "detail", options: abc("Dormir poco no afectó al vocabulario.", "Quienes durmieron bien recordaron más palabras.", "El estudio se realizó de noche."), correct: 1, explanation: "Recordaban un treinta por ciento más de vocabulario." },
            { prompt: "Fragmento 5", level: "C1", focus: "inference", options: abc("Cualquier nivel de tensión perjudica la memoria.", "La ansiedad intensa puede provocar bloqueos.", "Los exámenes nunca reflejan el nivel real."), correct: 1, explanation: "Un poco de tensión ayuda; la ansiedad intensa bloquea la memoria de trabajo." },
            { prompt: "Fragmento 6", level: "C1", focus: "global", options: abc("Es mejor estudiar listas de palabras cada día.", "Conviene combinar el estudio con un uso significativo de la lengua.", "Hay que evitar conversar hasta dominar el vocabulario."), correct: 1, explanation: "«La memoria guarda lo que usamos»." },
          ],
        },
        {
          code: "CA-T6",
          title: "Tarea 6",
          type: "multi_select",
          level_label: "C1",
          instructions:
            "Va a escuchar una conferencia sobre turismo y sostenibilidad. Seleccione los seis enunciados que corresponden a ideas expresadas en la conferencia. Va a escuchar la conferencia dos veces.",
          declared_items: 6,
          max_audio_plays: 2,
          transcript_from: ["ca-t6.mp3"],
          content: {
            audio_key: "main",
            timing: { read_seconds: 50, between_seconds: 10, after_seconds: 30 },
            media: { main: { file: "ca-t6.mp3", kind: "audio", label: "Conferencia" } },
            prompt: "Seleccione seis enunciados.",
          },
          bank: letters(
            "Antes, el éxito turístico de la región se medía por el número de visitantes.",
            "El conferenciante considera que el turismo es el principal enemigo de las ciudades históricas.",
            "La subida de los alquileres hizo que muchos residentes abandonaran el centro.",
            "Las tiendas de recuerdos ayudaron a conservar la autenticidad del lugar.",
            "El turismo puede ayudar a frenar la despoblación de las zonas rurales.",
            "Tras las nuevas medidas aumentaron tanto los visitantes como los ingresos.",
            "Los residentes deberían participar en las decisiones sobre el turismo.",
            "La región prohibió por completo la entrada de autobuses en el casco antiguo.",
            "Las estancias largas generan más beneficio local que las visitas de un día.",
            "Las medidas se aplicaron sin ninguna oposición.",
            "El dinero del impuesto turístico se destina al patrimonio y a los servicios para los vecinos.",
            "El orador presenta su modelo como una receta válida para siempre.",
          ),
          questions: [
            {
              prompt: "Ideas expresadas en la conferencia",
              level: "C1",
              focus: "inference",
              correct: [0, 2, 4, 6, 8, 10],
              max_selections: 6,
              points: 6,
              explanation:
                "Verdaderos: A, C, E, G, I y K. Falsos: B (dice que no es el enemigo), D (las tiendas de recuerdos restaron autenticidad), F (hay menos visitantes), H (se limitó el número, no se prohibió), J (hubo protestas) y L (es un equilibrio que hay que revisar).",
            },
          ],
        },
      ],
    },

    // =====================================================================
    // EXPRESIÓN E INTERACCIÓN ESCRITAS — 2 tareas · 50 minutos
    // =====================================================================
    {
      skill: "writing",
      title: "Expresión e interacción escritas",
      instructions:
        "Esta prueba tiene dos tareas. Dispone de 50 minutos en total y puede pasar de una tarea a otra. Se valora el cumplimiento de la tarea, la cohesión, la corrección y el alcance. Se aceptan todas las variedades del español.",
      time_limit_seconds: 3000,
      allow_back: true,
      pause_after_seconds: 0,
      tasks: [
        {
          code: "EIE-T1",
          title: "Tarea 1",
          type: "writing",
          level_label: "A1–B1",
          instructions: "Usted ha recibido este mensaje de un amigo que vive en otro país y va a responderle. En su mensaje usted debe:",
          declared_items: 0,
          suggested_seconds: 1200,
          lexical_topic: "Ciudad, vivienda, consejos",
          content: {
            bullets: [
              "saludar a su amigo;",
              "describir su ciudad y recomendar un barrio, explicando por qué;",
              "contar qué hizo usted los primeros días cuando llegó a la ciudad;",
              "dar dos consejos prácticos a su hermana;",
              "despedirse.",
            ],
            stimulus: {
              body: "¡Hola! ¿Qué tal todo? Mi hermana va a ir a estudiar a tu ciudad el próximo curso y está un poco nerviosa. ¿Me cuentas cómo es vivir allí? ¿Qué barrio le recomiendas? ¿Y qué hiciste tú los primeros días?\n\nUn abrazo,\nJulián",
            },
            word_min: 100,
            word_max: 150,
            keyboard: true,
          },
          teacher_notes:
            "Puntos del enunciado: 1 saludo · 2 ciudad + barrio con razón · 3 primeros días (narración en pasado) · 4 dos consejos (imperativo / «te recomiendo que…») · 5 despedida. El punto 3 permite observar el control de los pasados.",
        },
        {
          code: "EIE-T2",
          title: "Tarea 2",
          type: "writing",
          level_label: "B2–C1",
          instructions: "Elija una de las dos opciones y redacte el texto que se pide.",
          declared_items: 0,
          suggested_seconds: 1800,
          lexical_topic: "Educación, tecnología, servicios públicos",
          content: {
            bullets: [],
            keyboard: true,
            options: [
              {
                key: "opinion",
                title: "Escribir un texto de opinión",
                instructions:
                  "Lea la siguiente noticia y escriba un artículo de opinión para la revista de su universidad sobre el uso del teléfono móvil en las aulas. En él deberá:",
                bullets: ["presentar el tema;", "expresar su opinión al respecto;", "exponer argumentos que apoyen esa opinión;", "elaborar una conclusión."],
                stimulus: {
                  title: "Varios países limitan los móviles en los colegios",
                  body: "Cada vez más gobiernos limitan el uso del teléfono móvil durante la jornada escolar. Sus defensores aseguran que la medida mejora la concentración y la convivencia; sus críticos, en cambio, creen que la escuela debería enseñar a usar la tecnología de forma responsable en lugar de prohibirla. ¿Hasta qué punto es eficaz la prohibición?",
                },
                word_min: 250,
                word_max: 300,
              },
              {
                key: "carta",
                title: "Escribir una carta al director",
                instructions:
                  "Ha leído la siguiente noticia en un periódico de su ciudad y decide escribir una carta al director. En ella deberá:",
                bullets: [
                  "explicar por qué escribe;",
                  "dar su opinión sobre la propuesta;",
                  "presentar argumentos y ejemplos;",
                  "proponer una alternativa o solución.",
                ],
                stimulus: {
                  title: "El Ayuntamiento estudia cerrar la biblioteca del barrio",
                  body: "Debido a los recortes presupuestarios, el Ayuntamiento estudia cerrar la biblioteca del barrio de San Isidro y trasladar sus fondos a la biblioteca central. Según el concejal de Cultura, el número de usuarios ha descendido un 20 % en los últimos años y la mayoría de los vecinos ya consulta la información por internet.",
                },
                word_min: 250,
                word_max: 300,
              },
            ],
          },
          teacher_notes:
            "Opción 1 (expresión): artículo sin saludo ni despedida, con tesis, argumentos y conclusión. Opción 2 (interacción): fórmulas de carta formal, referencia a la noticia y propuesta concreta.",
        },
      ],
    },

    // =====================================================================
    // EXPRESIÓN E INTERACCIÓN ORALES — 5 tareas
    // =====================================================================
    {
      skill: "speaking",
      title: "Expresión e interacción orales",
      instructions:
        "Esta prueba tiene cinco tareas. Sus respuestas se graban y las evaluará su profesora. La grabación empieza automáticamente cuando termina el tiempo de preparación; si termina antes, pulse «Terminar la grabación». El tema que elija en la Tarea 4 se mantiene en la Tarea 5.",
      // Límite técnico de seguridad: suma de los tiempos máximos de cada paso (ver Fuentes y metodología)
      time_limit_seconds: 1500,
      allow_back: false,
      pause_after_seconds: 0,
      tasks: [
        {
          code: "EIO-T1",
          title: "Tarea 1",
          type: "speaking",
          level_label: "A1–A2",
          instructions: "Conteste a cuatro preguntas de carácter personal.",
          declared_items: 0,
          max_audio_plays: 2,
          transcript_from: ["eio-t1-q1.mp3", "eio-t1-q2.mp3", "eio-t1-q3.mp3", "eio-t1-q4.mp3"],
          content: {
            media: {
              q1: { file: "eio-t1-q1.mp3", kind: "audio" },
              q2: { file: "eio-t1-q2.mp3", kind: "audio" },
              q3: { file: "eio-t1-q3.mp3", kind: "audio" },
              q4: { file: "eio-t1-q4.mp3", kind: "audio" },
            },
            parts: [
              {
                key: "p1",
                instructions:
                  "Las preguntas empiezan automáticamente. Puede escuchar cada pregunta dos veces. La grabación empieza sola a los 10 segundos, o antes si pulsa «Grabar».\n\n• Preguntas 1 y 2: 15 segundos para responder.\n• Preguntas 3 y 4: 30 segundos para responder.",
                segments: [
                  { key: "q1", prompt_audio_key: "q1", wait_seconds: 10, record_seconds: 15 },
                  { key: "q2", prompt_audio_key: "q2", wait_seconds: 10, record_seconds: 15 },
                  { key: "q3", prompt_audio_key: "q3", wait_seconds: 10, record_seconds: 30 },
                  { key: "q4", prompt_audio_key: "q4", wait_seconds: 10, record_seconds: 30 },
                ],
              },
            ],
          },
        },
        {
          code: "EIO-T2",
          title: "Tarea 2",
          type: "speaking",
          level_label: "A2",
          instructions: "Describa una fotografía.",
          declared_items: 0,
          content: {
            media: {
              foto_mercado: { file: "eio-t2-mercado.png", kind: "image", alt: "Ilustración de un mercado al aire libre" },
              foto_parque: { file: "eio-t2-parque.png", kind: "image", alt: "Ilustración de una familia en un parque" },
            },
            parts: [
              {
                key: "p1",
                instructions: "Elija una de las dos fotografías. Después tendrá 30 segundos para leer las instrucciones y 2 minutos para preparar la descripción. Si lo desea, puede tomar notas.",
                choice: {
                  seconds: 30,
                  options: [
                    {
                      key: "mercado",
                      title: "Opción 1: Un mercado",
                      body: "Describa la fotografía. Estos son los aspectos que tiene que comentar:",
                      bullets: [
                        "quiénes son las personas y qué relación cree que tienen;",
                        "cómo son y qué ropa llevan;",
                        "qué están haciendo y cómo cree que se sienten;",
                        "dónde están y cómo es el lugar;",
                        "qué objetos hay y dónde están.",
                      ],
                      image_key: "foto_mercado",
                    },
                    {
                      key: "parque",
                      title: "Opción 2: Un parque",
                      body: "Describa la fotografía. Estos son los aspectos que tiene que comentar:",
                      bullets: [
                        "quiénes son las personas y qué relación cree que tienen;",
                        "cómo son y qué ropa llevan;",
                        "qué están haciendo y cómo cree que se sienten;",
                        "dónde están y cómo es el lugar;",
                        "qué objetos hay y dónde están.",
                      ],
                      image_key: "foto_parque",
                    },
                  ],
                },
                read_seconds: 30,
                prep_seconds: 120,
                notes: true,
                segments: [{ key: "r", wait_seconds: 0, record_seconds: 120, min_seconds: 60 }],
              },
            ],
          },
        },
        {
          code: "EIO-T3",
          title: "Tarea 3",
          type: "speaking",
          level_label: "B1",
          instructions: "Responda en dos situaciones simuladas.",
          declared_items: 0,
          content: {
            parts: [
              {
                key: "p1",
                title: "Parte primera",
                instructions: "**Parte primera.** Elija una de las siguientes opciones. Después, grabe su respuesta como si hablara con la otra persona.",
                choice: {
                  seconds: 30,
                  options: [
                    {
                      key: "reserva",
                      title: "Cambiar una reserva",
                      body: "Ha reservado una mesa en un restaurante para celebrar un cumpleaños, pero tiene que cambiar el día. Llama al restaurante. Tiene que:",
                      bullets: ["saludar y decir a nombre de quién está la reserva;", "explicar por qué necesita cambiarla;", "proponer otro día y otra hora y preguntar si es posible."],
                    },
                    {
                      key: "vecino",
                      title: "Pedir un favor a un vecino",
                      body: "Se va de viaje una semana y necesita que alguien cuide de sus plantas. Habla con un vecino. Tiene que:",
                      bullets: ["explicar la situación;", "pedirle el favor y explicarle qué tiene que hacer;", "ofrecerle algo a cambio."],
                    },
                  ],
                },
                segments: [{ key: "r", wait_seconds: 60, record_seconds: 90 }],
              },
              {
                key: "p2",
                title: "Parte segunda",
                instructions: "**Parte segunda.** Elija una de las siguientes opciones. Después, grabe su respuesta como si hablara con la otra persona.",
                choice: {
                  seconds: 30,
                  options: [
                    {
                      key: "pedido",
                      title: "Reclamar un pedido",
                      body: "Compró unos zapatos por internet y le han llegado de otra talla. Llama al servicio de atención al cliente. Tiene que:",
                      bullets: ["explicar el problema;", "decir qué solución quiere;", "preguntar cuánto tiempo tardarán en resolverlo."],
                    },
                    {
                      key: "excursion",
                      title: "Invitar a una excursión",
                      body: "Organiza una excursión a la montaña con unos amigos y llama a un compañero de clase para invitarlo. Tiene que:",
                      bullets: ["explicar el plan: lugar, día y hora;", "decir qué hay que llevar;", "intentar convencerlo para que vaya."],
                    },
                  ],
                },
                segments: [{ key: "r", wait_seconds: 60, record_seconds: 90 }],
              },
            ],
          },
        },
        {
          code: "EIO-T4",
          title: "Tarea 4",
          type: "speaking",
          level_label: "B2",
          instructions: "Elija un tema, lea el texto y responda a tres preguntas.",
          declared_items: 0,
          max_audio_plays: 2,
          transcript_from: [
            "eio-t4-ciudades-q1.mp3",
            "eio-t4-ciudades-q2.mp3",
            "eio-t4-ciudades-q3.mp3",
            "eio-t4-trabajo-q1.mp3",
            "eio-t4-trabajo-q2.mp3",
            "eio-t4-trabajo-q3.mp3",
          ],
          content: {
            media: {
              ciudades_q1: { file: "eio-t4-ciudades-q1.mp3", kind: "audio" },
              ciudades_q2: { file: "eio-t4-ciudades-q2.mp3", kind: "audio" },
              ciudades_q3: { file: "eio-t4-ciudades-q3.mp3", kind: "audio" },
              trabajo_q1: { file: "eio-t4-trabajo-q1.mp3", kind: "audio" },
              trabajo_q2: { file: "eio-t4-trabajo-q2.mp3", kind: "audio" },
              trabajo_q3: { file: "eio-t4-trabajo-q3.mp3", kind: "audio" },
            },
            parts: [
              {
                key: "p1",
                instructions:
                  "Elija uno de los siguientes temas para hablar sobre él en las tareas 4 y 5. Después, lea el texto. Las preguntas empiezan automáticamente; tiene hasta 1 minuto para responder a cada una.",
                choice: {
                  seconds: 30,
                  options: [
                    {
                      key: "ciudades",
                      title: "Ciudades sin coches",
                      body: "Cada vez más ciudades europeas y latinoamericanas cierran calles al tráfico para dárselas a peatones y ciclistas. Pontevedra, en España, peatonalizó su centro hace más de veinte años y hoy se cita como ejemplo de menos accidentes, menos ruido y más comercio local. Sin embargo, no todas las experiencias son iguales. En algunos lugares, los vecinos de las afueras se quejan de que les resulta más difícil llegar al centro, y los transportistas aseguran que sus costes han aumentado.",
                      segments: [
                        { key: "q1", prompt_audio_key: "ciudades_q1", wait_seconds: 15, record_seconds: 60 },
                        { key: "q2", prompt_audio_key: "ciudades_q2", wait_seconds: 15, record_seconds: 60 },
                        { key: "q3", prompt_audio_key: "ciudades_q3", wait_seconds: 15, record_seconds: 60 },
                      ],
                    },
                    {
                      key: "trabajo",
                      title: "La semana laboral de cuatro días",
                      body: "Varias empresas de distintos países han probado a reducir la jornada a cuatro días sin rebajar los salarios. Según los primeros estudios, muchos trabajadores dicen sentirse menos estresados y más motivados, y algunas compañías aseguran que la productividad se ha mantenido o incluso ha aumentado. Otros expertos, en cambio, advierten de que el modelo no se puede aplicar igual en todos los sectores: un hospital, una escuela o un supermercado necesitan personal todos los días de la semana.",
                      segments: [
                        { key: "q1", prompt_audio_key: "trabajo_q1", wait_seconds: 15, record_seconds: 60 },
                        { key: "q2", prompt_audio_key: "trabajo_q2", wait_seconds: 15, record_seconds: 60 },
                        { key: "q3", prompt_audio_key: "trabajo_q3", wait_seconds: 15, record_seconds: 60 },
                      ],
                    },
                  ],
                },
                read_seconds: 35,
              },
            ],
          },
        },
        {
          code: "EIO-T5",
          title: "Tarea 5",
          type: "speaking",
          level_label: "C1",
          instructions: "Argumente a favor o en contra de una afirmación.",
          declared_items: 0,
          content: {
            parts: [
              {
                key: "p1",
                instructions:
                  "Seleccione una de las dos opciones. Después, tiene 2 minutos para preparar una argumentación a favor o en contra de la opción elegida. Si lo desea, puede tomar notas. Después, grabe su respuesta: tiene hasta 4 minutos.",
                choice: {
                  seconds: 30,
                  linked: { task_position: 4, part_key: "p1" },
                  options: [
                    { key: "c1", linked_option: "ciudades", title: "Opción 1", body: "«Las ciudades deberían prohibir la entrada de coches particulares en su centro histórico.»" },
                    { key: "c2", linked_option: "ciudades", title: "Opción 2", body: "«El transporte público debería ser gratuito para todos los ciudadanos.»" },
                    { key: "t1", linked_option: "trabajo", title: "Opción 1", body: "«La semana laboral de cuatro días debería ser obligatoria por ley.»" },
                    { key: "t2", linked_option: "trabajo", title: "Opción 2", body: "«Trabajar desde casa es mejor para los trabajadores que ir a la oficina.»" },
                  ],
                },
                prep_seconds: 120,
                notes: true,
                segments: [{ key: "r", wait_seconds: 0, record_seconds: 240, min_seconds: 180 }],
              },
            ],
          },
        },
      ],
    },
  ],
};
