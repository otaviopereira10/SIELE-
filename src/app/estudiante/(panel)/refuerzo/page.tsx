import type { Metadata } from "next";
import { Card, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { MODULES } from "@/content/refuerzo";
import { requireRole } from "@/lib/auth/dal";
import { loadStudentOverview } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { planContext } from "@/lib/diagnosis/plan-context";
import { bestByModule, moduleStatus } from "@/lib/exam/drill";
import { levelWindow, moduleFitsWindow, moduleLevelRange } from "@/lib/exam/skills";
import { Library, type LibraryCard } from "./library";

export const metadata: Metadata = { title: "Lecciones y ejercicios" };

const ORDER: Record<LibraryCard["status"], number> = { review: 0, new: 1, mastered: 2 };

export default async function RefuerzoPage() {
  const profile = await requireRole("student");
  const data = await loadStudentOverview(profile.id);
  const diagnosis = buildDiagnosis(data.reports, { targetLevel: profile.targetLevel });
  const recommended = new Set(diagnosis.priorities.flatMap((p) => p.modules));
  const best = bestByModule(data.practice);
  const window = levelWindow(profile.targetLevel, planContext(diagnosis, data.practice).currentLevel);
  const cards: LibraryCard[] = MODULES.map((m) => {
    const b = best.get(m.key) ?? null;
    return {
      key: m.key,
      title: m.title,
      summary: m.summary,
      level: m.level,
      minutes: m.minutes,
      activity: m.activity,
      status: moduleStatus(b ?? undefined),
      best: b,
      recommended: recommended.has(m.key),
      fits: moduleFitsWindow(m.level, window),
    };
  }).sort(
    (a, b) =>
      Number(b.recommended) - Number(a.recommended) ||
      ORDER[a.status] - ORDER[b.status] ||
      moduleLevelRange(a.level)[0] - moduleLevelRange(b.level)[0],
  );
  const mine = cards.filter((c) => c.fits);
  const mastered = mine.filter((c) => c.status === "mastered").length;
  return (
    <>
      <PageHeader
        title="Lecciones y ejercicios"
        description="Explicaciones breves con ejemplos y ejercicios que se corrigen al momento. Están pensadas para quien habla portugués, y primero aparece lo que más le conviene."
      />
      {profile.targetLevel ? (
        <Card className="mb-4 px-5 py-4">
          <div className="mb-1.5 flex flex-wrap justify-between gap-2 text-sm">
            <span className="font-medium">Temas para llegar a {profile.targetLevel}</span>
            <span className="text-ink-2 tabular-nums">
              {mastered} de {mine.length} dominados
            </span>
          </div>
          <ProgressBar value={mastered} max={mine.length} tone="ok" label={`Temas dominados para ${profile.targetLevel}`} />
        </Card>
      ) : null}
      <Library cards={cards} target={profile.targetLevel} />
    </>
  );
}
