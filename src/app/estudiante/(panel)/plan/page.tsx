import type { Metadata } from "next";
import { PlanView, type PlanItemView } from "@/components/plan-view";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { loadStudentOverview } from "@/lib/data/student";
import { formatDate } from "@/lib/utils";
import { PlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Plan de estudio" };

export default async function PlanPage() {
  const profile = await requireRole("student");
  const { plan } = await loadStudentOverview(profile.id);
  return (
    <>
      <PageHeader
        title="Plan de estudio"
        description="Un plan semanal que alterna comprensión, escritura, oral, vocabulario, gramática y práctica cronometrada según su diagnóstico. No garantiza una nota concreta: sirve para trabajar de forma constante lo que más lo necesita."
      />
      {plan ? (
        <Card className="mb-6">
          <CardHeader
            title={plan.title}
            description={`${plan.minutes_per_day} minutos al día · ${plan.weeks} semanas · desde el ${formatDate(plan.starts_on)}${
              plan.target_level ? ` · objetivo ${plan.target_level}` : ""
            }${plan.target_date ? ` para el ${formatDate(plan.target_date)}` : ""}`}
          />
          <CardBody>
            {plan.teacher_note ? (
              <Alert tone="info" title="Nota de su profesora" className="mb-4">
                {plan.teacher_note}
              </Alert>
            ) : null}
            <PlanView items={(plan.study_plan_items ?? []) as PlanItemView[]} moduleBase="/estudiante/refuerzo" editable />
          </CardBody>
        </Card>
      ) : null}
      <Card>
        <CardHeader title={plan ? "Crear un plan nuevo" : "Crear mi plan"} description="El plan actual (si lo creó usted) se archivará." />
        <CardBody>
          <PlanForm defaultLevel={profile.targetLevel ?? ""} defaultDate={profile.targetDate ?? ""} />
        </CardBody>
      </Card>
    </>
  );
}
