import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireAuthor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DeleteTaskButton, QuestionsEditor, TaskMetaForm, type EditorFocus, type EditorLevel, type EditorQuestion } from "./task-editor";

export const metadata: Metadata = { title: "Editor de tarea" };

const FORMAT_HELP: Record<string, string> = {
  single_choice:
    '{"media": {"main": {"asset_id": "…", "kind": "audio"}}, "audio_key": "main", "timing": {"read_seconds": 30, "between_seconds": 10, "after_seconds": 30}, "texts": [{"key": "t1", "label": "Texto 1", "title": "…", "body": "Párrafos separados por línea en blanco. **negrita** *cursiva*", "question_positions": [1]}]}',
  matching: '{"media": {}, "bank_title": "Personas", "unique_use": false, "layout": "select", "texts": [{"key": "a", "label": "A", "title": "…", "body": "…"}]}',
  dropdown_gap: '{"media": {}, "passage_title": "Título", "passage": "Texto con huecos [[1]] y [[2]] (número = posición de la pregunta)", "source": "Texto original"}',
  fragment_gap:
    '{"media": {}, "bank_title": "Fragmentos", "passages": [{"key": "p1", "title": "…", "body": "… [[1]] …", "bank_positions": [1, 2, 3, 4, 5]}]}',
  multi_select: '{"media": {"main": {"asset_id": "…", "kind": "audio"}}, "audio_key": "main", "prompt": "Seleccione seis enunciados."}',
  writing:
    '{"media": {}, "bullets": ["saludar;", "…"], "stimulus": {"title": "…", "body": "…"}, "word_min": 100, "word_max": 150, "keyboard": true, "options": [{"key": "opinion", "title": "…", "instructions": "…", "bullets": [], "stimulus": {"body": "…"}, "word_min": 250, "word_max": 300}]}',
  speaking:
    '{"media": {"q1": {"asset_id": "…", "kind": "audio"}, "foto": {"asset_id": "…", "kind": "image"}}, "parts": [{"key": "p1", "instructions": "…", "choice": {"seconds": 30, "options": [{"key": "a", "title": "…", "bullets": [], "image_key": "foto"}]}, "read_seconds": 30, "prep_seconds": 120, "notes": true, "segments": [{"key": "q1", "prompt_audio_key": "q1", "wait_seconds": 10, "record_seconds": 60}]}]}',
};

export default async function TaskEditorPage({ params }: { params: Promise<{ versionId: string; taskId: string }> }) {
  await requireAuthor();
  const { versionId, taskId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(taskId)) notFound();
  const supabase = await createClient();
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, code, interaction_type, level_label, instructions, content, declared_items, max_audio_plays, suggested_seconds, difficulty, lexical_topic, grammar_topic, source_ref, content_status, task_private(transcript, teacher_notes), exam_sections!inner(version_id, title, skill, exam_versions!inner(status))",
    )
    .eq("id", taskId)
    .maybeSingle();
  if (!task) notFound();
  const section = task.exam_sections as unknown as { version_id: string; title: string; skill: string; exam_versions: { status: string } };
  if (section.version_id !== versionId) notFound();
  const editable = section.exam_versions.status === "draft";

  const [{ data: questions }, { data: options }, { data: keys }, { data: media }] = await Promise.all([
    supabase.from("questions").select("id, position, prompt, level, focus, points, max_selections").eq("task_id", taskId).order("position"),
    supabase.from("question_options").select("id, question_id, position, label, body").eq("task_id", taskId).order("position"),
    supabase.from("question_keys").select("question_id, correct_option_ids, explanation"),
    supabase.from("media_assets").select("id, kind, path, alt_text, is_synthetic_voice, duration_seconds, check_status").order("created_at", { ascending: false }).limit(200),
  ]);
  const bank = (options ?? []).filter((o) => !o.question_id);
  const usesBank = ["matching", "fragment_gap", "multi_select"].includes(task.interaction_type);
  const editorQuestions: EditorQuestion[] = (questions ?? []).map((q) => {
    const own = (options ?? []).filter((o) => o.question_id === q.id);
    const key = (keys ?? []).find((k) => k.question_id === q.id);
    const pool = usesBank ? bank : own;
    return {
      prompt: q.prompt,
      level: (q.level ?? "") as EditorLevel,
      focus: q.focus as EditorFocus,
      points: Number(q.points),
      max_selections: q.max_selections,
      options: own.map((o) => ({ label: o.label, body: o.body })),
      correct: (key?.correct_option_ids ?? []).map((id: string) => pool.findIndex((o) => o.id === id)).filter((i: number) => i >= 0),
      explanation: key?.explanation ?? "",
    };
  });
  const priv = task.task_private as unknown as { transcript: string; teacher_notes: string } | null;
  const objective = !["writing", "speaking"].includes(task.interaction_type);

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href={`/admin/simulacros/${versionId}`} className="underline">
            {section.title}
          </Link>
        }
        title={task.title}
        description={`${task.code} · ${task.interaction_type}`}
        actions={editable ? <DeleteTaskButton versionId={versionId} taskId={taskId} /> : null}
      />
      {!editable ? <Alert tone="info" className="mb-6" title="Versión publicada o archivada: solo lectura." /> : null}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Datos y contenido" />
          <CardBody>
            <TaskMetaForm
              task={{
                id: task.id,
                title: task.title,
                code: task.code,
                level_label: task.level_label,
                instructions: task.instructions,
                declared_items: task.declared_items,
                max_audio_plays: task.max_audio_plays,
                suggested_minutes: task.suggested_seconds ? Math.round(task.suggested_seconds / 60) : null,
                difficulty: task.difficulty,
                lexical_topic: task.lexical_topic,
                grammar_topic: task.grammar_topic,
                source_ref: task.source_ref,
                content: JSON.stringify(task.content, null, 2),
                transcript: priv?.transcript ?? "",
                teacher_notes: priv?.teacher_notes ?? "",
                content_status: task.content_status === "reviewed" ? "reviewed" : "draft",
              }}
              editable={editable}
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Formato del contenido" description="El contenido se valida al guardar y antes de publicar." />
            <CardBody>
              <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 text-xs whitespace-pre-wrap">{FORMAT_HELP[task.interaction_type]}</pre>
              <p className="mt-2 text-xs text-ink-3">
                Los recursos se referencian en «media» con una clave propia. La transcripción privada nunca se envía al estudiante.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Recursos multimedia"
              description="Copie la referencia en «media»."
              action={
                <Link href="/admin/multimedia" className="text-sm text-brand underline">
                  Subir archivos
                </Link>
              }
            />
            <CardBody>
              <ul className="max-h-72 space-y-1 overflow-y-auto text-xs">
                {(media ?? []).map((m) => (
                  <li key={m.id} className="rounded-md bg-surface-2 px-2 py-1">
                    <code className="break-all select-all">{`{"asset_id": "${m.id}", "kind": "${m.kind}"}`}</code>
                    <p className="text-ink-3">
                      {m.path}
                      {m.is_synthetic_voice ? " · voz sintética" : ""}
                      {m.check_status === "failed" ? " · NO SE PUDO REPRODUCIR" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
      {objective ? (
        <Card className="mt-6">
          <CardHeader title="Preguntas, alternativas y claves" description="Las claves son privadas: el estudiante nunca las recibe durante el examen." />
          <CardBody>
            <QuestionsEditor
              taskId={task.id}
              type={task.interaction_type}
              initialQuestions={editorQuestions}
              initialBank={bank.map((o) => ({ label: o.label, body: o.body }))}
              editable={editable}
            />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
