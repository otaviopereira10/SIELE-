"use client";

import { useRef, useState, type Ref } from "react";
import { Eye, RotateCcw } from "lucide-react";
import type { RecordingPlayerHandle } from "@/components/audio/recording-player";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import type { AiSuggestion } from "@/lib/ai/feedback";
import type { GradingData } from "@/lib/data/teacher";
import { SKILL_META } from "@/lib/exam/skills";
import { AiPanel } from "./ai-panel";
import { AnnotationForm, type AnnotationDraft } from "./annotation-form";
import { hasEmptyAudio, hasResponse, type EvaluationMeta, type EvaluationState, type Feedback, type GradingTask, type Rubric } from "./grading-model";
import { Observations } from "./observations";
import { RubricPanel, type RubricCriterion, type RubricPanelHandle } from "./rubric-panel";
import { SpeakingResponse } from "./speaking-response";
import { WritingResponse } from "./writing-response";

/** Una tarea: a la izquierda lo que hizo el estudiante; a la derecha, la evaluación, siempre a la vista. */
export function TaskGrader({
  data,
  task,
  recordingUrls,
  aiEnabled,
  readOnly,
  evaluationState,
  meta,
  onSaved,
  onRequestNew,
  next,
  ref,
}: {
  data: GradingData;
  task: GradingTask;
  recordingUrls: Record<string, string>;
  aiEnabled: boolean;
  readOnly: boolean;
  evaluationState: EvaluationState;
  meta: EvaluationMeta;
  onSaved: (state: EvaluationState, meta: EvaluationMeta) => void;
  onRequestNew: () => void;
  next: { label: string; onClick: () => void };
  ref?: Ref<RubricPanelHandle>;
}) {
  const attemptId = data.attempt.id;
  const ev = data.evaluations.find((e) => e.task_id === task.id) ?? null;
  const rubric: Rubric | undefined =
    data.rubrics.find((r) => r.id === ev?.rubric_version_id) ?? data.rubrics.find((r) => r.id === task.rubric_version_id) ?? data.rubrics.filter((r) => r.skill === task.skill && r.status === "published").at(-1);
  const criteria = (rubric?.criteria ?? []) as RubricCriterion[];
  const feedback = (ev?.teacher_feedback ?? []) as Feedback[];
  const [draft, setDraft] = useState<AnnotationDraft | null>(null);
  const [draftInitial, setDraftInitial] = useState<Parameters<typeof AnnotationForm>[0]["initial"]>(undefined);
  const [externalBand, setExternalBand] = useState<{ criterion: string; band: number; nonce: number } | null>(null);
  const players = useRef<Record<string, RecordingPlayerHandle | null>>({});
  const panel = useRef<RubricPanelHandle | null>(null);
  const answered = hasResponse(data, task);
  const emptyAudio = hasEmptyAudio(data, task.id);
  const isSpeaking = task.skill === "speaking";
  const aiLatest = data.aiSuggestions.find((a) => a.evaluation_id === ev?.id) as { id: string; model: string; status: string; created_at: string; suggestion: AiSuggestion } | undefined;
  const openResubmission = data.resubmissions.find((r) => r.task_id === task.id && r.status === "open");

  const form = (
    <AnnotationForm
      key={`${draft?.charStart}-${draft?.audioMs}-${draft?.quote}`}
      attemptId={attemptId}
      taskId={task.id}
      skill={task.skill}
      criteria={criteria}
      draft={draft as AnnotationDraft}
      initial={draftInitial}
      onDone={() => setDraft(null)}
    />
  );

  const assignZero = (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={emptyAudio ? "primary" : "secondary"} onClick={onRequestNew}>
        {emptyAudio ? "Pedir que vuelva a grabar" : isSpeaking ? "Pedir que la grabe" : "Pedir que la escriba"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => panel.current?.setAllBands(0)}>
        Puntuar con 0 todos los criterios
      </Button>
    </div>
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,1fr)]">
      <section aria-label="Respuesta del estudiante" className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-3">{SKILL_META[task.skill].label}</p>
            <h2 className="text-xl font-semibold tracking-tight text-ink">{task.title}</h2>
          </div>
          {!readOnly && answered ? (
            <Button size="sm" variant="ghost" onClick={onRequestNew}>
              <RotateCcw className="size-4" aria-hidden /> {isSpeaking ? "Pedir nueva grabación" : "Pedir nueva entrega"}
            </Button>
          ) : null}
        </header>

        {openResubmission ? (
          <Alert tone="warn" title="Esperando la nueva entrega del estudiante">
            {openResubmission.reason}
          </Alert>
        ) : !answered && !readOnly ? (
          <Alert tone={emptyAudio ? "danger" : "warn"} title={emptyAudio ? "Las grabaciones de esta tarea están vacías" : "El estudiante no respondió a esta tarea"}>
            <p className="mb-2">
              {emptyAudio
                ? "Su micrófono no envió sonido, así que no hay nada que evaluar. Lo más justo es pedirle que vuelva a grabar; la plataforma ya le avisa ahora si el micrófono no funciona."
                : "Puede puntuarla con 0 para poder publicar el resto, o pedirle que la haga."}
            </p>
            {assignZero}
          </Alert>
        ) : null}

        {isSpeaking ? (
          <SpeakingResponse
            data={data}
            task={task}
            feedback={feedback}
            readOnly={readOnly}
            urls={recordingUrls}
            players={players}
            onMark={(recordingId, ms) => {
              setDraftInitial(undefined);
              setDraft({ quote: "", charStart: null, charEnd: null, recordingId, audioMs: ms });
            }}
            renderForm={(recordingId) => (draft?.recordingId === recordingId ? form : null)}
            onRequestRecording={onRequestNew}
          />
        ) : (
          <WritingResponse
            data={data}
            task={task}
            feedback={feedback}
            readOnly={readOnly}
            onAnnotate={(d) => {
              setDraftInitial(undefined);
              setDraft(d);
            }}
            form={draft && !draft.recordingId ? form : null}
          />
        )}

        <Observations
          attemptId={attemptId}
          feedback={feedback}
          readOnly={readOnly}
          emptyHint={isSpeaking ? "Mientras escucha, pulse «Comentar este momento» o la tecla M. El estudiante las verá en su informe." : "Seleccione un fragmento del texto para añadir la primera. El estudiante las verá en su informe."}
          onSeek={(f) => {
            if (f.recording_id && f.audio_ms != null) players.current[f.recording_id]?.seek(f.audio_ms);
          }}
        />
      </section>

      <aside aria-label="Evaluación" className="min-w-0 space-y-4 lg:sticky lg:top-[5.25rem] lg:max-h-[calc(100dvh-6.25rem)] lg:overflow-y-auto lg:pr-1">
        {!isSpeaking && !readOnly && aiEnabled ? (
          <AiPanel
            attemptId={attemptId}
            taskId={task.id}
            latest={aiLatest ?? null}
            enabled={aiEnabled}
            onApplyBand={(criterion, band) => setExternalBand({ criterion, band, nonce: Date.now() })}
            onUseObservation={(o) => {
              const text = (data.responses.find((r) => r.task_id === task.id && r.item_key === "text")?.payload as { text?: string } | undefined)?.text ?? "";
              const idx = text.indexOf(o.quote);
              setDraftInitial({ kind: o.kind, category: o.category, explanation: o.explanation, correction: o.correction, improved: o.improved_example });
              setDraft({ quote: o.quote, charStart: idx >= 0 ? idx : null, charEnd: idx >= 0 ? idx + o.quote.length : null, recordingId: null, audioMs: null });
            }}
          />
        ) : null}
        {rubric ? (
          <RubricPanel
            ref={(handle) => {
              panel.current = handle;
              if (typeof ref === "function") ref(handle);
              else if (ref) (ref as { current: RubricPanelHandle | null }).current = handle;
            }}
            attemptId={attemptId}
            taskId={task.id}
            taskPosition={task.position}
            criteria={criteria}
            pointsTable={rubric.points_table as Record<string, Record<string, number[]>>}
            rubricTitle={`${rubric.title} (v${rubric.version_no})`}
            verification={rubric.verification}
            initial={evaluationState}
            meta={meta}
            readOnly={readOnly}
            externalBand={externalBand}
            onSaved={onSaved}
            next={next}
          />
        ) : (
          <Alert tone="danger" title="No hay una rúbrica publicada para esta destreza." />
        )}
        <p className="hidden items-center gap-1.5 text-xs text-ink-3 lg:flex">
          <Eye className="size-3.5" aria-hidden /> Nada es visible para el estudiante hasta que publique.
        </p>
      </aside>
    </div>
  );
}
