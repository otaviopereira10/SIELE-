import type { Metadata } from "next";
import Link from "next/link";
import { DiagnosisPanel } from "@/components/results/diagnosis-panel";
import { GapPanel } from "@/components/student/gap-panel";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { loadReferenceTable, loadStudentOverview } from "@/lib/data/student";
import { MODULES } from "@/content/refuerzo";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { latestPlacement } from "@/lib/diagnosis/placement";
import { bestByModule, moduleStatus } from "@/lib/exam/drill";
import { skillGaps } from "@/lib/diagnosis/target";
import { LEVEL_LABEL, SKILL_META } from "@/lib/exam/skills";
import { objectivePercent } from "@/lib/results/report";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi progreso" };

export default async function ProgressPage() {
  const profile = await requireRole("student");
  const [data, reference] = await Promise.all([loadStudentOverview(profile.id), loadReferenceTable()]);
  const diagnosis = buildDiagnosis(data.reports, { targetLevel: profile.targetLevel });
  const best = bestByModule(data.practice);
  const practiced = MODULES.filter((m) => best.has(m.key));
  const mastered = practiced.filter((m) => moduleStatus(best.get(m.key)) === "mastered");
  const toReview = practiced.filter((m) => moduleStatus(best.get(m.key)) === "review");
  const placement = latestPlacement(data.practice);
  const planItems = data.plan?.study_plan_items ?? [];
  return (
    <>
      <PageHeader
        title="Mi progreso"
        description="Dónde está, qué le falta y en qué centrarse, según sus simulacros y las correcciones de su profesora. Los niveles son estimaciones, no resultados oficiales."
      />
      {profile.targetLevel ? (
        <section aria-labelledby="gap-title" className="mb-6">
          <h2 id="gap-title" className="mb-3 text-lg font-semibold">
            Cuánto le falta para {profile.targetLevel}
          </h2>
          <GapPanel gaps={skillGaps(diagnosis.skills, profile.targetLevel, reference)} target={profile.targetLevel} />
        </section>
      ) : null}
      <Card className="mb-6">
        <CardHeader title="Mi práctica" description="Lo que ha hecho por su cuenta, sin esperar a ninguna corrección." />
        <CardBody className="space-y-3">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <dt className="text-sm text-ink-2">Temas dominados</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {mastered.length} <span className="text-sm font-normal text-ink-3">de {MODULES.length}</span>
              </dd>
            </div>
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <dt className="text-sm text-ink-2">Actividades del plan</dt>
              <dd className="text-2xl font-semibold tabular-nums">
                {planItems.filter((i) => i.completed_at).length} <span className="text-sm font-normal text-ink-3">de {planItems.length}</span>
              </dd>
            </div>
            <div className="rounded-lg bg-surface-2 px-4 py-3">
              <dt className="text-sm text-ink-2">Prueba de nivel</dt>
              <dd className="text-2xl font-semibold">{placement ? (LEVEL_LABEL[placement.level] ?? placement.level) : "—"}</dd>
            </div>
          </dl>
          {toReview.length ? (
            <div>
              <p className="text-sm font-medium">Para repasar</p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {toReview.map((m) => (
                  <li key={m.key}>
                    <Link href={`/estudiante/refuerzo/${m.key}`} className="text-brand underline">
                      {m.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <DiagnosisPanel diagnosis={diagnosis} />
      {data.resultRows.length ? (
        <Card className="mt-6">
          <CardHeader title="Historial de simulacros publicados" />
          <CardBody>
            <ul className="divide-y divide-line">
              {[...data.resultRows].reverse().map((r) => (
                <li key={r.attempt_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/estudiante/resultados/${r.attempt_id}`} className="font-medium text-brand underline">
                      {r.report.attempt.assignment_title}
                    </Link>
                    <p className="text-xs text-ink-3">Publicado el {formatDate(r.published_at)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.report.sections.map((s) => {
                      const pct = s.objective
                        ? objectivePercent(s.objective)
                        : s.productive?.tasks.filter((t) => t.evaluation?.pedagogical_percent != null).length
                          ? s.productive.tasks.reduce((a, t) => a + Number(t.evaluation?.pedagogical_percent ?? 0), 0) /
                            s.productive.tasks.filter((t) => t.evaluation?.pedagogical_percent != null).length
                          : null;
                      return (
                        <Badge key={s.section_id} tone={s.skill === "writing" ? "blue" : s.skill === "speaking" ? "orange" : "gold"}>
                          {SKILL_META[s.skill].short}: {pct != null ? `${formatNumber(pct)} %` : "pendiente"}
                        </Badge>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
