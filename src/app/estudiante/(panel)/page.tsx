import type { Metadata } from "next";
import Link from "next/link";
import { GapPanel } from "@/components/student/gap-panel";
import { GoalPicker } from "@/components/student/goal-picker";
import { Journey } from "@/components/student/journey";
import { NextStepCard } from "@/components/student/next-step-card";
import { TodayList, type TodayItem } from "@/components/student/today-list";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { ATTEMPT_STATUS, loadReferenceTable, loadStudentOverview } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { latestPlacement } from "@/lib/diagnosis/placement";
import { planContext } from "@/lib/diagnosis/plan-context";
import { skillGaps } from "@/lib/diagnosis/target";
import { LEVEL_LABEL } from "@/lib/exam/skills";
import { daysBetween, firstPending, isControlItem, itemsOn, planPosition, type ScheduledItem } from "@/lib/plan/schedule";
import { journey, nextStep } from "@/lib/student/next-step";
import { formatDate, formatDateTime, todayISO } from "@/lib/utils";
import { StartAttemptButton } from "./start-button";

export const metadata: Metadata = { title: "Inicio" };

export default async function StudentHome() {
  const profile = await requireRole("student");
  const [data, reference] = await Promise.all([loadStudentOverview(profile.id), loadReferenceTable()]);
  const diagnosis = buildDiagnosis(
    data.reports.filter((r) => r.scope === "full" || r.sections.some((s) => s.objective)),
    { targetLevel: profile.targetLevel },
  );
  const now = requestTime();
  const today = todayISO(now);
  const placement = latestPlacement(data.practice);
  const startingLevel = planContext(diagnosis, data.practice).currentLevel;

  const byAssignment = new Map<string, typeof data.attempts>();
  for (const a of data.attempts) byAssignment.set(a.assignment_id, [...(byAssignment.get(a.assignment_id) ?? []), a]);

  const available = data.assignments.map((a) => {
    const attempts = byAssignment.get(a.id) ?? [];
    const active = attempts.find((x) => x.status === "in_progress");
    const used = attempts.filter((x) => x.status !== "annulled").length;
    const notOpen = new Date(a.opens_at).getTime() > now;
    const closed = Boolean(a.closes_at && new Date(a.closes_at).getTime() < now);
    return { ...a, active, used, notOpen, closed, canStart: !notOpen && !closed && Boolean(active || used < a.max_attempts) };
  });
  const startable = available.find((a) => a.canStart && !a.active);

  const planItems = (data.plan?.study_plan_items ?? []) as (TodayItem & ScheduledItem & { activity: string })[];
  const position = data.plan ? planPosition(data.plan.starts_on, today, data.plan.weeks) : null;
  const todayItems = data.plan ? itemsOn(planItems, data.plan.starts_on, today) : [];
  const pending = data.plan ? firstPending(planItems, data.plan.starts_on, today) : null;
  const ownPlan = data.plan?.created_by === profile.id;
  const newestResult = data.resultRows.at(-1)?.published_at;
  const planOutdated =
    ownPlan && data.plan
      ? data.plan.target_level && profile.targetLevel && data.plan.target_level !== profile.targetLevel
        ? { reason: "goal" as const, planLevel: data.plan.target_level }
        : newestResult && newestResult > data.plan.created_at
          ? { reason: "results" as const }
          : null
      : null;

  const gaps = profile.targetLevel ? skillGaps(diagnosis.skills, profile.targetLevel, reference) : [];
  const input = {
    targetLevel: profile.targetLevel,
    resubmissionAttemptId: data.attempts.find((a) => a.status === "resubmission_requested")?.id ?? null,
    inProgressAttemptId: data.attempts.find((a) => a.status === "in_progress")?.id ?? null,
    submittedPending: data.attempts.filter((a) => a.status === "submitted").length,
    hasResults: diagnosis.skills.some((s) => s.latest?.pedagogicalLevel),
    measuredSkills: diagnosis.skills.filter((s) => s.latest?.pedagogicalLevel).length,
    goalReached: gaps.length > 0 && gaps.every((g) => g.status === "reached"),
    hasPlacement: Boolean(placement),
    hasPlan: Boolean(data.plan),
    planFinished: position?.state === "finished",
    planOutdated,
    planItem: pending ? { title: pending.item.title, moduleKey: pending.item.module_key, overdue: pending.overdue, control: isControlItem(pending.item) } : null,
    planDone: data.plan ? { done: planItems.filter((i) => i.completed_at).length, total: planItems.length } : null,
    startableAssignment: startable ? { id: startable.id, mode: startable.mode, label: "Empezar el simulacro" } : null,
  };
  const step = nextStep(input);
  const daysLeft = profile.targetDate ? daysBetween(today, profile.targetDate) : null;

  return (
    <>
      <PageHeader
        eyebrow={`Hola, ${profile.fullName.split(" ")[0] || "estudiante"}`}
        title={profile.targetLevel ? `Hacia el nivel ${profile.targetLevel}` : "Su preparación"}
        description={
          profile.targetLevel ? (
            <>
              {profile.targetDate ? (
                daysLeft != null && daysLeft > 0 ? (
                  <>
                    {daysLeft === 1 ? "Queda" : "Quedan"} <strong className="text-ink">{daysLeft === 1 ? "1 día" : `${daysLeft} días`}</strong> para su examen ({formatDate(profile.targetDate)}).{" "}
                  </>
                ) : (
                  <>Examen: {formatDate(profile.targetDate)}. </>
                )
              ) : null}
              {startingLevel ? <>Punto de partida: {LEVEL_LABEL[startingLevel] ?? startingLevel}. </> : null}
              <Link href="/estudiante/perfil" className="underline">
                Cambiar objetivo
              </Link>
            </>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <NextStepCard step={step}>
          {step.key === "goal" ? <GoalPicker date={profile.targetDate && profile.targetDate > today ? profile.targetDate : null} today={today} /> : null}
          {step.key === "mock" ? <StartAttemptButton assignmentId={step.assignment.id} mode={step.assignment.mode} label={step.assignment.label} /> : null}
          {step.key === "ready" && step.assignment ? <StartAttemptButton assignmentId={step.assignment.id} mode={step.assignment.mode} label={step.assignment.label} /> : null}
          {step.key === "waiting" || step.key === "done" ? (
            <ButtonLink href="/estudiante/refuerzo" variant="secondary">
              Repasar en la biblioteca
            </ButtonLink>
          ) : null}
        </NextStepCard>

        <Journey steps={journey(input)} />

        {profile.targetLevel ? (
          <section aria-labelledby="gap-title">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <h2 id="gap-title" className="text-lg font-semibold">
                Cuánto le falta en cada prueba
              </h2>
              <Link href="/estudiante/progreso" className="text-sm text-brand underline">
                Ver mi progreso
              </Link>
            </div>
            <GapPanel gaps={gaps} target={profile.targetLevel} />
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Card>
            <CardHeader
              title="Hoy en su plan"
              action={
                data.plan ? (
                  <Link href="/estudiante/plan" className="text-sm text-brand underline">
                    Ver el plan
                  </Link>
                ) : null
              }
            />
            <CardBody>
              {!data.plan ? (
                <p className="text-sm text-ink-2">
                  Todavía no tiene un plan.{" "}
                  <Link href="/estudiante/plan" className="text-brand underline">
                    Crear mi plan
                  </Link>
                </p>
              ) : position?.state === "finished" ? (
                <p className="text-sm text-ink-2">
                  Su plan ha terminado.{" "}
                  <Link href="/estudiante/plan" className="text-brand underline">
                    Crear uno nuevo
                  </Link>
                </p>
              ) : position?.rest ? (
                <p className="text-sm text-ink-2">Hoy es día de descanso: también forma parte del plan.</p>
              ) : todayItems.length === 0 ? (
                <p className="text-sm text-ink-2">Hoy no tiene actividades.</p>
              ) : (
                <TodayList items={todayItems} />
              )}
            </CardBody>
          </Card>

          <Card id="simulacros" className="scroll-mt-20">
            <CardHeader title="Simulacros" description="Simulacros cronometrados que le asigna su profesora. Ella corrige las pruebas escritas y orales." />
            <CardBody className="space-y-3">
              {available.length === 0 ? (
                <EmptyState title="Todavía no tiene simulacros">Cuando su profesora le asigne uno, aparecerá aquí. Mientras tanto, puede avanzar con su plan.</EmptyState>
              ) : (
                available.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{a.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                        <Badge tone={a.mode === "formal" ? "danger" : "brand"}>{a.mode === "formal" ? "Como el examen real" : "Práctica"}</Badge>
                        {a.immediate_feedback ? <Badge tone="ok">Corrección inmediata</Badge> : null}
                        <span>
                          {a.used} de {a.max_attempts} {a.max_attempts === 1 ? "intento usado" : "intentos usados"}
                        </span>
                        {a.closes_at ? <span>Hasta el {formatDateTime(a.closes_at)}</span> : null}
                      </p>
                    </div>
                    {a.notOpen ? (
                      <Badge>Abre el {formatDateTime(a.opens_at)}</Badge>
                    ) : a.closed && !a.active ? (
                      <Badge>Cerrado</Badge>
                    ) : a.canStart ? (
                      <StartAttemptButton assignmentId={a.id} mode={a.mode} label={a.active ? "Continuar" : a.used > 0 ? "Empezar otro intento" : "Empezar"} />
                    ) : (
                      <span className="text-sm text-ink-2">Sin intentos disponibles: pídale otro a su profesora.</span>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </section>

        {data.attempts.length ? (
          <Card>
            <CardHeader title="Mis simulacros" />
            <CardBody>
              <ul className="divide-y divide-line">
                {data.attempts.map((a) => {
                  const st = ATTEMPT_STATUS[a.status];
                  const result = data.resultRows.find((r) => r.attempt_id === a.id);
                  const title = data.assignments.find((x) => x.id === a.assignment_id)?.title ?? result?.report.attempt.assignment_title ?? "Simulacro";
                  return (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-medium">{title}</p>
                        <p className="text-xs text-ink-3">
                          Empezado el {formatDateTime(a.started_at)}
                          {a.submitted_at ? ` · enviado el ${formatDateTime(a.submitted_at)}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {a.status === "in_progress" || a.status === "resubmission_requested" ? (
                          <ButtonLink href={`/estudiante/intentos/${a.id}`} size="sm" variant="secondary">
                            Abrir
                          </ButtonLink>
                        ) : result && a.status !== "annulled" ? (
                          <ButtonLink href={`/estudiante/resultados/${a.id}`} size="sm" variant="secondary">
                            Ver resultados
                          </ButtonLink>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
