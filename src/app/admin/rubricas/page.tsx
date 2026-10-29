import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";
import { NewRubricForm, PublishRubricButton } from "./forms";

export const metadata: Metadata = { title: "Rúbricas" };

export default async function RubricsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: rubrics } = await supabase
    .from("rubric_versions")
    .select("id, code, version_no, title, skill, criteria, points_table, verification, status, created_at, sources(title, edition)")
    .order("created_at", { ascending: false });
  const latest = (rubrics ?? []).find((r) => r.status === "published");
  return (
    <>
      <PageHeader
        title="Rúbricas"
        description="Las rúbricas son versionadas: cada evaluación guarda la versión con la que se hizo. Una versión publicada no se modifica; cree una nueva versión."
      />
      <div className="space-y-4">
        {(rubrics ?? []).map((r) => {
          const criteria = r.criteria as { key: string; label: string; weight: number }[];
          const points = r.points_table as Record<string, Record<string, number[]>>;
          return (
            <Card key={r.id}>
              <CardHeader
                title={`${r.title}`}
                description={`${r.code} v${r.version_no} · ${r.skill === "writing" ? "escrita" : "oral"} · ${formatDate(r.created_at)}`}
                action={
                  <div className="flex items-center gap-2">
                    <Badge tone={r.status === "published" ? "ok" : "warn"}>{r.status === "published" ? "Publicada" : "Borrador"}</Badge>
                    <Badge tone={r.verification === "verified" ? "ok" : "warn"}>{r.verification}</Badge>
                    {r.status === "draft" ? <PublishRubricButton id={r.id} /> : null}
                  </div>
                }
              />
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-ink-3">
                        <th className="py-1">Criterio</th>
                        <th>Peso</th>
                        {Object.keys(points).map((k) => (
                          <th key={k}>Puntos banda 0–5 ({k === "*" ? "todas las tareas" : `tarea ${k}`})</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {criteria.map((c) => (
                        <tr key={c.key} className="border-t border-line">
                          <td className="py-1.5">{c.label}</td>
                          <td>{formatNumber(c.weight)} %</td>
                          {Object.keys(points).map((k) => (
                            <td key={k} className="font-mono text-xs">
                              {(points[k][c.key] ?? []).map((n) => formatNumber(n, 3)).join(" · ")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
      <Card className="mt-6">
        <CardHeader title="Nueva versión de rúbrica" description="Parta de la versión publicada más reciente; las ponderaciones deben sumar 100 y cada criterio necesita las bandas 0–5." />
        <CardBody>
          <NewRubricForm
            defaults={
              latest
                ? { code: latest.code, title: latest.title, skill: latest.skill, criteria: JSON.stringify(latest.criteria, null, 2), points_table: JSON.stringify(latest.points_table, null, 2) }
                : { code: "", title: "", skill: "writing", criteria: "[]", points_table: "{}" }
            }
          />
        </CardBody>
      </Card>
    </>
  );
}
