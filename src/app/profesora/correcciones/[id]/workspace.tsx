"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, ClipboardList, Lock, MoreHorizontal, Send, TriangleAlert, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import type { GradingData } from "@/lib/data/teacher";
import { SKILL_META } from "@/lib/exam/skills";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { annulAttempt, publishResults, requestResubmission, setAttemptLock } from "../../actions";
import { hasEmptyAudio, hasResponse, metaFromEvaluation, stateFromEvaluation, type EvaluationMeta, type EvaluationState, type GradingTask } from "./grading-model";
import type { RubricPanelHandle } from "./rubric-panel";
import { SummaryStep } from "./summary-step";
import { TaskGrader } from "./task-grader";

const SUMMARY = "resumen";

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "En curso", cls: "bg-brand-soft text-brand" },
  submitted: { label: "Pendiente de corrección", cls: "bg-warn-soft text-warn" },
  published: { label: "Publicado", cls: "bg-ok-soft text-ok" },
  resubmission_requested: { label: "Nueva entrega solicitada", cls: "bg-danger-soft text-danger" },
  annulled: { label: "Anulado", cls: "bg-surface-2 text-ink-2" },
  expired: { label: "Caducado", cls: "bg-surface-2 text-ink-2" },
};

/**
 * Corrección de un intento en pasos: se recorre tarea a tarea (la evaluación se guarda sola)
 * y se termina en un resumen desde el que se publica.
 */
