import Link from "next/link";
import { CheckCircle2, CircleSlash, Lightbulb, XCircle } from "lucide-react";
import { Alert, Badge, Card, CardBody, CardHeader, ProgressBar } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/diagnosis/taxonomy";
import type { Diagnosis } from "@/lib/diagnosis/engine";
import { LEVEL_LABEL, SKILL_META, formatDuration } from "@/lib/exam/skills";
import { objectivePercent, type LevelEstimate, type PublishedReport, type ReportSection } from "@/lib/results/report";
import { formatDate, formatNumber } from "@/lib/utils";
import { getModule } from "@/content/refuerzo";
import { AnnotatedText } from "./annotated-text";

const toneOf = (skill: string) => (skill === "writing" ? "blue" : skill === "speaking" ? "orange" : "gold") as "blue" | "orange" | "gold";

export function EstimateNote({ estimate, kind }: { estimate: LevelEstimate | null | undefined; kind: "objective" | "productive" }) {
  if (!estimate) return null;
  if (!estimate.applicable) {
    const reason =
      estimate.reason === "item_count_differs"
        ? "La tabla pública solo es válida para pruebas de 38 ítems; esta prueba tiene otro número de ítems."
        : estimate.reason === "max_points_differs"
          ? "La conversión pública exige la prueba completa con todas sus tareas."
          : estimate.reason === "incomplete"
            ? "Faltan tareas por evaluar."
            : "No hay una tabla de conversión verificada para esta prueba.";
    return <p className="text-xs text-ink-3">Sin estimación por tabla: {reason}</p>;
  }
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
      <p>
        Estimación de preparación: <strong>{LEVEL_LABEL[estimate.level ?? ""] ?? estimate.level}</strong>
        {kind === "objective" ? (
          <>
            {" "}
            · intervalo de referencia {formatNumber(estimate.min_points, 2)}–{formatNumber(estimate.max_points, 2)} puntos
          </>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-ink-3">
        Según {estimate.source_title} ({estimate.source_edition}). {estimate.verification === "verified_older_edition" ? "Edición antigua: vigencia pendiente de verificación." : ""} No es una nota oficial.
      </p>
    </div>
  );
}

function ObjectiveSection({ section, report }: { section: ReportSection; report: PublishedReport }) {
  const o = section.objective!;
  const pct = objectivePercent(o);
  const items = report.items.filter((i) => i.skill === section.skill);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-ok-soft px-4 py-3">
          <p className="text-xs text-ink-3">Aciertos</p>
          <p className="text-2xl font-semibold text-ok tabular-nums">{o.correct}</p>
        </div>
        <div className="rounded-lg bg-danger-soft px-4 py-3">
          <p className="text-xs text-ink-3">Errores</p>
          <p className="text-2xl font-semibold text-danger tabular-nums">{o.wrong}</p>
        </div>
        <div className="rounded-lg bg-surface-2 px-4 py-3">
          <p className="text-xs text-ink-3">Sin responder</p>
          <p className="text-2xl font-semibold tabular-nums">{o.blank}</p>
        </div>
        <div className="rounded-lg bg-brand-soft px-4 py-3">
          <p className="text-xs text-ink-3">Porcentaje de aciertos*</p>
          <p className="text-2xl font-semibold text-brand tabular-nums">{formatNumber(pct)} %</p>
        </div>
      </div>
      <p className="text-xs text-ink-3">* Estadística de entrenamiento: no se convierte en nota oficial.</p>
      <EstimateNote estimate={o.estimate} kind="objective" />
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold">Resultado por tarea</h4>
          <ul className="space-y-2">
            {o.by_task.map((t) => {
              const total = t.correct + t.wrong + t.blank;
              return (
                <li key={t.task_id}>
                  <div className="flex justify-between text-sm">
                    <span>{t.title}</span>
                    <span className="tabular-nums">
                      {t.correct}/{total}
                    </span>
                  </div>
                  <ProgressBar value={t.correct} max={total} tone={toneOf(section.skill)} label={`${t.title}: ${t.correct} de ${total}`} />
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold">Resultado por nivel de dificultad</h4>
          <ul className="space-y-2">
            {o.by_level
              .filter((l) => l.level !== "sin_nivel")
              .map((l) => (
                <li key={l.level}>
                  <div className="flex justify-between text-sm">
                    <span>{LEVEL_LABEL[l.level] ?? l.level}</span>
                    <span className="tabular-nums">
                      {l.correct}/{l.total}
                    </span>
                  </div>
                  <ProgressBar value={l.correct} max={l.total} tone="brand" label={`Nivel ${l.level}`} />
                </li>
              ))}
          </ul>
        </div>
      </div>
      {items.length ? (
        <details className="rounded-lg border border-line">
          <summary className="cursor-pointer px-4 py-3 font-medium">Revisar preguntas y explicaciones ({items.length})</summary>
          <ol className="divide-y divide-line">
            {items.map((i, idx) => (
              <li key={idx} className="px-4 py-3 text-sm">
                <p className="flex items-start gap-2">
                  {i.is_correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="Correcta" />
                  ) : i.answered ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Incorrecta" />
                  ) : (
                    <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="Sin responder" />
                  )}
                  <span>
                    <strong>
                      {i.task_title} · {i.question_position}.
                    </strong>{" "}
                    {i.prompt}
                  </span>
                </p>
                <p className="mt-1 ml-6 text-ink-2">
                  Su respuesta: {i.selected.length ? i.selected.map((s) => `${s.label ? `${s.label}) ` : ""}${s.body}`).join(" · ") : "—"}
                </p>
                {!i.is_correct ? <p className="ml-6 text-ink-2">Respuesta correcta: {i.correct.map((s) => `${s.label ? `${s.label}) ` : ""}${s.body}`).join(" · ")}</p> : null}
                {i.explanation ? <p className="mt-1 ml-6 text-ink-3">{i.explanation}</p> : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function ProductiveSection({ section, recordingUrls }: { section: ReportSection; recordingUrls?: Record<string, string> }) {
  const p = section.productive!;
  return (
    <div className="space-y-6">
      <EstimateNote estimate={p.estimate} kind="productive" />
      {p.tasks.map((t) => {
        const ev = t.evaluation;
        const feedback = ev?.feedback ?? [];
        return (
          <article key={t.task_id} className="space-y-4 rounded-xl border border-line p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">{t.title}</h4>
              {ev?.pedagogical_percent != null ? <Badge tone={toneOf(section.skill)}>Desempeño pedagógico: {formatNumber(ev.pedagogical_percent)} %</Badge> : null}
            </div>
            {t.response_text ? (
              <div className="rounded-lg bg-surface-2 p-4">
                <p className="mb-2 text-xs text-ink-3">Su texto · {t.word_count ?? 0} palabras</p>
                <AnnotatedText
                  text={t.response_text}
                  annotations={feedback.map((f, i) => ({ id: i, quote: f.quote, char_start: f.char_start, char_end: f.char_end, kind: f.kind }))}
                />
              </div>
            ) : null}
            {t.recordings.length ? (
              <ul className="space-y-2">
                {t.recordings.map((r) => {
                  const url = recordingUrls?.[`${t.task_id}/${r.part_key}/${r.segment_key}`];
                  return (
                    <li key={`${r.part_key}/${r.segment_key}`} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                      <p className="mb-1 text-ink-2">
                        Grabación {r.part_key}/{r.segment_key} · {formatDuration(r.duration_ms / 1000)}
                      </p>
                      {url ? <audio src={url} controls preload="none" className="w-full" /> : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {ev ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="text-left text-ink-3">
                        <th className="py-2 pr-3 font-medium">Criterio</th>
                        <th className="py-2 pr-3 font-medium">Peso</th>
                        <th className="py-2 pr-3 font-medium">Banda (0–5)</th>
                        <th className="py-2 font-medium">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ev.criteria.map((c) => (
                        <tr key={c.key} className="border-t border-line align-top">
                          <td className="py-2 pr-3 font-medium">{c.label}</td>
                          <td className="py-2 pr-3 tabular-nums">{c.weight} %</td>
                          <td className="py-2 pr-3">
                            <span className="text-lg font-semibold tabular-nums">{c.band ?? "—"}</span>
                            {c.band_descriptor ? <p className="text-xs text-ink-3">{c.band_descriptor}</p> : null}
                          </td>
                          <td className="py-2 text-ink-2">{c.comment || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {ev.global_comment || ev.strengths || ev.priorities || ev.next_steps ? (
                  <div className="grid gap-3 md:grid-cols-3">
                    {ev.strengths ? (
                      <div className="rounded-lg bg-ok-soft px-3 py-2 text-sm">
                        <p className="font-semibold text-ok">Lo que hizo bien</p>
                        <p className="mt-1 whitespace-pre-wrap text-ink-2">{ev.strengths}</p>
                      </div>
                    ) : null}
                    {ev.priorities ? (
                      <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm">
                        <p className="font-semibold text-danger">Errores prioritarios</p>
                        <p className="mt-1 whitespace-pre-wrap text-ink-2">{ev.priorities}</p>
                      </div>
                    ) : null}
                    {ev.next_steps ? (
                      <div className="rounded-lg bg-brand-soft px-3 py-2 text-sm">
                        <p className="font-semibold text-brand">Antes del próximo intento</p>
                        <p className="mt-1 whitespace-pre-wrap text-ink-2">{ev.next_steps}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {ev.global_comment ? <p className="rounded-lg border border-line px-3 py-2 text-sm whitespace-pre-wrap">{ev.global_comment}</p> : null}
                {feedback.length ? (
                  <ol className="space-y-2">
                    {feedback.map((f, i) => (
                      <li key={i} className="rounded-lg border border-line px-3 py-2 text-sm">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{i + 1}.</span>
                          <Badge tone={f.kind === "error" ? "danger" : f.kind === "strength" ? "ok" : "warn"}>
                            {f.kind === "error" ? "A mejorar" : f.kind === "strength" ? "Acierto" : "Sugerencia"}
                          </Badge>
                          <span className="text-ink-2">{categoryLabel(f.category)}</span>
                          {f.is_systematic ? <Badge tone="danger">Se repite</Badge> : null}
                          {f.audio_ms != null ? <span className="text-xs text-ink-3">en {formatDuration(f.audio_ms / 1000)}</span> : null}
                        </p>
                        {f.quote ? <p className="mt-1 italic">«{f.quote}»</p> : null}
                        {f.correction ? (
                          <p className="mt-1">
                            Corrección: <strong>{f.correction}</strong>
                          </p>
                        ) : null}
                        {f.explanation ? <p className="mt-1 text-ink-2">{f.explanation}</p> : null}
                        {f.improved_example ? <p className="mt-1 text-ink-2">Versión mejorada: «{f.improved_example}»</p> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </>
            ) : (
              <Alert tone="info" title="Pendiente de evaluación" />
            )}
          </article>
        );
      })}
    </div>
  );
}

export function ReportView({
  report,
  diagnosis,
  recordingUrls,
  moduleBase = "/estudiante/refuerzo",
}: {
  report: PublishedReport;
  diagnosis?: Diagnosis;
  recordingUrls?: Record<string, string>;
  moduleBase?: string;
}) {
  return (
    <div className="space-y-6">
      {report.scope === "objective_auto" ? (
        <Alert tone="info" title="Resultados parciales">
          Estas son las pruebas de comprensión, corregidas automáticamente. Las tareas de producción aparecerán cuando su profesora publique la evaluación.
        </Alert>
      ) : null}
      <p className="text-xs text-ink-3">{report.disclaimer}</p>

      {diagnosis && diagnosis.priorities.length ? (
        <Card>
          <CardHeader title="¿Qué debo estudiar ahora?" description="Tres prioridades calculadas a partir de este simulacro y de las correcciones anteriores." />
          <CardBody>
            <ol className="grid gap-4 md:grid-cols-3">
              {diagnosis.priorities.map((p, i) => (
                <li key={p.key} className="flex flex-col rounded-lg border border-line p-4">
                  <p className="text-sm text-ink-3">Prioridad {i + 1}</p>
                  <p className="font-semibold">{p.title}</p>
                  <p className="mt-1 text-sm text-ink-2">{p.why}</p>
                  {p.evidence.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-ink-3">
                      {p.evidence.slice(0, 2).map((e, j) => (
                        <li key={j}>{e}</li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-brand">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {p.indicator}
                  </p>
                  <div className="mt-auto pt-3">
                    {p.modules.map((m) => {
                      const mod = getModule(m);
                      return mod ? (
                        <Link key={m} href={`${moduleBase}/${m}`} className="text-sm font-medium text-brand underline">
                          Practicar: {mod.title}
                        </Link>
                      ) : null;
                    })}
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}

      {report.sections.map((s) => (
        <Card key={s.section_id}>
          <div className={`h-1.5 rounded-t-xl stripe-${SKILL_META[s.skill].tone}`} />
          <CardHeader title={SKILL_META[s.skill].label} />
          <CardBody>
            {s.objective ? <ObjectiveSection section={s} report={report} /> : null}
            {s.productive ? <ProductiveSection section={s} recordingUrls={recordingUrls} /> : null}
            {!s.objective && !s.productive ? <p className="text-sm text-ink-3">Pendiente de evaluación por su profesora.</p> : null}
          </CardBody>
        </Card>
      ))}

      {report.categories.length ? (
        <Card>
          <CardHeader title="Aspectos señalados en este simulacro" />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {report.categories.map((c) => (
                <li key={c.category}>
                  <Badge tone={c.systematic ? "danger" : "warn"}>
                    {categoryLabel(c.category)} · {c.count}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
      <p className="text-xs text-ink-3">
        Informe generado el {formatDate(report.generated_at)} · {report.attempt.exam_title} (versión {report.attempt.version_no}) · {report.attempt.format_label}
      </p>
    </div>
  );
}
