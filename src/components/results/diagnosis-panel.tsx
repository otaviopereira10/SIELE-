import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import type { Diagnosis } from "@/lib/diagnosis/engine";
import { getModule } from "@/content/refuerzo";
import { formatNumber } from "@/lib/utils";
import { SkillProfile } from "./skill-profile";

/** Diagnóstico completo: perfil por destreza, fortalezas, prioridades, errores recurrentes y evidencias. */
export function DiagnosisPanel({ diagnosis, moduleBase = "/estudiante/refuerzo" }: { diagnosis: Diagnosis; moduleBase?: string }) {
  if (diagnosis.generatedFrom === 0) {
    return <EmptyState title="Todavía no hay resultados publicados">El diagnóstico aparecerá cuando se publique el primer simulacro.</EmptyState>;
  }
  return (
    <div className="space-y-6">
      <SkillProfile skills={diagnosis.skills} />
      {diagnosis.globalRange ? (
        <Card className="px-5 py-4">
          <p className="text-sm text-ink-2">
            Suma de los intervalos de referencia de las cuatro pruebas (estimación, no nota oficial):{" "}
            <strong>
              {formatNumber(diagnosis.globalRange.min, 0)}–{formatNumber(diagnosis.globalRange.max, 0)} / 1000
            </strong>
          </p>
        </Card>
      ) : (
        <p className="text-xs text-ink-3">
          No se muestra una puntuación global: solo se suman las cuatro pruebas cuando todas tienen una conversión pública aplicable. Se presenta un perfil
          separado por destreza.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tres prioridades de mejora" />
          <CardBody className="space-y-4">
            {diagnosis.priorities.length === 0 ? (
              <p className="text-sm text-ink-3">No se han detectado áreas débiles con los datos disponibles.</p>
            ) : (
              diagnosis.priorities.map((p, i) => (
                <div key={p.key} className="rounded-lg border border-line p-4">
                  <p className="text-xs text-ink-3">Prioridad {i + 1}</p>
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{p.why}</p>
                  {p.evidence.length ? (
                    <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                      {p.evidence.map((e, j) => (
                        <li key={j}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 text-sm">
                    <span className="font-medium">Indicador de progreso:</span> {p.indicator}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {p.modules.map((m) =>
                      getModule(m) ? (
                        <Link key={m} href={`${moduleBase}/${m}`} className="text-sm font-medium text-brand underline">
                          {getModule(m)!.title}
                        </Link>
                      ) : null,
                    )}
                  </div>
                </div>
              ))
            )}
            <p className="rounded-md bg-brand-soft px-3 py-2 text-sm">
              <strong>Objetivo semanal:</strong> {diagnosis.weeklyGoal}
            </p>
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Fortalezas observadas" />
            <CardBody>
              {diagnosis.strengths.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {diagnosis.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Aún no hay suficientes datos.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Errores recurrentes" description="Señalados por la profesora en sus textos y grabaciones." />
            <CardBody className="space-y-3">
              {diagnosis.recurringErrors.length === 0 ? (
                <p className="text-sm text-ink-3">Sin errores registrados.</p>
              ) : (
                diagnosis.recurringErrors.map((e) => (
                  <div key={e.category} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {e.label}
                      <Badge tone={e.systematic ? "danger" : "warn"}>
                        {e.count} {e.count === 1 ? "vez" : "veces"}
                        {e.attempts > 1 ? ` en ${e.attempts} simulacros` : ""}
                      </Badge>
                    </p>
                    {e.examples.map((x, i) => (
                      <p key={i} className="mt-1 text-ink-2">
                        «{x.quote}»{x.correction ? <> → «{x.correction}»</> : null}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