export function GradingWorkspace({ data, recordingUrls, aiEnabled }: { data: GradingData; recordingUrls: Record<string, string>; aiEnabled: boolean }) {
  const attemptId = data.attempt.id;
  const status = data.attempt.status as string;
  const tasks = data.tasks;
  const canGrade = ["submitted", "published", "resubmission_requested"].includes(status);

  // lo evaluado en esta sesión manda sobre lo que llegó al cargar la página
  const [local, setLocal] = useState<Record<string, { state: EvaluationState; meta: EvaluationMeta }>>({});
  const metaOf = useCallback((taskId: string) => local[taskId]?.meta ?? metaFromEvaluation(data.evaluations.find((e) => e.task_id === taskId)), [local, data.evaluations]);
  const stateOf = (taskId: string) => local[taskId]?.state ?? stateFromEvaluation(data.evaluations.find((e) => e.task_id === taskId));

  const [step, setStep] = useState<string>(() => (canGrade ? (tasks.find((t) => !metaFromEvaluation(data.evaluations.find((e) => e.task_id === t.id)).isComplete)?.id ?? SUMMARY) : SUMMARY));
  const task = tasks.find((t) => t.id === step) ?? null;
  const grader = useRef<RubricPanelHandle | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [dialog, setDialog] = useState<null | "resubmit" | "annul" | "more">(null);
  const [reason, setReason] = useState("");

  const evaluated = tasks.filter((t) => metaOf(t.id).isComplete).length;
  const pendingPublish = status === "published" && tasks.some((t) => metaOf(t.id).status === "draft");

  const goTo = async (next: string) => {
    if (grader.current && !(await grader.current.flush())) return;
    setNotice(null);
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string } | null>, after?: () => void) =>
    start(async () => {
      try {
        const res = await fn();
        setNotice(res?.ok ? { ok: true, text: res.message ?? "Hecho." } : { ok: false, text: res?.error ?? "No se pudo completar la operación." });
        if (res?.ok) after?.();
      } catch {
        setNotice({ ok: false, text: "Sin conexión con el servidor. Inténtelo de nuevo." });
      }
      setDialog(null);
      setReason("");
    });

  const publish = async () => {
    if (grader.current && !(await grader.current.flush())) return;
    run(
      () => publishResults(attemptId),
      () => setLocal((all) => Object.fromEntries(Object.entries(all).map(([k, v]) => [k, { ...v, meta: { ...v.meta, status: "published" } }]))),
    );
  };

  const openResubmit = () => {
    if (task) {
      setReason(
        task.skill === "speaking" && hasEmptyAudio(data, task.id)
          ? "Tu micrófono no envió sonido en esta tarea y no he podido escucharte. Comprueba el micrófono y vuelve a grabarla, por favor."
          : "",
      );
    }
    setDialog("resubmit");
  };

  const groups = (["writing", "speaking"] as const).map((skill) => ({ skill, items: tasks.filter((t) => t.skill === skill) })).filter((g) => g.items.length);
  const taskIndex = task ? tasks.indexOf(task) : -1;
  const nextTask = taskIndex >= 0 ? tasks[taskIndex + 1] : null;
  const st = STATUS_LABEL[status] ?? { label: status, cls: "bg-surface-2 text-ink-2" };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-[4.4rem] z-20 border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:top-0 xl:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link href="/profesora/correcciones" aria-label="Volver a correcciones" className="flex size-10 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-lg leading-tight font-semibold tracking-tight text-ink">
              <span className="truncate">{data.student.full_name || data.student.email}</span>
              <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", st.cls)}>{st.label}</span>
            </h1>
            <p className="truncate text-sm text-ink-3">
              {data.assignment.title} · {data.attempt.mode === "formal" ? "simulacro formal" : "práctica"} · enviado {formatDateTime(data.attempt.submitted_at)}
              {data.student.target_level ? ` · objetivo ${data.student.target_level}` : ""}
            </p>
          </div>
          {tasks.length ? (
            <div className="hidden w-44 sm:block" aria-label={`${evaluated} de ${tasks.length} tareas evaluadas`}>
              <p className="mb-1 text-right text-xs text-ink-2 tabular-nums">
                {evaluated} de {tasks.length} evaluadas
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full rounded-full bg-ok transition-[width]" style={{ width: `${(evaluated / tasks.length) * 100}%` }} />
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            {canGrade ? (
              <Button onClick={() => void goTo(SUMMARY)} variant={step === SUMMARY ? "secondary" : "primary"}>
                <Send className="size-4" aria-hidden /> {status === "published" ? "Revisar y publicar" : "Publicar"}
              </Button>
            ) : null}
            <button type="button" aria-label="Más acciones" onClick={() => setDialog("more")} className="flex size-11 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
              <MoreHorizontal className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <div className="px-4 py-5 sm:px-6 xl:px-8 min-[1400px]:grid min-[1400px]:grid-cols-[13.5rem_minmax(0,1fr)] min-[1400px]:gap-6">
        <nav aria-label="Pasos de la corrección" className="mb-5 min-[1400px]:sticky min-[1400px]:top-[5.25rem] min-[1400px]:mb-0 min-[1400px]:self-start">
          <div className="flex gap-4 overflow-x-auto pb-1 min-[1400px]:block min-[1400px]:space-y-4 min-[1400px]:overflow-visible min-[1400px]:pb-0">
            {groups.map((g) => (
              <div key={g.skill} className="shrink-0">
                <p className={cn("mb-1 flex items-center gap-2 text-xs font-medium text-ink-3 min-[1400px]:px-2")}>
                  <span className={cn("size-2 rounded-full", g.skill === "writing" ? "bg-blue" : "bg-orange")} aria-hidden />
                  {SKILL_META[g.skill].short}
                </p>
                <ul className="flex gap-1 min-[1400px]:block min-[1400px]:space-y-0.5">
                  {g.items.map((t) => (
                    <RailItem key={t.id} data={data} task={t} meta={metaOf(t.id)} current={t.id === step} onClick={() => void goTo(t.id)} />
                  ))}
                </ul>
              </div>
            ))}
            <div className="shrink-0 min-[1400px]:border-t min-[1400px]:border-line min-[1400px]:pt-3">
              <p className="mb-1 text-xs font-medium text-transparent select-none min-[1400px]:hidden" aria-hidden>
                ·
              </p>
              <button
                type="button"
                aria-current={step === SUMMARY ? "step" : undefined}
                onClick={() => void goTo(SUMMARY)}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors",
                  step === SUMMARY ? "bg-brand text-white" : "text-ink hover:bg-surface-2",
                )}
              >
                <ClipboardList className="size-4" aria-hidden /> Resumen y publicar
              </button>
            </div>
          </div>
        </nav>

        <div className="min-w-0">
          {notice ? (
            <div className="mb-4">
              <Alert tone={notice.ok ? "ok" : "danger"} title={notice.text} />
            </div>
          ) : null}
          {task ? (
            <TaskGrader
              key={task.id}
              ref={grader}
              data={data}
              task={task}
              recordingUrls={recordingUrls}
              aiEnabled={aiEnabled}
              readOnly={!canGrade}
              evaluationState={stateOf(task.id)}
              meta={metaOf(task.id)}
              onSaved={(state, meta) => setLocal((all) => ({ ...all, [task.id]: { state, meta } }))}
              onRequestNew={openResubmit}
              next={nextTask ? { label: `Pasar a ${SKILL_META[nextTask.skill].short.toLowerCase()} · ${nextTask.title}`, onClick: () => void goTo(nextTask.id) } : { label: "Ir al resumen y publicar", onClick: () => void goTo(SUMMARY) }}
            />
          ) : (
            <SummaryStep
              data={data}
              tasks={tasks}
              metaOf={metaOf}
              canGrade={canGrade}
              pendingPublish={pendingPublish}
              publishing={pending}
              onOpenTask={(id) => void goTo(id)}
              onPublish={() => void publish()}
            />
          )}
        </div>
      </div>

      <Dialog
        open={dialog === "resubmit"}
        onOpenChange={(o) => !o && setDialog(null)}
        title={task?.skill === "speaking" ? "Pedir una nueva grabación" : "Pedir una nueva entrega"}
        description={
          task?.skill === "speaking"
            ? "El estudiante volverá a grabar esta tarea (si hay grabaciones vacías, solo esas) y le pedirá antes comprobar el micrófono. La evaluación de la tarea vuelve a borrador."
            : "El estudiante podrá reescribir solo este texto. La evaluación de la tarea vuelve a borrador."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              Cancelar
            </Button>
            <Button
              disabled={pending || reason.trim().length < 3 || !task}
              onClick={() => {
                if (task) run(() => requestResubmission(attemptId, task.id, reason));
              }}
            >
              Enviar la petición
            </Button>
          </>
        }
      >
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo e indicaciones para el estudiante" aria-label="Motivo" />
      </Dialog>

      <Dialog
        open={dialog === "more"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Más acciones"
        footer={
          <Button variant="secondary" onClick={() => setDialog(null)}>
            Cerrar
          </Button>
        }
      >
        <div className="space-y-2">
          {status === "in_progress" ? (
            <Button variant="secondary" className="w-full justify-start" disabled={pending} onClick={() => run(() => setAttemptLock(attemptId, !data.attempt.locked_by_teacher))}>
              {data.attempt.locked_by_teacher ? <Unlock className="size-4" aria-hidden /> : <Lock className="size-4" aria-hidden />}
              {data.attempt.locked_by_teacher ? "Desbloquear el intento" : "Bloquear el intento"}
            </Button>
          ) : null}
          {status !== "published" && status !== "annulled" ? (
            <>
              <p className="text-sm text-ink-2">Un intento anulado no cuenta para el número máximo de intentos. Indique el motivo: queda en el registro de auditoría.</p>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo de la anulación" aria-label="Motivo de la anulación" className="min-h-20" />
              <Button variant="danger" className="w-full" disabled={pending || reason.trim().length < 3} onClick={() => run(() => annulAttempt(attemptId, reason))}>
                <Ban className="size-4" aria-hidden /> Anular el intento
              </Button>
            </>
          ) : (
            <p className="text-sm text-ink-3">No hay más acciones disponibles para un intento en este estado.</p>
          )}
        </div>
      </Dialog>
    </div>
  );
}

