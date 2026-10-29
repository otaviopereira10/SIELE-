"use client";

import { useRef, useState, useTransition } from "react";
import { Clock, Flag, Lock, Trash2, Unlock } from "lucide-react";
import { AnnotatedText } from "@/components/results/annotated-text";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, RichText, inline } from "@/components/ui/primitives";
import type { AiSuggestion } from "@/lib/ai/feedback";
import { categoryLabel } from "@/lib/diagnosis/taxonomy";
import type { SpeakingContent, WritingContent } from "@/lib/exam/content-schema";
import { SKILL_META, formatDuration } from "@/lib/exam/skills";
import { countWords } from "@/lib/exam/words";
import type { GradingData } from "@/lib/data/teacher";
import { cn, formatDateTime } from "@/lib/utils";
import { annulAttempt, deleteFeedback, publishResults, requestResubmission, saveTranscript, setAttemptLock } from "../../actions";
import { AiPanel } from "./ai-panel";
import { AnnotationForm, type AnnotationDraft } from "./annotation-form";
import { RubricPanel, type EvaluationState, type RubricCriterion } from "./rubric-panel";

type Rubric = GradingData["rubrics"][number];

/** Calcula la posición de la selección dentro del texto original (ignora los números de las marcas). */
function selectionOffsets(container: HTMLElement): { start: number; end: number; quote: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return null;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let start = -1;
  let end = -1;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if ((n.parentElement as HTMLElement | null)?.closest("[data-ignore]")) continue;
    const len = n.textContent?.length ?? 0;
    if (n === range.startContainer) start = pos + range.startOffset;
    if (n === range.endContainer) end = pos + range.endOffset;
    pos += len;
  }
  if (start < 0 || end <= start) return null;
  return { start, end, quote: "" };
}

