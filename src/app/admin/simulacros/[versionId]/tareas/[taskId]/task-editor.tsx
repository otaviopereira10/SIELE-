"use client";

import { useActionState, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { deleteTask, saveQuestions, updateTask } from "../../../../actions";

export type EditorLevel = "" | "A1" | "A2" | "B1" | "B2" | "C1";
export type EditorFocus = "" | "global" | "specific" | "detail" | "inference" | "intention" | "grammar" | "lexis" | "connector";

export interface EditorQuestion {
  prompt: string;
  level: EditorLevel;
  focus: EditorFocus;
  points: number;
  max_selections: number;
  options: { label: string; body: string }[];
  correct: number[];
  explanation: string;
}

export function TaskMetaForm({
  task,
  editable,
}: {
  task: {
    id: string;
    title: string;
    code: string;
    level_label: string;
    instructions: string;
    declared_items: number;
    max_audio_plays: number;
    suggested_minutes: number | null;
    difficulty: number;
    lexical_topic: string;
    grammar_topic: string;
    source_ref: string;
    content: string;
    transcript: string;
    teacher_notes: string;
    content_status: "draft" | "reviewed";
  };
  editable: boolean;
}) {
  const [state, action] = useActionState(updateTask, null);
  const [content, setContent] = useState(task.content);
  const jsonError = (() => {
    try {
      JSON.parse(content);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  })();
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="id" value={task.id} />
      <fieldset disabled={!editable} className="contents">
        <Field label="Título" htmlFor="title">
          <Input id="title" name="title" defaultValue={task.title} />
        </Field>
        <Field label="Código único" htmlFor="code">
          <Input id="code" name="code" defaultValue={task.code} />
        </Field>
        <Field label="Nivel objetivo" htmlFor="level_label" hint="Ej.: A1, B2–C1">
          <Input id="level_label" name="level_label" defaultValue={task.level_label} />
        </Field>
        <Field label="Ítems declarados" htmlFor="declared_items" hint="Se recalcula al guardar las preguntas.">
          <Input id="declared_items" name="declared_items" type="number" min={0} max={60} defaultValue={task.declared_items} />
        </Field>
        <Field label="Reproducciones de audio permitidas" htmlFor="max_audio_plays" hint="0 = sin límite">
          <Input id="max_audio_plays" name="max_audio_plays" type="number" min={0} max={10} defaultValue={task.max_audio_plays} />
        </Field>
        <Field label="Tiempo orientativo (min)" htmlFor="suggested_minutes">
          <Input id="suggested_minutes" name="suggested_minutes" type="number" min={0} max={240} defaultValue={task.suggested_minutes ?? ""} />
        </Field>
        <Field label="Dificultad (1–5)" htmlFor="difficulty">
          <Input id="difficulty" name="difficulty" type="number" min={1} max={5} defaultValue={task.difficulty} />
        </Field>
        <Field label="Estado del contenido" htmlFor="content_status">
          <Select id="content_status" name="content_status" defaultValue={task.content_status}>
            <option value="draft">Borrador</option>
            <option value="reviewed">Revisado</option>
          </Select>
        </Field>
        <Field label="Tema léxico" htmlFor="lexical_topic">
          <Input id="lexical_topic" name="lexical_topic" defaultValue={task.lexical_topic} />
        </Field>
        <Field label="Tema gramatical" htmlFor="grammar_topic">
          <Input id="grammar_topic" name="grammar_topic" defaultValue={task.grammar_topic} />
        </Field>
        <Field label="Fuente de referencia" htmlFor="source_ref" className="md:col-span-2">
          <Input id="source_ref" name="source_ref" defaultValue={task.source_ref} />
        </Field>
        <Field label="Instrucciones para el estudiante" htmlFor="instructions" className="md:col-span-2">
          <Textarea id="instructions" name="instructions" defaultValue={task.instructions} />
        </Field>
        <Field label="Contenido (JSON)" htmlFor="content" className="md:col-span-2" error={jsonError ? `JSON no válido: ${jsonError}` : null}>
          <Textarea id="content" name="content" value={content} onChange={(e) => setContent(e.target.value)} className="min-h-80 font-mono text-xs" spellCheck={false} />
        </Field>
        <Field label="Transcripción privada del audio" htmlFor="transcript" className="md:col-span-2">
          <Textarea id="transcript" name="transcript" defaultValue={task.transcript} className="min-h-24" />
        </Field>
        <Field label="Notas para la evaluación (privadas)" htmlFor="teacher_notes" className="md:col-span-2">
          <Textarea id="teacher_notes" name="teacher_notes" defaultValue={task.teacher_notes} className="min-h-20" />
        </Field>
      </fieldset>
      {editable ? (
        <div className="md:col-span-2">
          <FormMessage state={state} />
          <SubmitButton className="mt-2" disabled={Boolean(jsonError)}>
            Guardar la tarea
          </SubmitButton>
        </div>
      ) : null}
    </form>
  );
}

export function QuestionsEditor({
  taskId,
  type,
  initialQuestions,
  initialBank,
  editable,
}: {
  taskId: string;
  type: string;
  initialQuestions: EditorQuestion[];
  initialBank: { label: string; body: string }[];
  editable: boolean;
}) {
  const usesBank = ["matching", "fragment_gap", "multi_select"].includes(type);
  const multi = type === "multi_select";
  const [questions, setQuestions] = useState<EditorQuestion[]>(initialQuestions);
  const [bank, setBank] = useState(initialBank);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const letter = (i: number, upper: boolean) => String.fromCharCode((upper ? 65 : 97) + i);

  const setQ = (i: number, patch: Partial<EditorQuestion>) => setQuestions((qs) => qs.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const addQ = () =>
    setQuestions((qs) => [
      ...qs,
      {
        prompt: usesBank ? (type === "fragment_gap" ? `Hueco ${qs.length + 1}` : "") : "",
        level: "",
        focus: "",
        points: 1,
        max_selections: 1,
        options: usesBank ? [] : [{ label: "a", body: "" }, { label: "b", body: "" }, { label: "c", body: "" }],
        correct: [],
        explanation: "",
      },
    ]);

  const pool = (q: EditorQuestion) => (usesBank ? bank : q.options);

  return (
    <div className="space-y-6">
      {usesBank ? (
        <section>
          <h3 className="mb-2 font-semibold">Banco común de opciones</h3>
          <ul className="space-y-2">
            {bank.map((o, i) => (
              <li key={i} className="flex gap-2">
                <Input value={o.label} onChange={(e) => setBank((b) => b.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} className="w-16" aria-label="Etiqueta" disabled={!editable} />
                <Input value={o.body} onChange={(e) => setBank((b) => b.map((x, k) => (k === i ? { ...x, body: e.target.value } : x)))} aria-label={`Opción ${i + 1}`} disabled={!editable} />
                {editable ? (
                  <Button variant="ghost" aria-label="Eliminar opción" onClick={() => setBank((b) => b.filter((_, k) => k !== i))}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          {editable ? (
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => setBank((b) => [...b, { label: letter(b.length, true), body: "" }])}>
              <Plus className="size-4" aria-hidden /> Añadir opción al banco
            </Button>
          ) : null}
        </section>
      ) : null}

      <ol className="space-y-4">
        {questions.map((q, i) => (
          <li key={i} className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">Pregunta {i + 1}</p>
              {editable ? (
                <Button variant="ghost" size="sm" onClick={() => setQuestions((qs) => qs.filter((_, k) => k !== i))}>
                  <Trash2 className="size-4" aria-hidden /> Quitar
                </Button>
              ) : null}
            </div>
            <fieldset disabled={!editable} className="mt-2 grid gap-3 md:grid-cols-4">
              <Field label="Enunciado" htmlFor={`qp-${i}`} className="md:col-span-4">
                <Input id={`qp-${i}`} value={q.prompt} onChange={(e) => setQ(i, { prompt: e.target.value })} />
              </Field>
              <Field label="Nivel" htmlFor={`ql-${i}`}>
                <Select id={`ql-${i}`} value={q.level} onChange={(e) => setQ(i, { level: e.target.value as EditorLevel })}>
                  <option value="">—</option>
                  {["A1", "A2", "B1", "B2", "C1"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Foco" htmlFor={`qf-${i}`}>
                <Select id={`qf-${i}`} value={q.focus} onChange={(e) => setQ(i, { focus: e.target.value as EditorFocus })}>
                  <option value="">—</option>
                  <option value="global">Información global</option>
                  <option value="specific">Información específica</option>
                  <option value="detail">Detalle</option>
                  <option value="inference">Inferencia</option>
                  <option value="intention">Intención</option>
                  <option value="grammar">Gramática</option>
                  <option value="lexis">Léxico</option>
                  <option value="connector">Conector</option>
                </Select>
              </Field>
              <Field label="Puntos" htmlFor={`qpt-${i}`}>
                <Input id={`qpt-${i}`} type="number" min={0.5} step={0.5} value={q.points} onChange={(e) => setQ(i, { points: Number(e.target.value) })} />
              </Field>
              {multi ? (
                <Field label="Selecciones máximas" htmlFor={`qm-${i}`}>
                  <Input id={`qm-${i}`} type="number" min={1} max={12} value={q.max_selections} onChange={(e) => setQ(i, { max_selections: Number(e.target.value) })} />
                </Field>
              ) : null}
            </fieldset>
            {!usesBank ? (
              <div className="mt-3 space-y-2">
                <p className="text-sm font-medium">Alternativas (marque la correcta)</p>
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      checked={q.correct.includes(j)}
                      disabled={!editable}
                      onChange={() => setQ(i, { correct: [j] })}
                      aria-label={`Marcar la alternativa ${j + 1} como correcta`}
                      className="size-5"
                    />
                    <Input
                      value={o.body}
                      disabled={!editable}
                      onChange={(e) => setQ(i, { options: q.options.map((x, k) => (k === j ? { ...x, body: e.target.value } : x)) })}
                      aria-label={`Alternativa ${j + 1}`}
                    />
                    {editable ? (
                      <Button
                        variant="ghost"
                        aria-label="Eliminar alternativa"
                        onClick={() => setQ(i, { options: q.options.filter((_, k) => k !== j), correct: q.correct.filter((c) => c !== j).map((c) => (c > j ? c - 1 : c)) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
                {editable ? (
                  <Button variant="secondary" size="sm" onClick={() => setQ(i, { options: [...q.options, { label: letter(q.options.length, false), body: "" }] })}>
                    <Plus className="size-4" aria-hidden /> Alternativa
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="mt-3">
                <p className="mb-1 text-sm font-medium">{multi ? "Opciones correctas" : "Opción correcta del banco"}</p>
                <div className="flex flex-wrap gap-2">
                  {pool(q).map((o, j) => (
                    <label key={j} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-sm">
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={`bank-correct-${i}`}
                        checked={q.correct.includes(j)}
                        disabled={!editable}
                        onChange={(e) =>
                          setQ(i, { correct: multi ? (e.target.checked ? [...q.correct, j] : q.correct.filter((c) => c !== j)) : [j], points: multi ? (e.target.checked ? q.correct.length + 1 : q.correct.length - 1) || 1 : q.points })
                        }
                      />
                      {o.label || j + 1}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Field label="Explicación (privada hasta la corrección)" htmlFor={`qe-${i}`} className="mt-3">
              <Textarea id={`qe-${i}`} value={q.explanation} disabled={!editable} onChange={(e) => setQ(i, { explanation: e.target.value })} className="min-h-16" />
            </Field>
          </li>
        ))}
      </ol>
      {editable ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={addQ}>
            <Plus className="size-4" aria-hidden /> Añadir pregunta
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveQuestions({ taskId, questions, bank });
                setMsg(r?.ok ? { ok: true, text: r.message ?? "Guardado." } : { ok: false, text: r?.error ?? "Error." });
              })
            }
          >
            Guardar preguntas y claves
          </Button>
        </div>
      ) : null}
      {msg ? <Alert tone={msg.ok ? "ok" : "danger"} title={msg.text} /> : null}
    </div>
  );
}

export function DeleteTaskButton({ versionId, taskId }: { versionId: string; taskId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="ghost" disabled={pending} onClick={() => confirm("¿Eliminar esta tarea?") && start(async () => void (await deleteTask(versionId, taskId)))}>
      Eliminar tarea
    </Button>
  );
}
