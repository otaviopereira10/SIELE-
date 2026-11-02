import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { ReportView } from "@/components/results/report-view";
import { GapPanel } from "@/components/student/gap-panel";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { recordingUrlsFor } from "@/lib/data/recordings";
import { loadReferenceTable } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { skillGaps } from "@/lib/diagnosis/target";
import type { PublishedReport } from "@/lib/results/report";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";
import { PrintButton } from "@/components/print-button";

export const metadata: Metadata = { title: "Informe de resultados" };

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("student");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: all } = await supabase.from("published_results").select("attempt_id, published_at, report").eq("student_id", profile.id);
  const row = all?.find((r) => r.attempt_id === id);
  if (!row) notFound();
  const report = row.report as PublishedReport;
  const until = (all ?? [])
    .map((r) => r.report as PublishedReport)
    .filter((r) => (r.attempt.submitted_at ?? r.generated_at) <= (report.attempt.submitted_at ?? report.generated_at));
  const diagnosis = buildDiagnosis(until, { targetLevel: profile.targetLevel });
  const [recordingUrls, reference] = await Promise.all([recordingUrlsFor(id), loadReferenceTable()]);

  return (
    <>
      <PageHeader
        eyebrow={`Publicado el ${formatDateTime(row.published_at)}`}
        title={report.attempt.assignment_title}
        description={`${report.attempt.exam_title} · ${report.attempt.mode === "formal" ? "simulacro formal" : "práctica"}`}
        actions={
          <PrintButton>
            <Printer className="size-4" aria-hidden /> Descargar o imprimir
          </PrintButton>
        }
      />
      {profile.targetLevel ? (
        <section aria-labelledby="gap-title" className="mb-6 print:hidden">
          <h2 id="gap-title" className="mb-3 text-lg font-semibold">
            Qué significa este resultado para su objetivo ({profile.targetLevel})
          </h2>
          <GapPanel gaps={skillGaps(diagnosis.skills, profile.targetLevel, reference)} target={profile.targetLevel} />
        </section>
      ) : null}
      <ReportView report={report} diagnosis={diagnosis} recordingUrls={recordingUrls} />
    </>
  );
}
