import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { MODULES } from "@/content/refuerzo";
import { requireRole } from "@/lib/auth/dal";
import { loadStudentOverview } from "@/lib/data/student";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { SKILL_META } from "@/lib/exam/skills";

export const metadata: Metadata = { title: "Refuerzo" };

const ACTIVITY = { grammar: "Gramática", vocabulary: "Vocabulario", receptive: "Comprensión", writing: "Escritura", speaking: "Oral" };

export default async function RefuerzoPage() {
  const profile = await requireRole("student");
  const data = await loadStudentOverview(profile.id);
  const diagnosis = buildDiagnosis(data.reports);
  const recommended = new Set(diagnosis.priorities.flatMap((p) => p.modules));
  const best = new Map<string, { score: number; max: number }>();
  for (const p of data.practice) {
    const cur = best.get(p.module_key);
    if (!cur || p.score / p.max_score > cur.score / cur.max) best.set(p.module_key, { score: p.score, max: p.max_score });
  }
  const ordered = [...MODULES].sort((a, b) => Number(recommended.has(b.key)) - Number(recommended.has(a.key)));
  return (
    <>
      <PageHeader title="Biblioteca de refuerzo" description="Micro-lecciones con explicación breve, ejemplos originales y ejercicios. Las recomendadas salen de su diagnóstico." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ordered.map((m) => {
          const b = best.get(m.key);
          return (
            <Link key={m.key} href={`/estudiante/refuerzo/${m.key}`} className="group">
              <Card className="h-full p-4 transition-shadow group-hover:shadow-md">
                <div className="flex flex-wrap gap-1.5">
                  {recommended.has(m.key) ? <Badge tone="danger">Recomendado para usted</Badge> : null}
                  <Badge>{ACTIVITY[m.activity]}</Badge>
                  {m.skill !== "general" ? <Badge tone="brand">{SKILL_META[m.skill].short}</Badge> : null}
                  <Badge>{m.level}</Badge>
                </div>
                <p className="mt-3 font-semibold">{m.title}</p>
                <p className="mt-1 text-sm text-ink-2">{m.summary}</p>
                <p className="mt-3 text-xs text-ink-3">
                  {m.minutes} min{b ? ` · mejor resultado ${b.score}/${b.max}` : ""}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
