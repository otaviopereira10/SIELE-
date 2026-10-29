import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireAuthor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { validateTaskContent, type InteractionType } from "@/lib/exam/content-schema";
import { SKILL_META } from "@/lib/exam/skills";
import { AddSection, AddTask, DeleteSection, PublishPanel, SectionForm } from "./editor-forms";

export const metadata: Metadata = { title: "Editor de versión" };

const TYPE_LABEL: Record<string, string> = {
  single_choice: "Selección única",
  matching: "Asociación con banco común",
  dropdown_gap: "Huecos con lista desplegable",
  fragment_gap: "Huecos con fragmentos",
  multi_select: "Selección múltiple de enunciados",
  writing: "Producción escrita",
  speaking: "Producción oral grabada",
};

export default async function VersionEditor({ params }: { params: Promise<{ versionId: string }> }) {
  await requireAuthor();
  const { versionId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(versionId)) notFound();
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("exam_versions")
    .select("id, version_no, status, format_label, notes, published_at, exam_templates(title, code), sources(title, edition)")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) notFound();
  const [{ data: sections }, { data: issues }] = await Promise.all([
    supabase
      .from("exam_sections")
      .select("id, skill, position, title, instructions, time_limit_seconds, allow_back, pause_after_seconds, tasks(id, position, title, code, interaction_type, declared_items, level_label, content, content_status, questions(position))")
      .eq("version_id", versionId)
      .order("position"),
    supabase.rpc("validate_exam_version", { p_version: versionId }),
  ]);
  const contentIssues: { task: string; message: string }[] = [];
  for (const s of sections ?? []) {
    for (const t of (s.tasks ?? []) as { title: string; interaction_type: string; content: unknown; questions: { position: number }[] }[]) {
      const r = validateTaskContent(t.interaction_type as InteractionType, t.content, t.questions.map((q) => q.position));
      if (!r.ok) for (const i of r.issues) contentIssues.push({ task: `${s.title} · ${t.title}`, message: `${i.path}: ${i.message}` });
    }
  }
  const sqlIssues = (issues ?? []) as { severity: string; message: string }[];
  const errors = sqlIssues.filter((i) => i.severity === "error").length + contentIssues.length;
  const draft = version.status === "draft";
  const tpl = version.exam_templates as unknown as { title: string; code: string };

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/admin/simulacros" className="underline">
            Banco de simulacros
          </Link>
        }
        title={`${tpl.title} · versión ${version.version_no}`}
        description={`${tpl.code} · ${version.format_label}`}
        actions={
          <>
            <Badge tone={draft ? "warn" : version.status === "published" ? "ok" : "neutral"}>{draft ? "Borrador" : version.status === "published" ? "Publicada (bloqueada)" : "Archivada"}</Badge>
            <ButtonLink href={`/admin/simulacros/${versionId}/vista-previa`} variant="secondary">
              Vista previa como estudiante
            </ButtonLink>
          </>
        }
      />
      {!draft ? (
        <Alert tone="info" className="mb-6" title="Esta versión no se puede editar">
          Para hacer cambios, duplíquela desde el banco de simulacros. Los intentos existentes seguirán vinculados a esta versión.
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardHeader title={`Validación (${errors} errores, ${sqlIssues.filter((i) => i.severity === "warning").length} avisos)`} />
        <CardBody>
          {errors === 0 && sqlIssues.length === 0 ? (
            <Alert tone="ok" title="Sin problemas detectados." />
          ) : (
            <ul className="space-y-1 text-sm">
              {sqlIssues.map((i, k) => (
                <li key={k} className={i.severity === "error" ? "text-danger" : "text-warn"}>
                  {i.severity === "error" ? "✗" : "!"} {i.message}
                </li>
              ))}
              {contentIssues.map((i, k) => (
                <li key={`c${k}`} className="text-danger">
                  ✗ {i.task}: {i.message}
                </li>
              ))}
            </ul>
          )}
          {draft ? <PublishPanel versionId={versionId} disabled={errors > 0} /> : null}
        </CardBody>
      </Card>

      <div className="space-y-6">
        {(sections ?? []).map((s) => (
          <Card key={s.id}>
            <div className={`h-1.5 rounded-t-xl stripe-${SKILL_META[s.skill as keyof typeof SKILL_META].tone}`} />
            <CardHeader
              title={`${s.position}. ${s.title}`}
              description={`${Math.round(s.time_limit_seconds / 60)} min · ${s.allow_back ? "navegación libre" : "sin retorno"}${s.pause_after_seconds ? ` · descanso posterior de ${Math.round(s.pause_after_seconds / 60)} min` : ""}`}
              action={draft ? <DeleteSection versionId={versionId} sectionId={s.id} /> : null}
            />
            <CardBody className="space-y-4">
              {draft ? <SectionForm section={s} /> : null}
              <ul className="divide-y divide-line rounded-lg border border-line">
                {((s.tasks ?? []) as { id: string; position: number; title: string; code: string; interaction_type: string; declared_items: number; level_label: string; content_status: string }[])
                  .sort((a, b) => a.position - b.position)
                  .map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div>
                        <Link href={`/admin/simulacros/${versionId}/tareas/${t.id}`} className="font-medium text-brand underline">
                          {t.title}
                        </Link>{" "}
                        <span className="text-xs text-ink-3">
                          {t.code} · {TYPE_LABEL[t.interaction_type]} · {t.level_label || "sin nivel"} · {t.declared_items} ítems
                        </span>
                      </div>
                      <Badge tone={t.content_status === "reviewed" || t.content_status === "published" ? "ok" : "neutral"}>{t.content_status}</Badge>
                    </li>
                  ))}
              </ul>
              {draft ? <AddTask versionId={versionId} sectionId={s.id} skill={s.skill} /> : null}
            </CardBody>
          </Card>
        ))}
        {draft ? <AddSection versionId={versionId} /> : null}
      </div>
    </>
  );
}
