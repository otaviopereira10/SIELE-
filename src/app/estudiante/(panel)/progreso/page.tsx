import type { Metadata } from "next";
import Link from "next/link";
import { DiagnosisPanel } from "@/components/results/diagnosis-panel";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { loadStudentOverview } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { SKILL_META } from "@/lib/exam/skills";
import { objectivePercent } from "@/lib/results/report";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Mi progreso" };

export default async function ProgressPage() {
  const profile = await requireRole("student");
  const data = await loadStudentOverview(profile.id);
  const diagnosis = buildDiagnosis(data.reports);
  return (
    <>
      <PageHeader
        title="Mi progreso"
        description="Diagnóstico basado en sus resultados publicados y en las observaciones de su profesora. Los niveles son estimaciones pedagógicas, no resultados oficiales."
      />
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
