import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Printer } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { ReportView } from "@/components/results/report-view";
import { PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { recordingUrlsFor } from "@/lib/data/recordings";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import type { PublishedReport } from "@/lib/results/report";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Informe individual" };

/** Informe tal como lo ve el estudiante; se puede descargar en PDF con la impresión del navegador. */
export default async function TeacherReport({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: row } = await supabase.from("published_results").select("student_id, published_at, report").eq("attempt_id", id).maybeSingle();
  if (!row) notFound();
  const { data: all } = await supabase.from("published_results").select("report").eq("student_id", row.student_id);
  const report = row.report as PublishedReport;
  const diagnosis = buildDiagnosis(
    (all ?? []).map((r) => r.report as PublishedReport).filter((r) => (r.attempt.submitted_at ?? "") <= (report.attempt.submitted_at ?? "")),
  );
  return (
    <>
      <p className="no-print mb-3 text-sm">
        <Link href={`/profesora/correcciones/${id}`} className="text-brand underline">
          ← Volver a la corrección
        </Link>
      </p>
      <PageHeader
        eyebrow={`Publicado el ${formatDateTime(row.published_at)}`}
        title={`${report.student.full_name} · ${report.attempt.assignment_title}`}
        actions={
          <PrintButton>
            <Printer className="size-4" aria-hidden /> Descargar PDF / imprimir
          </PrintButton>
        }
      />
      <ReportView report={report} diagnosis={diagnosis} recordingUrls={await recordingUrlsFor(id)} moduleBase="/profesora/manual/refuerzo" />
    </>
  );
}
