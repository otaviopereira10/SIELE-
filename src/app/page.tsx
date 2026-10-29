import Link from "next/link";
import { ArrowRight, AudioLines, BrainCircuit, ClipboardCheck, Headphones, LineChart, PenLine, ShieldCheck } from "lucide-react";
import { IndependenceNotice, Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui/button";

const SKILLS = [
  { icon: ClipboardCheck, title: "Comprensión de lectura", meta: "5 tareas · 38 ítems · 60 min", tone: "bg-gold-soft text-gold" },
  { icon: Headphones, title: "Comprensión auditiva", meta: "6 tareas · 38 ítems · 55 min", tone: "bg-gold-soft text-gold" },
  { icon: PenLine, title: "Expresión e interacción escritas", meta: "2 tareas · 50 min", tone: "bg-blue-soft text-blue" },
  { icon: AudioLines, title: "Expresión e interacción orales", meta: "5 tareas grabadas", tone: "bg-orange-soft text-orange" },
];

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "Diagnóstico que dice qué estudiar",
    body: "La profesora marca evidencias reales en el texto o en la grabación; la plataforma agrupa los errores que se repiten y propone tres prioridades con micro-lecciones y un indicador para comprobar el progreso.",
  },
  {
    icon: ClipboardCheck,
    title: "Evaluación docente fundamentada",
    body: "Rúbricas de 0 a 5 con descriptores, ponderaciones documentadas, borradores, historial de cambios y publicación controlada. La nota nunca la decide una caja negra.",
  },
  {
    icon: ShieldCheck,
    title: "Seguridad real",
    body: "Permisos en la base de datos (RLS), claves de corrección que nunca llegan al navegador, temporizadores en el servidor y grabaciones privadas con URL firmadas.",
  },
  {
    icon: LineChart,
    title: "Evolución medible",
    body: "Comparación entre intentos, resultados por tarea y por nivel, y planes semanales de 15, 30 o 60 minutos al día que alternan las cuatro destrezas.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <ButtonLink href="/demo" variant="ghost">
            Probar la demostración
          </ButtonLink>
          <ButtonLink href="/acceso">Acceder</ButtonLink>
        </nav>
      </header>

      <main id="contenido">
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-8 pb-16 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-2">
              Simulacros · evaluación docente · plan personalizado
            </p>
            <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight text-ink sm:text-5xl">
              Preparar el SIELE Global con datos, criterio y un plan que se entiende.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Plataforma independiente de simulacros, evaluación y preparación personalizada del español. Practique las cuatro pruebas con la estructura
              pública del examen y reciba la corrección de su profesora con ejemplos de su propio texto.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/acceso" size="lg">
                Entrar en la plataforma <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/registro" size="lg" variant="secondary">
                Tengo un código de invitación
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-ink-3">El acceso es solo por invitación de su centro o de su profesora.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl shadow-ink/5" aria-hidden>
            <div className="bg-exam-header px-5 py-3 text-white">Comprensión de lectura</div>
            <div className="stripe-comprehension h-2" />
            <div className="space-y-4 p-5">
              <div className="flex items-center justify-between">
                <div className="inline-flex border border-ink/80 text-sm">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n === 2 ? "bg-gold px-2.5 py-1.5 text-white" : "border-l border-ink/80 px-2.5 py-1.5 first:border-l-0"}>
                      Tarea {n}
                    </span>
                  ))}
                </div>
                <span className="rounded-md border-2 border-accent/70 px-2 py-1 text-sm font-semibold tabular-nums">00:52:31</span>
              </div>
              <div className="reading-text rounded-lg bg-surface-2 p-4 text-[0.95rem]">
                <p className="mb-1 text-center text-xs font-semibold tracking-wide uppercase">Mi huerto en la azotea</p>
                Hace dos años, cuando me jubilé, tenía mucho tiempo libre y no sabía qué hacer con él…
              </div>
              <div className="rounded-md bg-surface-3 px-3 py-2 text-sm">
                <strong>1.</strong> Carmen tuvo la idea del huerto…
              </div>
              <div className="space-y-1.5 text-sm">
                <p className="rounded-md border border-ink bg-surface px-3 py-2">◉ cuando estaba en la azotea.</p>
                <p className="px-3 py-2">○ porque se lo pidió un vecino.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {SKILLS.map((s) => (
              <div key={s.title} className="flex items-start gap-3">
                <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-ink-3">{s.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Más que una nota: respuestas a «¿qué debo estudiar ahora?»</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="rounded-xl border border-line bg-surface p-6">
                <f.icon className="size-6 text-accent" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-ink-2">{f.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-2xl bg-brand px-6 py-8 text-white sm:px-10">
            <h2 className="text-xl font-semibold">Pruebe la experiencia sin crear una cuenta</h2>
            <p className="mt-2 max-w-2xl text-white/80">
              La demostración recorre una tarea de cada prueba (lectura, audición, escritura y grabación oral). No se guarda nada.
            </p>
            <Link href="/demo" className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 font-medium text-brand">
              Abrir la demostración <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 sm:px-6">
          <IndependenceNotice />
          <p className="text-xs text-ink-3">
            Las especificaciones de formato proceden de fuentes públicas (siele.org y la Guía oficial para preparadores, edición 2016) y se documentan en
            el panel «Fuentes, versión y metodología».
          </p>
        </div>
      </footer>
    </div>
  );
}
