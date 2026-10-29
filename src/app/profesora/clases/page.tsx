import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { SKILL_META, SKILL_ORDER } from "@/lib/exam/skills";
import type { PublishedReport } from "@/lib/results/report";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Clases y alumnos" };

export default async function ClassesPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: classes }, { data: members }, { data: students }, { data: results }] = await Promise.all([
    supabase.from("classes").select("id, name, description, target_level").is("archived_at", null).order("name"),
    supabase.from("class_members").select("class_id, student_id"),
    supabase.from("profiles").select("id, full_name, email, is_active, target_level").eq("role", "student"),
    supabase.from("published_results").select("student_id, report"),
  ]);
  if (!classes?.length) {
    return (
      <>
        <PageHeader title="Clases y alumnos" />
        <EmptyState title="No tiene clases asignadas">La administración le concede acceso a las clases.</EmptyState>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Clases y alumnos" description="Último resultado por destreza (porcentaje pedagógico) de cada alumno." />
      <div className="space-y-6">
        {classes.map((c) => {
          const ids = (members ?? []).filter((m) => m.class_id === c.id).map((m) => m.student_id);
          const list = (students ?? []).filter((s) => ids.includes(s.id));
          return (
            <Card key={c.id}>
              <CardHeader
                title={c.name}
                description={`${list.length} alumnos${c.target_level ? ` · objetivo ${c.target_level}` : ""}`}
                action={
                  <ButtonLink href={`/profesora/exportar?clase=${c.id}`} size="sm" variant="secondary">
                    Exportar CSV
                  </ButtonLink>
                }
              />
              <CardBody>
                {list.length === 0 ? (
                  <p className="text-sm text-ink-3">Sin alumnos. Cree una invitación para esta clase.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {list.map((s) => {
                      const d = buildDiagnosis((results ?? []).filter((r) => r.student_id === s.id).map((r) => r.report as PublishedReport));
                      return (
                        <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div>
                            <Link href={`/profesora/alumnos/${s.id}`} className="font-medium text-brand underline">
                              {s.full_name || s.email}
                            </Link>
                            {!s.is_active ? <Badge tone="neutral" className="ml-2">Inactivo</Badge> : null}
                            <p className="text-xs text-ink-3">{s.email}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {SKILL_ORDER.map((k) => {
                              const p = d.skills.find((x) => x.skill === k)?.latest?.percent;
                              return (
                                <Badge key={k} tone={k === "writing" ? "blue" : k === "speaking" ? "orange" : "gold"}>
                                  {SKILL_META[k].short}: {p != null ? `${formatNumber(p)} %` : "—"}
                                </Badge>
                              );
                            })}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
