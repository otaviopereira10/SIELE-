import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireAuthor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { CreateTemplateForm, VersionActions } from "./forms";

export const metadata: Metadata = { title: "Banco de simulacros" };

const STATUS = { draft: ["Borrador", "warn"], published: ["Publicada", "ok"], archived: ["Archivada", "neutral"], reviewed: ["Revisada", "brand"] } as const;

export default async function BankPage() {
  await requireAuthor();
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("exam_templates")
    .select("id, code, title, description, created_at, exam_versions(id, version_no, status, published_at, created_at, exam_sections(id))")
    .order("created_at", { ascending: false });
  return (
    <>
      <PageHeader
        title="Banco de simulacros"
        description="Plantilla → versiones. Una versión publicada queda bloqueada: para cambiarla, duplíquela y publique la nueva. Los intentos ya iniciados conservan siempre su versión."
      />
      <Card className="mb-6">
        <CardHeader title="Nueva plantilla" />
        <CardBody>
          <CreateTemplateForm />
        </CardBody>
      </Card>
      {(templates ?? []).length === 0 ? (
        <EmptyState title="No hay simulacros">Cree una plantilla o cargue el simulacro de ejemplo con scripts/seed-content.ts.</EmptyState>
      ) : (
        <div className="space-y-4">
          {(templates ?? []).map((t) => (
            <Card key={t.id}>
              <CardHeader title={`${t.title}`} description={`${t.code} · ${t.description || "Sin descripción"}`} />
              <CardBody>
                <ul className="divide-y divide-line">
                  {((t.exam_versions ?? []) as { id: string; version_no: number; status: keyof typeof STATUS; published_at: string | null; created_at: string; exam_sections: { id: string }[] }[])
                    .sort((a, b) => b.version_no - a.version_no)
                    .map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/admin/simulacros/${v.id}`} className="font-medium text-brand underline">
                            Versión {v.version_no}
                          </Link>
                          <Badge tone={STATUS[v.status][1]}>{STATUS[v.status][0]}</Badge>
                          <span className="text-xs text-ink-3">
                            {v.exam_sections.length} pruebas · {v.published_at ? `publicada el ${formatDate(v.published_at)}` : `creada el ${formatDate(v.created_at)}`}
                          </span>
                        </div>
                        <VersionActions versionId={v.id} status={v.status} />
                      </li>
                    ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