function RailItem({ data, task, meta, current, onClick }: { data: GradingData; task: GradingTask; meta: EvaluationMeta; current: boolean; onClick: () => void }) {
  const noAnswer = !hasResponse(data, task);
  const empty = hasEmptyAudio(data, task.id);
  const open = data.resubmissions.some((r) => r.task_id === task.id && r.status === "open");
  return (
    <li>
      <button
        type="button"
        aria-current={current ? "step" : undefined}
        onClick={onClick}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg px-2.5 text-sm whitespace-nowrap transition-colors",
          current ? "bg-brand font-medium text-white" : "text-ink hover:bg-surface-2",
        )}
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border",
            meta.isComplete ? "border-ok bg-ok text-white" : meta.started ? "border-warn bg-warn-soft" : current ? "border-white/60" : "border-line-strong",
          )}
          aria-hidden
        >
          {meta.isComplete ? <Check className="size-3.5" /> : meta.started ? <span className="size-2 rounded-full bg-warn" /> : null}
        </span>
        <span className="flex-1 text-left">{task.title}</span>
        {open ? (
          <span className={cn("text-xs", current ? "text-white/85" : "text-ink-3")}>espera</span>
        ) : empty || noAnswer ? (
          <TriangleAlert className={cn("size-3.5 shrink-0", current ? "text-white/85" : "text-warn")} aria-label={empty ? "Grabaciones vacías" : "Sin respuesta"} />
        ) : meta.isComplete ? (
          <span className={cn("text-xs tabular-nums", current ? "text-white/85" : "text-ink-3")}>{formatNumber(meta.points, 1)}</span>
        ) : null}
      </button>
    </li>
  );
}
