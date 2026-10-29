import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Skill } from "@/lib/exam/content-schema";
import type { RunnerOption, RunnerQuestion, RunnerTask } from "@/lib/exam/types";
import { PreviewRunner, type PreviewSection } from "./preview-runner";

export const metadata: Metadata = { title: "Vista previa" };

/** Vista previa con el mismo motor que verá el estudiante (sin guardar nada). */
export default async function PreviewPage({ params }: { params: Promise<{ versionId: string }> }) {
  await requireStaff();
  const { versionId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(versionId)) notFound();
  const supabase = await createClient();
  const { data: version } = await supabase.from("exam_versions").select("id, version_no, exam_templates(title)").eq("id", versionId).maybeSingle();
  if (!version) notFound();
  const { data: sections } = await supabase
    .from("exam_sections")
    .select(
      "id, skill, position, title, time_limit_seconds, allow_back, tasks(id, position, title, code, interaction_type, instructions, level_label, content, declared_items, max_audio_plays, suggested_seconds, questions(id, position, prompt, max_selections), question_options(id, question_id, position, label, body))",
    )
    .eq("version_id", versionId)
    .order("position");
  const { data: keys } = await supabase.from("question_keys").select("question_id, correct_option_ids, explanation");

  // URLs firmadas de todos los recursos de la versión (el personal docente puede leer el bucket)
  const assetIds = new Set<string>();
  for (const s of sections ?? []) {
    for (const t of (s.tasks ?? []) as { content: { media?: Record<string, { asset_id: string }> } }[]) {
      for (const m of Object.values(t.content.media ?? {})) assetIds.add(m.asset_id);
    }
  }
  const { data: assets } = assetIds.size ? await supabase.from("media_assets").select("id, path, is_synthetic_voice").in("id", [...assetIds]) : { data: [] };
  const { data: signed } = assets?.length
    ? await supabase.storage.from("exam-media").createSignedUrls(
        assets.map((a) => a.path),
        3600,
      )
    : { data: [] };
  const urls: Record<string, { url: string; synthetic: boolean }> = {};
  for (const a of assets ?? []) {
    const s = signed?.find((x) => x.path === a.path);
    if (s?.signedUrl) urls[a.id] = { url: s.signedUrl, synthetic: a.is_synthetic_voice };
  }

  const preview: PreviewSection[] = (sections ?? []).map((s) => ({
    id: s.id,
    skill: s.skill as Skill,
    title: s.title,
    tasks: ((s.tasks ?? []) as (RunnerTask & {
      questions: { id: string; position: number; prompt: string; max_selections: number }[];
      question_options: { id: string; question_id: string | null; position: number; label: string; body: string }[];
    })[])
      .sort((a, b) => a.position - b.position)
      .map((t) => {
        const questions: RunnerQuestion[] = [...t.questions]
          .sort((a, b) => a.position - b.position)
          .map((q) => ({
            ...q,
            options: t.question_options
              .filter((o) => o.question_id === q.id)
              .sort((a, b) => a.position - b.position)
              .map(({ id, label, body }) => ({ id, label, body })),
          }));
        const bank: RunnerOption[] = t.question_options
          .filter((o) => !o.question_id)
          .sort((a, b) => a.position - b.position)
          .map(({ id, label, body }) => ({ id, label, body }));
        const { questions: _q, question_options: _o, ...task } = t;
        return {
          task,
          questions,
          bank,
          keys: Object.fromEntries(
            (keys ?? []).filter((k) => questions.some((q) => q.id === k.question_id)).map((k) => [k.question_id, { correct: k.correct_option_ids as string[], explanation: k.explanation as string }]),
          ),
        };
      }),
  }));

  const title = `${(version.exam_templates as unknown as { title: string }).title} · v${version.version_no}`;
  return <PreviewRunner title={title} sections={preview} mediaUrls={urls} backHref={`/admin/simulacros/${versionId}`} />;
}
