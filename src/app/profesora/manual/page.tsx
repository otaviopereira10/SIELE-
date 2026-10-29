import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { CHAPTERS, MANUAL_UPDATED } from "@/content/manual";
import { MODULES } from "@/content/refuerzo";
import { requireStaff } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Manual de evaluación y preparación del SIELE" };

const VERIFICATION: Record<string, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  verified: { label: "Verificada", tone: "ok" },
  verified_older_edition: { label: "Edición antigua", tone: "warn" },
  pending: { label: "Pendiente de verificación", tone: "neutral" },
  contradictory: { label: "Fuentes contradictorias", tone: "danger" },
};

export default async function ManualPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: rubrics }, { data: sources }] = await Promise.all([
    supabase.from("rubric_versions").select("id, title, code, version_no, skill, criteria, points_table, verification, status").eq("status", "published"),
    supabase.from("sources").select("code, title, url, edition, consulted_at, notes").order("code"),
  ]);
  return (
    <>
      <PageHeader title="Manual de evaluación y preparación del SIELE" description={`Guía integrada para el personal docente · actualizada el ${MANUAL_UPDATED}`} />
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Capítulos" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-1 text-sm">
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#cap-${c.id}`} className="block rounded-md px-2 py-1.5 hover:bg-surface-2">
                  <strong>{c.letter}.</strong> {c.title}
                </a>
              </li>
            ))}
            <li>
              <a href="#refuerzo" className="block rounded-md px-2 py-1.5 hover:bg-surface-2">
                Biblioteca de refuerzo
              </a>
            </li>
          </ol>
        </nav>
        <div className="space-y-6">
          {CHAPTERS.map((c) => (
            <Card key={c.id} id={`cap-${c.id}`} className="scroll-mt-6">
              <CardBody className="py-6">
                <h2 className="mb-3 text-xl font-semibold">
                  Capítulo {c.letter}. {c.title}
                </h2>
                {c.body}
                {c.id === "c"
                  ? (rubrics ?? []).map((r) => {
                      const criteria = r.criteria as { key: string; label: string; weight: number; description: string; bands: { band: number; summary: string }[] }[];
                      return (
                        <div key={r.id} className="mt-6">
                          <h3 className="mb-1 text-lg font-semibold">
                            {r.title} <span className="text-sm font-normal text-ink-3">({r.code} v{r.version_no})</span>
                          </h3>
                          <p className="mb-2 text-xs text-ink-3">Ponderaciones y tablas de puntos: Guía de preparadores 2016 ({VERIFICATION[r.verification]?.label}).</p>
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm">
                              <thead>
                                <tr className="border-b border-line text-left">
                                  <th className="py-2 pr-2">Criterio</th>
                                  {[0, 1, 2, 3, 4, 5].map((b) => (
                                    <th key={b} className="pr-2">
                                      {b}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="align-top">
                                {criteria.map((c2) => (
                                  <tr key={c2.key} className="border-b border-line">
                                    <td className="py-2 pr-2">
                                      <strong>{c2.label}</strong>
                                      <p className="text-xs text-ink-3">{formatNumber(c2.weight)} %</p>
                                    </td>
                                    {[0, 1, 2, 3, 4, 5].map((b) => (
                                      <td key={b} className="py-2 pr-2 text-xs text-ink-2">
                                        {c2.bands.find((x) => x.band === b)?.summary}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })
                  : null}
                {c.id === "f" ? (
                  <ul className="mt-2 space-y-2 text-sm">
                    {(sources ?? []).map((s) => (
                      <li key={s.code} className="rounded-md border border-line px-3 py-2">
                        <a href={s.url} className="font-medium text-brand underline" target="_blank" rel="noreferrer">
                          {s.title}
                        </a>{" "}
                        <span className="text-ink-3">
                          · {s.edition} · consultada el {formatDate(s.consulted_at)}
                        </span>
                        <p className="text-xs text-ink-3">{s.notes}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          ))}
          <Card id="refuerzo" className="scroll-mt-6">
            <CardBody className="py-6">
              <h2 className="mb-3 text-xl font-semibold">Biblioteca de refuerzo</h2>
              <p className="mb-3 text-ink-2">Módulos que el diagnóstico recomienda a los estudiantes. Puede revisarlos para orientar sus comentarios.</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {MODULES.map((m) => (
                  <li key={m.key}>
                    <Link href={`/profesora/manual/refuerzo/${m.key}`} className="text-brand underline">
                      {m.title}
                    </Link>{" "}
                    <Badge>{m.level}</Badge>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
