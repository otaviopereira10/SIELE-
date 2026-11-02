import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { loadStudentOverview } from "@/lib/data/student";
import { latestPlacement } from "@/lib/diagnosis/placement";
import { LEVEL_LABEL } from "@/lib/exam/skills";
import { formatDate } from "@/lib/utils";
import { PlacementTest } from "./placement-test";

export const metadata: Metadata = { title: "Prueba de nivel" };

export default async function PlacementPage() {
  const profile = await requireRole("student");
  const data = await loadStudentOverview(profile.id);
  const last = latestPlacement(data.practice);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Prueba de nivel"
        description={
          last
            ? `La última vez, el ${formatDate(last.date)}, su punto de partida fue ${LEVEL_LABEL[last.level]}. Repítala cuando quiera para ver cuánto ha avanzado.`
            : "Unos minutos para saber desde dónde parte, de modo que su plan empiece por lo que de verdad necesita."
        }
      />
      <PlacementTest seed={requestTime() % 1_000_000} target={profile.targetLevel} hasPlan={Boolean(data.plan)} />
    </div>
  );
}
