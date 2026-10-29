import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { SkillProfile } from "@/components/results/skill-profile";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { ATTEMPT_STATUS, loadStudentOverview } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { getModule } from "@/content/refuerzo";
import { requestTime } from "@/lib/clock";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StartAttemptButton } from "./start-button";

export const metadata: Metadata = { title: "Panel del estudiante" };

export default async function StudentHome() {
  const profile = await requireRole("student");
  const data = await loadStudentOverview(profile.id);
  const diagnosis = buildDiagnosis(data.reports.filter((r) => r.scope === "full" || r.sections.some((s) => s.objective)));
  const now = requestTime();

  const byAssignment = new Map<string, typeof data.attempts>();
  for (const a of data.attempts) byAssignment.set(a.assignment_id, [...(byAssignment.get(a.assignment_id) ?? []), a]);

  const today = (() => {
    if (!data.plan) return [];
    const start = new Date(data.plan.starts_on).getTime();
    const dayIndex = Math.max(0, Math.floor((now - start) / 86_400_000));
    const week = Math.floor(dayIndex / 7) + 1;
    const day = (dayIndex % 7) + 1;
    return (data.plan.study_plan_items ?? []).filter((i) => i.week_no === week && i.day_no === day);
  })();

  const pending = data.attempts.filter((a) => a.status === "submitted").length;
  const inProgress = data.attempts.filter((a) => a.status === "in_progress");

  return (
    <>
      <PageHeader
        eyebrow={`Hola, ${profile.fullName.split(" ")[0] || "estudiante"}`}
        title="Su preparación"
        description={
          profile.targetLevel
            ? `Objetivo: nivel ${profile.targetLevel}${profile.targetDate ? ` para el ${formatDate(profile.targetDate)}` : ""}. Ninguna plataforma garantiza una nota; aquí verá qué trabajar para acercarse a ella.`
            : "Defina su nivel objetivo en el perfil para ver el progreso hacia él."
        }
      />

      {data.attempts.some((a) => a.status === "resubmission_requested") ? (
        <Card className="mb-6 border-danger/30 bg-danger-soft px-5 py-4">
          <p className="font-semibold text-danger">Su profesora le pide una nueva entrega</p>
          <p className="mt-1 text-sm text-ink-2">Abra el intento para leer el motivo y enviar la nueva versión.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.attempts
              .filter((a) => a.status === "resubmission_requested")
              .map((a) => (
                <ButtonLink key={a.id} href={`/estudiante/intentos/${a.id}`} size="sm" variant="danger">
                  Abrir la tarea
                </ButtonLink>
              ))}
          </div>
        </Card>
      ) : null}

      <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Simulacros disponibles" description="Asignados por su profesora o por el centro." />
          <CardBody className="space-y-3">
            {data.assignments.length === 0 ? (
              <EmptyState title="Todavía no tiene simulacros asignados">Cuando su profesora le asigne uno, aparecerá aquí.</EmptyState>
            ) : (
              data.assignments.map((a) => {
                const attempts = byAssignment.get(a.id) ?? [];
                const active = attempts.find((x) => x.status === "in_progress");
                const used = attempts.filter((x) => x.status !== "annulled").length;
                const notOpen = new Date(a.opens_at).getTime() > now;
                const closed = a.closes_at && new Date(a.closes_at).getTime() < now;
                const canStart = !notOpen && !closed && (active || used < a.max_attempts);
                return (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-2 text-xs text-ink-3">
                        <Badge tone={a.mode === "formal" ? "danger" : "brand"}>{a.mode === "formal" ? "Simulacro formal" : "Práctica"}</Badge>
                        {a.immediate_feedback ? <Badge tone="ok">Corrección inmediata</Badge> : null}
                        <span>
                          Intentos: {used}/{a.max_attempts}
                        </span>
                        {a.closes_at ? <span>Cierra: {formatDateTime(a.closes_at)}</span> : null}
                        {a.class_name ? <span>{a.class_name}</span> : null}
                      </p>
                    </div>
                    {notOpen ? (
                      <Badge>Abre el {formatDateTime(a.opens_at)}</Badge>
                    ) : closed && !active ? (
                      <Badge>Cerrado</Badge>
                    ) : canStart ? (
                      <StartAttemptButton assignmentId={a.id} mode={a.mode} label={active ? "Continuar" : used > 0 ? "Empezar otro intento" : "Empezar"} />
                    ) : (
                      <Badge>Sin intentos disponibles</Badge>
                    )}
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Hoy en su plan"
            action={
              <Link href="/estudiante/plan" className="text-sm text-brand underline">
                Ver plan
              </Link>
            }
          />
          <CardBody>
            {!data.plan ? (
              <EmptyState title="Sin plan activo" action={<ButtonLink href="/estudiante/plan" size="sm">Crear mi plan</ButtonLink>}>
                Genere un plan de 15, 30 o 60 minutos diarios a partir de su diagnóstico.
              </EmptyState>
            ) : today.length === 0 ? (
              <p className="text-sm text-ink-3">Hoy es día de descanso o el plan ha terminado.</p>
            ) : (
              <ul className="space-y-2">
                {today.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 rounded-lg bg-surface-2 px-3 py-2">
                    <CalendarCheck className={`mt-0.5 size-4 shrink-0 ${i.completed_at ? "text-ok" : "text-ink-3"}`} aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className={i.completed_at ? "line-through decoration-ink-3" : "font-medium"}>{i.title}</p>
                      <p className="text-xs text-ink-3">{i.minutes} min</p>
                      {i.module_key && getModule(i.module_key) ? (
                        <Link href={`/estudiante/refuerzo/${i.module_key}`} className="text-xs text-brand underline">
                          Abrir la actividad
                        </Link>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Rendimiento por destreza</h2>
          <Link href="/estudiante/progreso" className="text-sm text-brand underline">
            Diagnóstico completo
          </Link>
        </div>
        <SkillProfile skills={diagnosis.skills} />
        {diagnosis.priorities.length ? (
          <Card className="mt-4">
            <CardHeader title="Recomendaciones prioritarias" />
            <CardBody>
              <ol className="space-y-2">
                {diagnosis.priorities.map((p, i) => (
                  <li key={p.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span>
                      <strong>{i + 1}. {p.title}.</strong> <span className="text-ink-2">{p.why}</span>
                    </span>
                    {p.modules[0] ? (
                      <Link href={`/estudiante/refuerzo/${p.modules[0]}`} className="text-brand underline">
                        Practicar
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="mt-3 rounded-md bg-brand-soft px-3 py-2 text-sm">
                <strong>Objetivo semanal:</strong> {diagnosis.weeklyGoal}
              </p>
            </CardBody>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardHeader
          title="Mis intentos"
          description={`${inProgress.length} en curso · ${pending} pendientes de corrección · ${data.attempts.filter((a) => a.status === "published").length} con resultados`}
        />
        <CardBody>
          {data.attempts.length === 0 ? (
            <p className="text-sm text-ink-3">Todavía no ha realizado ningún simulacro.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.attempts.map((a) => {
                const asg = data.assignments.find((x) => x.id === a.assignment_id);
                const st = ATTEMPT_STATUS[a.status];
                const hasResults = data.resultRows.some((r) => r.attempt_id === a.id);
                return (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium">{asg?.title ?? "Simulacro"}</p>
                      <p className="text-xs text-ink-3">
                        Iniciado {formatDateTime(a.started_at)}
                        {a.submitted_at ? ` · enviado ${formatDateTime(a.submitted_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={st.tone}>{st.label}</Badge>
                      {a.status === "in_progress" || a.status === "resubmission_requested" ? (
                        <ButtonLink href={`/estudiante/intentos/${a.id}`} size="sm" variant="secondary">
                          Abrir
                        </ButtonLink>
                      ) : hasResults ? (
                        <ButtonLink href={`/estudiante/resultados/${a.id}`} size="sm" variant="secondary">
                          Ver informe
                        </ButtonLink>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}
