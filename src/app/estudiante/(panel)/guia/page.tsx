import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { loadReferenceTable } from "@/lib/data/student";
import { LEVEL_GUIDE, SKILL_META, TARGET_LEVELS } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Guía del examen" };

const TESTS = [
  {
    skill: "reading" as const,
    format: "5 tareas · 38 preguntas · 60 minutos",
    what: "Textos cada vez más difíciles: de avisos sencillos (A1) a textos con huecos de nivel B2 y C1.",
    tips: [
      "Los errores no restan: no deje ninguna pregunta en blanco.",
      "Deje más tiempo para las últimas tareas, que son las más difíciles.",
      "Lea primero las preguntas y busque en el texto solo lo que necesita.",
    ],
    modules: [
      { key: "leer-b1-barrio", label: "Leer un texto (B1)" },
      { key: "leer-b2-teletrabajo", label: "Leer un texto (B2)" },
      { key: "leer-c1-memoria", label: "Leer un texto (C1)" },
      { key: "cloze-gramatical", label: "Textos con huecos" },
      { key: "gestion-tiempo", label: "Gestión del tiempo" },
    ],
  },
  {
    skill: "listening" as const,
    format: "6 tareas · 38 preguntas · 55 minutos",
    what: "Conversaciones, anuncios, entrevistas y conferencias. Cada audio se escucha dos veces y hay tiempo para leer antes.",
    tips: [
      "Use el tiempo previo para leer las preguntas y saber qué tiene que escuchar.",
      "En la primera escucha responda lo que tenga claro; en la segunda, compruebe.",
      "Desconfíe de las opciones que repiten palabras exactas del audio.",
    ],
    modules: [
      { key: "escuchar-a2-recado", label: "Escuchar un mensaje (A2)" },
      { key: "escuchar-b1-radio", label: "Escuchar una entrevista (B1)" },
      { key: "escuchar-c1-conferencia", label: "Escuchar una conferencia (C1)" },
      { key: "escucha-estrategias", label: "Aprovechar las dos escuchas" },
      { key: "falsos-amigos", label: "Falsos amigos con el portugués" },
    ],
  },
  {
    skill: "writing" as const,
    format: "2 tareas · 50 minutos",
    what: "Tarea 1: responder a un mensaje (100–150 palabras). Tarea 2: un texto argumentativo (250–300 palabras).",
    tips: [
      "Cumplir lo que pide el enunciado vale un 34 % de la nota de cada tarea: no se deje ningún punto.",
      "Dedique unos minutos a planificar y otros a revisar.",
      "La Tarea 2 necesita bastante más tiempo que la Tarea 1.",
    ],
    modules: [
      { key: "cumplir-enunciado", label: "Cumplir el enunciado" },
      { key: "organizacion", label: "Organizar en párrafos" },
      { key: "conectores", label: "Conectores" },
    ],
  },
  {
    skill: "speaking" as const,
    format: "5 tareas grabadas · unos 15 minutos",
    what: "Preguntas personales, describir una foto, dos situaciones, preguntas sobre un tema y una argumentación.",
    tips: [
      "Conteste con frases completas y añada siempre una razón o un ejemplo.",
      "Si le falta una palabra, explíquela con otras: no cambie al portugués ni se quede en silencio.",
      "Compruebe el micrófono antes de empezar.",
    ],
    modules: [
      { key: "presentarse-oral", label: "Preguntas personales" },
      { key: "describir-imagen", label: "Describir una imagen" },
      { key: "situaciones-oral", label: "Resolver una situación" },
      { key: "tema-oral", label: "Hablar de un tema" },
      { key: "argumentar-oral", label: "Argumentar" },
    ],
  },
];