export function GradingWorkspace({ data, recordingUrls, aiEnabled }: { data: GradingData; recordingUrls: Record<string, string>; aiEnabled: boolean }) {
  const [taskId, setTaskId] = useState(data.tasks[0]?.id ?? null);
  const task = data.tasks.find((t) => t.id === taskId) ?? null;
  const attemptId = data.attempt.id;
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "publish" | "resubmit" | "annul">(null);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string } | null>) =>
    start(async () => {
      const res = await fn();
      setNotice(res?.ok ? { ok: true, text: res.message ?? "Hecho." } : { ok: false, text: res?.error ?? "Error." });
      setDialog(null);
      setReason("");
    });

  const status = data.attempt.status as string;
  const canGrade = ["submitted", "published", "resubmission_requested"].includes(status);

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-ink-3">{data.assignment.title}</p>
            <h1 className="text-2xl font-semibold">{data.student.full_name || data.student.email}</h1>
            <p className="mt-1 flex flex-wrap gap-2 text-sm text-ink-2">
              <Badge tone={status === "published" ? "ok" : status === "submitted" ? "warn" : status === "in_progress" ? "brand" : "danger"}>
                {{ in_progress: "En curso", submitted: "Pendiente", published: "Publicado", resubmission_requested: "Nueva entrega solicitada", annulled: "Anulado", expired: "Caducado" }[status] ?? status}
              </Badge>
              <span>Enviado: {formatDateTime(data.attempt.submitted_at)}</span>
              {data.student.target_level ? <span>Objetivo: {data.student.target_level}</span> : null}
              <span>{data.attempt.mode === "formal" ? "Simulacro formal" : "Práctica"}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canGrade ? (
              <Button onClick={() => setDialog("publish")} disabled={pending || status === "resubmission_requested"}>
                {status === "published" ? "Volver a publicar" : "Publicar resultados"}
              </Button>
            ) : null}
            {status === "in_progress" ? (
              <Button variant="secondary" onClick={() => run(() => setAttemptLock(attemptId, !data.attempt.locked_by_teacher))} disabled={pending}>
                {data.attempt.locked_by_teacher ? <Unlock className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                {data.attempt.locked_by_teacher ? "Desbloquear" : "Bloquear"}
              </Button>
            ) : null}
            {status !== "published" && status !== "annulled" ? (
              <Button variant="ghost" onClick={() => setDialog("annul")}>
                Anular intento
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {notice ? (
        <Alert tone={notice.ok ? "ok" : "danger"} title={notice.text} />
      ) : null}
      {status === "in_progress" ? <Alert tone="info" title="El intento sigue en curso. Podrá evaluarlo cuando se envíe o venza el tiempo." /> : null}
      {data.resubmissions.filter((r) => r.status === "open").map((r) => (
        <Alert key={r.id} tone="warn" title="Nueva entrega solicitada">
          {r.reason}
        </Alert>
      ))}

      {data.scores.length ? (
        <Card>
          <CardHeader title="Corrección automática (comprensión)" />
          <CardBody className="grid gap-4 md:grid-cols-2">
            {data.scores.map((s) => (
              <div key={s.section_id}>
                <p className="font-medium">{SKILL_META[s.skill as "reading"].label}</p>
                <p className="text-sm text-ink-2">
                  {s.correct} aciertos · {s.wrong} errores · {s.blank} sin responder · {Number(s.raw_points)}/{Number(s.max_points)} puntos brutos
                </p>
                <ul className="mt-1 text-xs text-ink-3">
                  {(s.by_task as { position: number; correct: number; wrong: number; blank: number }[]).map((t) => (
                    <li key={t.position}>
                      Tarea {t.position}: {t.correct}/{t.correct + t.wrong + t.blank}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {data.tasks.length === 0 ? (
        <Alert tone="info" title="Este intento no incluye tareas de producción: los resultados se corrigen automáticamente." />
      ) : (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Tareas para evaluar">
            {data.tasks.map((t) => {
              const ev = data.evaluations.find((e) => e.task_id === t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    if (dirty && !window.confirm("Hay cambios sin guardar en la rúbrica. ¿Cambiar de tarea igualmente?")) return;
                    setTaskId(t.id);
                    setDirty(false);
                  }}
                  aria-current={t.id === taskId ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm",
                    t.id === taskId ? (t.skill === "writing" ? "border-blue bg-blue text-white" : "border-orange bg-orange text-white") : "border-line-strong bg-surface",
                  )}
                >
                  {SKILL_META[t.skill].short} · {t.title}
                  {ev?.is_complete ? <span aria-label="evaluada">✓</span> : ev ? <span aria-label="borrador">•</span> : null}
                </button>
              );
            })}
          </nav>
          {task ? (
            <TaskGrader
              key={task.id}
              data={data}
              task={task}
              recordingUrls={recordingUrls}
              aiEnabled={aiEnabled}
              readOnly={!canGrade}
              onDirtyChange={setDirty}
              onResubmit={() => setDialog("resubmit")}
            />
          ) : null}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Historial de evaluaciones" />
          <CardBody>
            {data.history.length === 0 ? (
              <p className="text-sm text-ink-3">Sin cambios todavía.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
                {data.history.map((h, i) => {
                  const t = data.tasks.find((x) => x.id === data.evaluations.find((e) => e.id === h.evaluation_id)?.task_id);
                  const snap = h.snapshot as { points?: number | null; scores?: { criterion: string; band: number | null }[] };
                  return (
                    <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-line py-1">
                      <span>
                        {t?.title ?? "Tarea"} · {h.action === "published" ? "publicada" : h.action === "created" ? "creada" : "actualizada"}
                        <span className="text-ink-3"> · bandas {(snap.scores ?? []).map((s) => s.band ?? "–").join("/")}</span>
                      </span>
                      <span className="text-ink-3">{formatDateTime(h.created_at)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Registro del intento" description="Eventos para el control del simulacro." />
          <CardBody>
            <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
              {data.events.map((e, i) => (
                <li key={i} className="flex justify-between gap-2 border-b border-line py-1">
                  <span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                  <span className="text-ink-3">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={dialog === "publish"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Publicar resultados"
        description="El estudiante verá el informe con las bandas, los comentarios, las evidencias y las recomendaciones. Podrá corregir y volver a publicar más adelante; queda registrado en el historial."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button disabled={pending} onClick={() => run(() => publishResults(attemptId))}>
              Publicar
            </Button>
          </>
        }
      />
      <Dialog
        open={dialog === "resubmit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Solicitar una nueva entrega"
        description="El estudiante podrá reescribir solo este texto. La evaluación de la tarea vuelve a borrador."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button disabled={pending || reason.trim().length < 3 || !task} onClick={() => task && run(() => requestResubmission(attemptId, task.id, reason))}>
              Solicitar
            </Button>
          </>
        }
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo e indicaciones para el estudiante" aria-label="Motivo" />
      </Dialog>
      <Dialog
        open={dialog === "annul"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Anular el intento"
        description="Un intento anulado no cuenta para el número máximo de intentos. Indique el motivo (queda en el registro de auditoría)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={pending || reason.trim().length < 3} onClick={() => run(() => annulAttempt(attemptId, reason))}>
              Anular
            </Button>
          </>
        }
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo" aria-label="Motivo" />
      </Dialog>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  started: "Intento iniciado",
  resumed: "Intento reanudado",
  section_started: "Prueba iniciada",
  section_completed: "Prueba terminada",
  section_timed_out: "Tiempo agotado en una prueba",
  task_navigation: "Cambio de tarea",
  audio_play: "Reproducción de audio",
  recording_saved: "Grabación guardada",
  submitted: "Intento enviado",
  visibility_hidden: "Ventana oculta / cambio de pestaña",
  visibility_visible: "Ventana visible de nuevo",
  connection_lost: "Conexión perdida",
  connection_restored: "Conexión recuperada",
  mic_check_ok: "Micrófono comprobado",
  mic_check_failed: "Fallo en la comprobación del micrófono",
  practice_task_checked: "Tarea comprobada (práctica)",
  resubmission_submitted: "Nueva entrega enviada",
  locked_by_teacher: "Bloqueado por la profesora",
  unlocked_by_teacher: "Desbloqueado por la profesora",
  annulled: "Anulado",
};

function TaskGrader({
  data,
  task,
  recordingUrls,
  aiEnabled,
  readOnly,
  onDirtyChange,
  onResubmit,
}: {
  data: GradingData;
  task: GradingData["tasks"][number];
  recordingUrls: Record<string, string>;
  aiEnabled: boolean;
  readOnly: boolean;
  onDirtyChange: (d: boolean) => void;
  onResubmit: () => void;
}) {
  const attemptId = data.attempt.id;
  const ev = data.evaluations.find((e) => e.task_id === task.id) ?? null;
  const rubric: Rubric | undefined =
    data.rubrics.find((r) => r.id === ev?.rubric_version_id) ??
    data.rubrics.find((r) => r.id === task.rubric_version_id) ??
    data.rubrics.filter((r) => r.skill === task.skill && r.status === "published").at(-1);
  const criteria = (rubric?.criteria ?? []) as RubricCriterion[];
  const feedback = (ev?.teacher_feedback ?? []) as {
    id: string;
    kind: "error" | "strength" | "suggestion";
    category: string;
    criterion_key: string | null;
    quote: string;
    char_start: number | null;
    char_end: number | null;
    recording_id: string | null;
    audio_ms: number | null;
    explanation: string;
    correction: string;
    improved_example: string;
    is_systematic: boolean;
  }[];
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const [draftInitial, setDraftInitial] = useState<Parameters<typeof AnnotationForm>[0]["initial"]>(undefined);
  const [externalBand, setExternalBand] = useState<{ criterion: string; band: number; nonce: number } | null>(null);
  const [, start] = useTransition();
  const textRef = useRef<HTMLDivElement | null>(null);

  const initialScores: EvaluationState["scores"] = {};
  for (const s of (ev?.rubric_scores ?? []) as { criterion_key: string; band: number | null; comment: string }[]) {
    initialScores[s.criterion_key] = { band: s.band, comment: s.comment };
  }
  const initial: EvaluationState = {
    scores: initialScores,
    globalComment: ev?.global_comment ?? "",
    strengths: ev?.strengths ?? "",
    priorities: ev?.priorities ?? "",
    nextSteps: ev?.next_steps ?? "",
  };

  const response = data.responses.find((r) => r.task_id === task.id && r.item_key === "text");
  const payload = response?.payload as { text?: string; option_key?: string | null } | undefined;
  const studentText = payload?.text ?? "";
  const revisions = data.revisions.filter((r) => r.response_id === response?.id);
  const aiLatest = data.aiSuggestions.find((a) => a.evaluation_id === ev?.id) as
    | { id: string; model: string; status: string; created_at: string; suggestion: AiSuggestion }
    | undefined;

  const captureSelection = () => {
    if (readOnly || !textRef.current) return;
    const off = selectionOffsets(textRef.current);
    if (!off) return;
    const quote = studentText.slice(off.start, off.end);
    if (!quote.trim()) return;
    setDraftInitial(undefined);
    setDraft({ quote, charStart: off.start, charEnd: off.end, recordingId: null, audioMs: null });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
      <div className="space-y-5">
        {task.skill === "writing" ? (
          <WritingMaterial task={task} optionKey={payload?.option_key ?? null} />
        ) : (
          <SpeakingMaterial task={task} data={data} />
        )}

        {task.skill === "writing" ? (
          <Card>
            <CardHeader
              title="Texto del estudiante"
              description={`${countWords(studentText)} palabras · primer guardado ${formatDateTime(response?.first_saved_at)} · último ${formatDateTime(response?.updated_at)}`}
              action={
                !readOnly ? (
                  <Button size="sm" variant="ghost" onClick={onResubmit}>
                    <Flag className="size-4" aria-hidden /> Pedir nueva entrega
                  </Button>
                ) : null
              }
            />
            <CardBody className="space-y-3">
              {studentText ? (
                <>
                  <p className="text-xs text-ink-3">Seleccione un fragmento del texto para añadir una observación con evidencia.</p>
                  <div ref={textRef} onMouseUp={captureSelection} onTouchEnd={() => setTimeout(captureSelection, 50)} className="rounded-lg bg-surface-2 p-4">
                    <AnnotatedText
                      text={studentText}
                      annotations={feedback.map((f) => ({ id: f.id, quote: f.quote, char_start: f.char_start, char_end: f.char_end, kind: f.kind }))}
                    />
                  </div>
                </>
              ) : (
                <Alert tone="warn" title="El estudiante no escribió ningún texto en esta tarea." />
              )}
              {revisions.length > 1 ? (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium">Historial de borradores ({revisions.length})</summary>
                  <ol className="mt-2 space-y-2">
                    {revisions.map((r) => (
                      <li key={r.id} className="rounded-md border border-line p-2">
                        <p className="text-xs text-ink-3">
                          {formatDateTime(r.saved_at)} · {r.word_count} palabras · {r.kind === "resubmission" ? "nueva entrega" : r.kind === "final" ? "entrega final" : "autoguardado"}
                        </p>
                        <p className="mt-1 line-clamp-3 whitespace-pre-wrap">{(r.payload as { text?: string }).text}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </CardBody>
          </Card>
        ) : (
          <RecordingsCard
            data={data}
            task={task}
            urls={recordingUrls}
            readOnly={readOnly}
            onMark={(recordingId, ms) => {
              setDraftInitial(undefined);
              setDraft({ quote: "", charStart: null, charEnd: null, recordingId, audioMs: ms });
            }}
          />
        )}

        {draft ? (
          <AnnotationForm
            key={`${draft.charStart}-${draft.audioMs}-${draft.quote}`}
            attemptId={attemptId}
            taskId={task.id}
            skill={task.skill}
            criteria={criteria}
            draft={draft}
            initial={draftInitial}
            onDone={() => setDraft(null)}
          />
        ) : null}

        <Card>
          <CardHeader title={`Observaciones (${feedback.length})`} description="Se muestran al estudiante cuando publique los resultados." />
          <CardBody>
            {feedback.length === 0 ? (
              <p className="text-sm text-ink-3">Todavía no hay observaciones.</p>
            ) : (
              <ol className="space-y-2">
                {feedback.map((f, i) => (
                  <li key={f.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong>{i + 1}.</strong>
                        <Badge tone={f.kind === "error" ? "danger" : f.kind === "strength" ? "ok" : "warn"}>{categoryLabel(f.category)}</Badge>
                        {f.is_systematic ? <Badge tone="danger">Sistemático</Badge> : null}
                        {f.audio_ms != null ? (
                          <span className="flex items-center gap-1 text-xs text-ink-3">
                            <Clock className="size-3" aria-hidden />
                            {formatDuration(f.audio_ms / 1000)}
                          </span>
                        ) : null}
                      </span>
                      {!readOnly ? (
                        <button
                          type="button"
                          className="rounded p-1 text-ink-3 hover:text-danger"
                          aria-label="Eliminar observación"
                          onClick={() => start(async () => void (await deleteFeedback(attemptId, f.id)))}
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                    {f.quote ? <p className="mt-1 italic">«{f.quote}»</p> : null}
                    {f.correction ? <p>→ {f.correction}</p> : null}
                    {f.explanation ? <p className="text-ink-2">{f.explanation}</p> : null}
                    {f.improved_example ? <p className="text-ink-2">Versión mejorada: «{f.improved_example}»</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:overflow-y-auto xl:pr-1">
        {task.skill === "writing" && !readOnly ? (
          <AiPanel
            attemptId={attemptId}
            taskId={task.id}
            latest={aiLatest ?? null}
            enabled={aiEnabled}
            onApplyBand={(criterion, band) => setExternalBand({ criterion, band, nonce: Date.now() })}
            onUseObservation={(o) => {
              const idx = studentText.indexOf(o.quote);
              setDraftInitial({ kind: o.kind, category: o.category, explanation: o.explanation, correction: o.correction, improved: o.improved_example });
              setDraft({ quote: o.quote, charStart: idx >= 0 ? idx : null, charEnd: idx >= 0 ? idx + o.quote.length : null, recordingId: null, audioMs: null });
            }}
          />
        ) : null}
        {rubric ? (
          <RubricPanel
            attemptId={attemptId}
            taskId={task.id}
            taskPosition={task.position}
            criteria={criteria}
            pointsTable={rubric.points_table as Record<string, Record<string, number[]>>}
            rubricTitle={`${rubric.title} (v${rubric.version_no})`}
            verification={rubric.verification}
            initial={initial}
            readOnly={readOnly}
            externalBand={externalBand}
            onDirtyChange={onDirtyChange}
            status={{ status: ev?.status ?? null, points: ev?.points ?? null, max: ev?.max_points ?? null, percent: ev?.pedagogical_percent ?? null, updatedAt: ev?.updated_at ?? null }}
          />
        ) : (
          <Alert tone="danger" title="No hay una rúbrica publicada para esta destreza." />
        )}
      </div>
    </div>
  );
}

function WritingMaterial({ task, optionKey }: { task: GradingData["tasks"][number]; optionKey: string | null }) {
  const c = task.content as WritingContent;
  const option = c.options?.find((o) => o.key === optionKey);
  const bullets = option?.bullets ?? c.bullets ?? [];
  const stimulus = option?.stimulus ?? c.stimulus;
  const min = option?.word_min ?? c.word_min;
  const max = option?.word_max ?? c.word_max;
  return (
    <Card>
      <CardHeader title={`Enunciado · ${task.title}`} description={option ? `Opción elegida: ${option.title}` : undefined} />
      <CardBody className="space-y-3 text-sm">
        <RichText text={option?.instructions ?? task.instructions} />
        {bullets.length ? (
          <ol className="list-decimal space-y-0.5 pl-5">
            {bullets.map((b, i) => (
              <li key={i}>{inline(b)}</li>
            ))}
          </ol>
        ) : null}
        {stimulus ? (
          <details>
            <summary className="cursor-pointer font-medium">Texto de estímulo</summary>
            <div className="mt-2 rounded-md bg-surface-2 p-3">
              {stimulus.title ? <p className="font-semibold">{stimulus.title}</p> : null}
              <RichText text={stimulus.body} />
            </div>
          </details>
        ) : null}
        {min || max ? <p className="text-ink-3">Extensión recomendada: {min}–{max} palabras (no se puntúa la cantidad, sino el cumplimiento).</p> : null}
        {task.teacher_notes ? <Alert tone="info" title="Notas para la evaluación">{task.teacher_notes}</Alert> : null}
      </CardBody>
    </Card>
  );
}

function SpeakingMaterial({ task, data }: { task: GradingData["tasks"][number]; data: GradingData }) {
  const c = task.content as SpeakingContent;
  return (
    <Card>
      <CardHeader title={`Enunciado · ${task.title}`} />
      <CardBody className="space-y-3 text-sm">
        {c.parts.map((p) => {
          const choice = data.responses.find((r) => r.task_id === task.id && r.item_key === `choice:${p.key}`)?.payload as { option_key?: string; auto_assigned?: boolean } | undefined;
          const opt = p.choice?.options.find((o) => o.key === choice?.option_key);
          return (
            <div key={p.key} className="rounded-md bg-surface-2 p-3">
              <RichText text={p.instructions} className="space-y-1" />
              {opt ? (
                <div className="mt-2">
                  <p className="font-medium">
                    Opción elegida: {opt.title} {choice?.auto_assigned ? <Badge tone="warn">asignada automáticamente</Badge> : null}
                  </p>
                  {opt.body ? <RichText text={opt.body} className="text-ink-2" /> : null}
                  {opt.bullets.length ? (
                    <ul className="list-disc pl-5">
                      {opt.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
        {task.transcript ? (
          <details>
            <summary className="cursor-pointer font-medium">Guion de las preguntas grabadas</summary>
            <p className="mt-2 whitespace-pre-wrap text-ink-2">{task.transcript}</p>
          </details>
        ) : null}
      </CardBody>
    </Card>
  );
}

function RecordingsCard({
  data,
  task,
  urls,
  readOnly,
  onMark,
}: {
  data: GradingData;
  task: GradingData["tasks"][number];
  urls: Record<string, string>;
  readOnly: boolean;
  onMark: (recordingId: string, ms: number) => void;
}) {
  const recs = data.recordings.filter((r) => r.task_id === task.id).sort((a, b) => `${a.part_key}${a.segment_key}`.localeCompare(`${b.part_key}${b.segment_key}`));
  const players = useRef<Record<string, HTMLAudioElement | null>>({});
  const [times, setTimes] = useState<Record<string, number>>({});
  const [transcripts, setTranscripts] = useState<Record<string, string>>(() => Object.fromEntries(recs.map((r) => [r.id, r.teacher_transcript])));
  const [saved, setSaved] = useState<string | null>(null);
  const [, start] = useTransition();
  if (recs.length === 0) return <Alert tone="warn" title="No hay grabaciones verificadas en esta tarea." />;
  return (
    <Card>
      <CardHeader title="Grabaciones" description="Pulse «Marcar momento» mientras escucha para comentar un punto concreto. La reproducción no se pierde al añadir observaciones." />
      <CardBody className="space-y-4">
        {recs.map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">
                Parte {r.part_key} · {r.segment_key}
              </span>
              <span className="text-ink-3">
                {formatDuration(r.duration_ms / 1000)} · {(r.size_bytes / 1024).toFixed(0)} KB · {r.status === "verified" ? "verificada" : r.status}
              </span>
            </div>
            {urls[r.id] ? (
              <audio
                ref={(el) => {
                  players.current[r.id] = el;
                }}
                src={urls[r.id]}
                controls
                preload="metadata"
                className="w-full"
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setTimes((x) => ({ ...x, [r.id]: t }));
                }}
              />
            ) : (
              <Alert tone="danger" title="No se pudo obtener el audio." />
            )}
            {!readOnly ? (
              <Button size="sm" variant="secondary" onClick={() => onMark(r.id, Math.round((players.current[r.id]?.currentTime ?? 0) * 1000))}>
                <Clock className="size-4" aria-hidden /> Marcar momento ({formatDuration(times[r.id] ?? 0)})
              </Button>
            ) : null}
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Transcripción revisada por la profesora (opcional)</span>
              <Textarea
                className="min-h-20 text-sm"
                value={transcripts[r.id] ?? ""}
                readOnly={readOnly}
                onChange={(e) => setTranscripts((t) => ({ ...t, [r.id]: e.target.value }))}
                placeholder="La plataforma no transcribe automáticamente: la evaluación se basa en la escucha."
              />
            </label>
            {!readOnly ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  start(async () => {
                    const res = await saveTranscript(data.attempt.id, r.id, transcripts[r.id] ?? "");
                    setSaved(res?.ok ? r.id : null);
                  })
                }
              >
                Guardar transcripción
              </Button>
            ) : null}
            {saved === r.id ? <span className="text-xs text-ok">Guardada</span> : null}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
