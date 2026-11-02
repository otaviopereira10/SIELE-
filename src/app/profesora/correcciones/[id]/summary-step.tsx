"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, ProgressBar } from "@/components/ui/primitives";
import type { GradingData } from "@/lib/data/teacher";
import { SKILL_META, SKILL_ORDER } from "@/lib/exam/skills";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import type { EvaluationMeta, GradingTask } from "./grading-model";

const EVENT_LABEL: Record<string, string> = {
  started: "Intento iniciado",
  resumed: "Intento reanudado",
  section_started: "Prueba iniciada",
  section_completed: "Prueba terminada",
  section_timed_out: "Tiempo agotado en una prueba",
  task_navigation: "Cambio de tarea",
  audio_play: "Reproducción de audio",
  recording_saved: "Grabación guardada",
  recording_empty: "Grabación sin sonido (no se envió)",
  recording_silent: "Grabación con muy poco sonido",
  submitted: "Intento enviado",
  visibility_hidden: "Ventana oculta o cambio de pestaña",
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

/** Último paso: de un vistazo qué falta, qué recibirá el estudiante y el botón de publicar. */
export function SummaryStep({
  data,
  tasks,
  metaOf,
  canGrade,
  pendingPublish,
  publishing,
  onOpenTask,
  onPublish,
}: {
  data: GradingData;
  tasks: GradingTask[];
  metaOf: (taskId: string) => EvaluationMeta;
  canGrade: boolean;
  /** Publicado, pero con cambios posteriores que el estudiante todavía no ve. */
  pendingPublish: boolean;
  publishing: boolean;
  onOpenTask: (taskId: string) => void;
  onPublish: () => void;
}) {
  const status = data.attempt.status as string;
  const missing = tasks.filter((t) => !metaOf(t.id).isComplete);
  const waiting = status === "resubmission_requested";
  const ready = canGrade && missing.length === 0 && !waiting;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <section className={cn("rounded-2xl p-5 sm:p-6", ready ? "bg-brand text-white" : "border border-line bg-surface")}>
        <h2 className="text-xl font-semibold tracking-tight">
          {status === "published" && !pendingPublish ? "Resultados publicados" : ready ? "Todo listo para publicar" : waiting ? "Esperando una nueva entrega" : status === "in_progress" ? "El intento sigue en curso" : `Faltan ${missing.length} ${missing.length === 1 ? "tarea" : "tareas"} por evaluar`}
        </h2>
        <p className={cn("mt-1 max-w-2xl", ready ? "text-white/85" : "text-ink-2")}>
          {status === "published" && !pendingPublish
            ? `El estudiante ya puede ver su informe desde el ${formatDateTime(data.attempt.published_at)}. Si cambia algo, podrá volver a publicar.`
            : ready
              ? "El estudiante verá las bandas, sus comentarios, las observaciones y las recomendaciones. Podrá corregir y volver a publicar más adelante."
              : waiting
                ? "Podrá publicar cuando el estudiante envíe lo que le ha pedido."
                : status === "in_progress"
                  ? "Podrá evaluarlo cuando el estudiante lo envíe o venza el tiempo."
                  : "Evalúe las tareas que aparecen a continuación. Lo que ya ha evaluado está guardado."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {ready ? (
            <Button variant="secondary" disabled={publishing} onClick={onPublish} className="border-transparent">
              <Send className="size-4" aria-hidden /> {publishing ? "Publicando…" : status === "published" ? "Volver a publicar" : "Publicar resultados"}
            </Button>
          ) : null}
          {status === "published" ? (
            <Link href={`/profesora/informes/${data.attempt.id}`} className={cn("inline-flex items-center gap-2 text-sm font-medium underline", ready ? "text-white" : "text-brand")}>
              <FileText className="size-4" aria-hidden /> Ver el informe publicado
            </Link>
          ) : null}
        </div>
      </section>

      {tasks.length ? (
        <section aria-label="Tareas evaluadas por la profesora">
          <h3 className="mb-2 font-semibold text-ink">Expresión: su evaluación</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {tasks.map((t) => {
              const meta = metaOf(t.id);
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpenTask(t.id)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
                    <span className="flex items-center gap-3">
                      {meta.isComplete ? <CheckCircle2 className="size-5 text-ok" aria-hidden /> : <CircleDashed className="size-5 text-ink-3" aria-hidden />}
                      <span>
                        <span className="font-medium text-ink">{t.title}</span>
                        <span className="ml-2 text-sm text-ink-3">{SKILL_META[t.skill].short}</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-3 text-sm text-ink-2 tabular-nums">
                      {meta.isComplete ? `${formatNumber(meta.points, 2)} / ${formatNumber(meta.max, 2)} puntos` : meta.started ? "En curso" : "Sin empezar"}
                      <ArrowRight className="size-4 text-ink-3" aria-hidden />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <Alert tone="info" title="Este intento no incluye tareas de expresión: se corrige automáticamente." />
      )}

      {data.scores.length ? (
        <section aria-label="Corrección automática">
          <h3 className="mb-2 font-semibold text-ink">Comprensión: corrección automática</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...data.scores].sort((a, b) => SKILL_ORDER.indexOf(a.skill as "reading") - SKILL_ORDER.indexOf(b.skill as "reading")).map((s) => {
              const total = s.correct + s.wrong + s.blank;
              return (
                <div key={s.section_id} className="rounded-2xl border border-line bg-surface p-4">
                  <p className="font-medium text-ink">{SKILL_META[s.skill as "reading"].label}</p>
                  <p className="mt-1 text-2xl font-semibold text-ink tabular-nums">
                    {s.correct} <span className="text-base font-normal text-ink-3">de {total} aciertos</span>
                  </p>
                  <div className="mt-2">
                    <ProgressBar value={s.correct} max={total} tone="gold" label="Aciertos" />
                  </div>
                  <p className="mt-2 text-sm text-ink-3 tabular-nums">
                    {s.wrong} errores · {s.blank} sin responder
                  </p>
                  <details className="mt-1 text-sm text-ink-3">
                    <summary className="cursor-pointer hover:text-ink">Por tarea</summary>
                    <ul className="mt-1 space-y-0.5 tabular-nums">
                      {(s.by_task as { position: number; correct: number; wrong: number; blank: number }[]).map((t) => (
                        <li key={t.position}>
                          Tarea {t.position}: {t.correct}/{t.correct + t.wrong + t.blank}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <details className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium text-ink">Registro del intento e historial</summary>
        <div className="mt-3 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-1 font-medium text-ink">Eventos del intento</p>
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {data.events.map((e, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-line py-1">
                  <span>{EVENT_LABEL[e.event_type] ?? e.event_type}</span>
                  <span className="shrink-0 text-ink-3">{formatDateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-ink">Cambios en la evaluación</p>
            {data.history.length === 0 ? (
              <p className="text-ink-3">Sin cambios todavía.</p>
            ) : (
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {data.history.map((h, i) => {
                  const t = tasks.find((x) => x.id === data.evaluations.find((e) => e.id === h.evaluation_id)?.task_id);
                  const snap = h.snapshot as { scores?: { band: number | null }[] };
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
          </div>
        </div>
      </details>
    </div>
  );
}
