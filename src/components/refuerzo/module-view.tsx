import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import type { RefuerzoModule } from "@/content/refuerzo";

/** Explicación, ejemplos y pasos de un módulo de refuerzo. */
export function ModuleLesson({ module: m }: { module: RefuerzoModule }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Explicación" description={`${m.level} · ${m.minutes} minutos`} />
        <CardBody className="space-y-2">
          {m.explanation.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </CardBody>
      </Card>
      {m.steps?.length ? (
        <Card>
          <CardHeader title="Paso a paso" />
          <CardBody>
            <ol className="list-decimal space-y-1 pl-5">
              {m.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title="Ejemplos" />
        <CardBody className="space-y-3">
          {m.examples.map((e, i) => (
            <div key={i} className="rounded-lg bg-surface-2 px-4 py-3 text-sm">
              {e.wrong ? (
                <p>
                  <Badge tone="danger">Evite</Badge> <span className="line-through decoration-danger/60">{e.wrong}</span>
                </p>
              ) : null}
              <p className={e.wrong ? "mt-1" : ""}>
                <Badge tone="ok">Mejor</Badge> {e.right}
              </p>
              <p className="mt-1 text-ink-3">{e.note}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