export default async function GuidePage() {
  const profile = await requireRole("student");
  const reference = await loadReferenceTable();
  const hasReference = Object.keys(reference).length > 0;
  return (
    <>
      <PageHeader
        title="Guía del examen"
        description="Cómo es el SIELE Global, qué se pide para cada nivel y cómo preparar cada prueba."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader title="El examen en un minuto" />
          <CardBody className="space-y-2 text-ink-2">
            <p>
              El SIELE Global tiene <strong className="text-ink">cuatro pruebas</strong>: lectura, audición, escritura y expresión oral. Cada una se puntúa de 0 a 250, y el total va de 0 a 1000.
            </p>
            <p>El orden habitual incluye un descanso de 15 minutos entre la audición y la escritura. El certificado tiene una validez de cinco años.</p>
            <p className="text-sm text-ink-3">
              SIELE Trainer Pro no pertenece a SIELE y sus resultados son estimaciones de preparación. Antes de inscribirse, confirme los datos actuales en{" "}
              <a href="https://siele.org/examen" target="_blank" rel="noreferrer" className="underline">
                siele.org
              </a>
              .
            </p>
          </CardBody>
        </Card>

        <Card id="niveles" className="scroll-mt-20">
          <CardHeader title="Qué significa cada nivel y qué hace falta" description="Lo que se espera de usted y los resultados de referencia en cada prueba." />
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <Th>Nivel</Th>
                  <Th>Qué puede hacer</Th>
                  {hasReference ? (
                    <>
                      <Th>{SKILL_META.reading.short}</Th>
                      <Th>{SKILL_META.listening.short}</Th>
                      <Th>{SKILL_META.writing.short}</Th>
                      <Th>{SKILL_META.speaking.short}</Th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {TARGET_LEVELS.map((l) => (
                  <tr key={l} className={cn(profile.targetLevel === l && "bg-brand-soft")}>
                    <Td className="font-semibold whitespace-nowrap">
                      {l}
                      {profile.targetLevel === l ? <span className="block text-xs font-normal text-brand">Su objetivo</span> : null}
                    </Td>
                    <Td className="min-w-52 text-ink-2">{LEVEL_GUIDE[l].canDo}</Td>
                    {hasReference
                      ? (["reading", "listening", "writing", "speaking"] as const).map((skill) => {
                          const entry = reference[skill];
                          const min = entry?.bands.find((b) => b.level === l)?.min;
                          return (
                            <Td key={skill} className="whitespace-nowrap tabular-nums">
                              {min != null && entry ? (
                                <>
                                  {min}
                                  <span className="text-xs text-ink-3">
                                    {" "}
                                    / {entry.max} {entry.unit}
                                  </span>
                                </>
                              ) : (
                                "—"
                              )}
                            </Td>
                          );
                        })
                      : null}
                  </tr>
                ))}
              </tbody>
            </Table>
            {hasReference ? (
              <Alert tone="warn" title="Una referencia, no una garantía" className="mt-4">
                Los umbrales proceden de la Guía oficial para preparadores de 2016, que es la última tabla pública que hemos podido verificar. Pueden haber cambiado: úselos para orientarse, no como nota de corte oficial.
              </Alert>
            ) : null}
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {TESTS.map((t) => (
            <Card key={t.skill} className="overflow-hidden">
              <div className={`h-1.5 stripe-${SKILL_META[t.skill].tone}`} />
              <CardHeader title={SKILL_META[t.skill].label} description={t.format} />
              <CardBody className="space-y-3">
                <p className="text-ink-2">{t.what}</p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {t.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3 text-sm">
                  {t.modules.map((m) => (
                    <Link key={m.key} href={`/estudiante/refuerzo/${m.key}`} className="text-brand underline">
                      {m.label}
                    </Link>
                  ))}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        <p className="text-sm text-ink-3">
          Los consejos sobre la puntuación, las reproducciones, la extensión y los tipos de tarea proceden de la Guía oficial para preparadores de 2016 y pueden haber cambiado.
        </p>

        <Card>
          <CardHeader title="Cómo sacarle partido a esta plataforma" />
          <CardBody>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Elija el nivel que necesita y haga la{" "}
                <Link href="/estudiante/prueba-de-nivel" className="text-brand underline">
                  prueba de nivel
                </Link>
                .
              </li>
              <li>
                Cree su{" "}
                <Link href="/estudiante/plan" className="text-brand underline">
                  plan
                </Link>{" "}
                y siga cada día lo que le proponga el inicio.
              </li>
              <li>Cuando se sienta preparado, haga un simulacro en un lugar tranquilo: es lo que mejor mide cómo va.</li>
              <li>Lea las correcciones de su profesora: el inicio le propondrá actualizar su plan para que los errores que se repiten pasen a ser sus prioridades.</li>
              <li>Si su profesora le da otro intento, repita el simulacro antes del examen y compare los resultados.</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
