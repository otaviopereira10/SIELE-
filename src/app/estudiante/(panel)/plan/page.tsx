import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PlanView, type PlanItemView } from "@/components/plan-view";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { loadStudentOverview } from "@/lib/data/student";
import { formatDate, todayISO } from "@/lib/utils";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plan de estudio" };

export default async function PlanPage() {
  const profile = await requireRole("student");
  const { plan, resultRows } = await loadStudentOverview(profile.id);
  const today = todayISO(requestTime());
  const ownPlan = plan?.created_by === profile.id;
  const newestResult = resultRows.at(-1)?.published_at;
  const outdated = Boolean(plan && ownPlan && ((plan.target_level && profile.targetLevel && plan.target_level !== profile.targetLevel) || (newestResult && newestResult > plan.created_at)));
  const form = <PlanForm defaultLevel={profile.targetLevel ?? ""} defaultDate={profile.targetDate && profile.targetDate > today ? profile.targetDate : ""} today={today} submitLabel={plan ? "Sustituir mi plan" : "Crear mi plan"} />;
  return (
    <>
      <PageHeader
        title="Plan de estudio"
        description="Qué hacer cada día para acercarse a su objetivo. Combina las cuatro pruebas, gramática y vocabulario según su nivel y su diagnóstico. Al terminar los ejercicios de una actividad, se marca sola."
      />
      {plan ? (
        <Card className="mb-6">
          <CardHeader
            title={plan.title}
            description={`${plan.minutes_per_day} minutos al día · ${plan.weeks} ${plan.weeks === 1 ? "semana" : "semanas"} · desde el ${formatDate(plan.starts_on)}${
              plan.target_date ? ` · examen el ${formatDate(plan.target_date)}` : ""
            }`}
          />
          <CardBody>
            {plan.teacher_note ? (
              <Alert tone="info" title="Nota de su profesora" className="mb-4">
                {plan.teacher_note}
              </Alert>
            ) : null}
            <PlanView items={(plan.study_plan_items ?? []) as PlanItemView[]} startsOn={plan.starts_on} weeks={plan.weeks} today={today} moduleBase="/estudiante/refuerzo" editable />
          </CardBody>
        </Card>
      ) : null}
      {plan ? (
        <details open={outdated} className="group rounded-xl border border-line bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
            {outdated ? "Actualice su plan con su objetivo y sus últimos resultados" : "¿Han cambiado su tiempo, su fecha o sus resultados? Cree un plan nuevo"}
            <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="border-t border-line px-5 py-5">
            <p className="mb-4 text-sm text-ink-2">
              {ownPlan
                ? "El plan actual se sustituirá. Lo que ya ha practicado se tiene en cuenta: lo que domina se deja para el final, salvo lo que marque su diagnóstico."
                : "Este plan y su nota son de su profesora: si crea uno propio, dejará de verlos aquí. Es mejor que lo hable antes con ella."}
            </p>
            {form}
          </div>
        </details>
      ) : (
        <Card>
          <CardHeader title="Crear mi plan" description="Tarda menos de un minuto. Podrá cambiarlo cuando quiera." />
          <CardBody>{form}</CardBody>
        </Card>
      )}
    </>
  );
}
