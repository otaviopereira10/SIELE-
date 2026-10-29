"use client";

import { Fragment, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { RichText, inline } from "@/components/ui/primitives";
import type {
  DropdownGapContent,
  FragmentGapContent,
  MatchingContent,
  MultiSelectContent,
  SingleChoiceContent,
} from "@/lib/exam/content-schema";
import type { RunnerOption, RunnerQuestion } from "@/lib/exam/types";
import { cn, paragraphs } from "@/lib/utils";
import { ListeningPlayer } from "./audio-player";
import { feedbackFor, optionOf, optionsOf, type TaskRendererProps } from "./types";

type TextBlock = NonNullable<SingleChoiceContent["texts"]>[number];

export function TaskIntro({ props }: { props: TaskRendererProps }) {
  const c = props.task.content as SingleChoiceContent;
  const image = c.image_key ? props.media.imageUrl(c.image_key) : undefined;
  return (
    <div className="space-y-4">
      <RichText text={props.task.instructions} className="space-y-2 text-lg leading-relaxed text-ink" />
      {c.intro ? <RichText text={c.intro} className="space-y-2 text-ink-2" /> : null}
      {c.audio_key ? (
        <ListeningPlayer
          media={props.media}
          mediaKey={c.audio_key}
          timing={c.timing}
          paced={props.mode === "formal" && !props.readOnly}
          onSequenceEnd={props.onTimedSequenceEnd}
        />
      ) : null}
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="Imagen de la tarea" className="max-h-[420px] w-full rounded-lg border border-line object-contain" />
      ) : null}
    </div>
  );
}

function TextCard({ block }: { block: TextBlock }) {
  return (
    <article className="rounded-lg bg-surface-2 px-5 py-5 sm:px-7">
      {block.label ? <p className="mb-1 text-sm font-semibold tracking-wide text-ink-3 uppercase">{block.label}</p> : null}
      {block.title ? <h3 className="mb-3 text-center text-base font-semibold tracking-wide uppercase">{block.title}</h3> : null}
      <RichText text={block.body} className="reading-text text-ink" />
      {block.source ? <p className="mt-3 text-right text-xs text-ink-3">({block.source})</p> : null}
    </article>
  );
}

function FeedbackNote({ props, question, renderOption }: { props: TaskRendererProps; question: RunnerQuestion; renderOption: (id: string) => string }) {
  const fb = feedbackFor(props.feedback, question.id);
  if (!fb) return null;
  return (
    <div className={cn("mt-2 rounded-lg border px-3 py-2 text-sm", fb.is_correct ? "border-ok/30 bg-ok-soft" : "border-danger/30 bg-danger-soft")}>
      <p className="flex items-center gap-1.5 font-medium">
        {fb.is_correct ? <CheckCircle2 className="size-4 text-ok" aria-hidden /> : <XCircle className="size-4 text-danger" aria-hidden />}
        {fb.is_correct ? "Correcta" : `Respuesta correcta: ${fb.correct_option_ids.map(renderOption).join(", ")}`}
      </p>
      {fb.explanation ? <p className="mt-1 text-ink-2">{fb.explanation}</p> : null}
    </div>
  );
}

function ChoiceList({ props, question }: { props: TaskRendererProps; question: RunnerQuestion }) {
  const selected = optionOf(props.answers[`q:${question.id}`]);
  const fb = feedbackFor(props.feedback, question.id);
  const name = `q-${question.id}`;
  return (
    <fieldset className="mt-0">
      <legend className="w-full rounded-md bg-surface-3 px-4 py-3 text-[1.02rem]">
        <span className="font-semibold">{question.position}.</span> {inline(question.prompt)}
      </legend>
      <div className="mt-2 space-y-1.5">
        {question.options.map((o) => {
          const checked = selected === o.id;
          const isKey = fb?.correct_option_ids.includes(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                checked ? "border-ink bg-surface shadow-sm" : "border-transparent hover:bg-surface-2",
                props.readOnly && "cursor-default",
                fb && isKey && "border-ok bg-ok-soft",
                fb && checked && !isKey && "border-danger bg-danger-soft",
              )}
            >
              <input
                type="radio"
                name={name}
                className="mt-1 size-5 shrink-0 accent-[var(--ink)]"
                checked={checked}
                disabled={props.readOnly}
                onChange={() => props.onAnswer(`q:${question.id}`, { option_id: o.id })}
              />
              <span className="leading-relaxed">{inline(o.body)}</span>
            </label>
          );
        })}
      </div>
      <FeedbackNote props={props} question={question} renderOption={(id) => question.options.find((o) => o.id === id)?.body ?? "?"} />
    </fieldset>
  );
}

export function SingleChoiceTask(props: TaskRendererProps) {
  const c = props.task.content as SingleChoiceContent;
  const texts = c.texts ?? [];
  const linked = new Set(texts.flatMap((t) => t.question_positions ?? []));
  const loose = props.questions.filter((q) => !linked.has(q.position));
  return (
    <div className="space-y-6">
      <TaskIntro props={props} />
      {texts.map((t) => (
        <div key={t.key} className="space-y-4">
          <TextCard block={t} />
          {props.questions
            .filter((q) => t.question_positions?.includes(q.position))
            .map((q) => (
              <ChoiceList key={q.id} props={props} question={q} />
            ))}
        </div>
      ))}
      {loose.map((q) => (
        <ChoiceList key={q.id} props={props} question={q} />
      ))}
    </div>
  );
}

function BankSelect({
  props,
  question,
  bank,
  used,
  placeholder = "--Elija--",
  className,
  ariaLabel,
}: {
  props: TaskRendererProps;
  question: RunnerQuestion;
  bank: RunnerOption[];
  used?: Set<string>;
  placeholder?: string;
  className?: string;
  ariaLabel: string;
}) {
  const value = optionOf(props.answers[`q:${question.id}`]) ?? "";
  const fb = feedbackFor(props.feedback, question.id);
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={props.readOnly}
      onChange={(e) => props.onAnswer(`q:${question.id}`, { option_id: e.target.value || null })}
      className={cn(
        "min-h-10 max-w-full rounded-md border border-line-strong bg-surface px-2 py-1.5 text-[0.95rem] italic data-[filled=true]:not-italic",
        value && "border-ink font-medium not-italic",
        fb && (fb.is_correct ? "border-ok bg-ok-soft" : "border-danger bg-danger-soft"),
        className,
      )}
      data-filled={Boolean(value)}
    >
      <option value="">{placeholder}</option>
      {bank.map((o) => (
        <option key={o.id} value={o.id} disabled={used?.has(o.id) && o.id !== value}>
          {o.label ? `${o.label}. ` : ""}
          {o.body.length > 140 ? `${o.body.slice(0, 137)}…` : o.body}
        </option>
      ))}
    </select>
  );
}

export function MatchingTask(props: TaskRendererProps) {
  const c = props.task.content as MatchingContent;
  const used = c.unique_use
    ? new Set(props.questions.map((q) => optionOf(props.answers[`q:${q.id}`])).filter((x): x is string => Boolean(x)))
    : undefined;
  return (
    <div className="space-y-6">
      <TaskIntro props={props} />
      {(c.texts ?? []).map((t) => (
        <TextCard key={t.key} block={t} />
      ))}
      <section className="rounded-lg border border-line bg-surface px-4 py-4">
        <h3 className="mb-2 font-semibold">{c.bank_title}</h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {props.bank.map((o) => (
            <li key={o.id} className={cn("rounded-md bg-surface-2 px-3 py-2 text-[0.95rem]", used?.has(o.id) && "text-ink-3 line-through decoration-ink-3/50")}>
              {o.label ? <span className="mr-1.5 font-semibold">{o.label}.</span> : null}
              {inline(o.body)}
            </li>
          ))}
        </ul>
        {c.unique_use ? <p className="mt-2 text-xs text-ink-3">Cada opción se puede usar una sola vez; sobran algunas.</p> : null}
      </section>
      <ol className="space-y-3">
        {props.questions.map((q) => (
          <li key={q.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <p className="leading-relaxed">
                <span className="font-semibold">{q.position}.</span> {inline(q.prompt)}
              </p>
              <BankSelect props={props} question={q} bank={props.bank} used={used} ariaLabel={`Respuesta a la pregunta ${q.position}`} className="md:w-72" />
            </div>
            <FeedbackNote props={props} question={q} renderOption={(id) => props.bank.find((o) => o.id === id)?.body ?? "?"} />
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Texto con marcadores [[n]] sustituidos por un control. */
function GappedText({ body, renderGap }: { body: string; renderGap: (n: number) => ReactNode }) {
  return (
    <div className="reading-text space-y-3">
      {paragraphs(body).map((p, i) => (
        <p key={i}>
          {p.split(/(\[\[\d+\]\])/g).map((part, j) => {
            const m = part.match(/^\[\[(\d+)\]\]$/);
            return m ? <Fragment key={j}>{renderGap(Number(m[1]))}</Fragment> : <Fragment key={j}>{inline(part)}</Fragment>;
          })}
        </p>
      ))}
    </div>
  );
}

export function DropdownGapTask(props: TaskRendererProps) {
  const c = props.task.content as DropdownGapContent;
  const byPos = new Map(props.questions.map((q) => [q.position, q]));
  return (
    <div className="space-y-6">
      <TaskIntro props={props} />
      <article className="rounded-lg bg-surface px-1 sm:px-2">
        {c.passage_title ? <h3 className="mb-3 text-center font-semibold tracking-wide uppercase">{c.passage_title}</h3> : null}
        <GappedText
          body={c.passage}
          renderGap={(n) => {
            const q = byPos.get(n);
            if (!q) return <span className="text-danger">[hueco {n}]</span>;
            return (
              <span className="mx-0.5 inline-flex items-center gap-1 align-baseline">
                <span className="text-xs font-semibold text-ink-3">{n}</span>
                <BankSelect props={props} question={q} bank={q.options} ariaLabel={`Hueco ${n}`} className="w-auto" />
              </span>
            );
          }}
        />
        {c.source ? <p className="mt-3 text-right text-xs text-ink-3">({c.source})</p> : null}
      </article>
      {props.feedback ? (
        <div className="space-y-2">
          {props.questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium">Hueco {q.position}</p>
              <FeedbackNote props={props} question={q} renderOption={(id) => q.options.find((o) => o.id === id)?.body ?? "?"} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FragmentGapTask(props: TaskRendererProps) {
  const c = props.task.content as FragmentGapContent;
  const byPos = new Map(props.questions.map((q) => [q.position, q]));
  const used = new Set(props.questions.map((q) => optionOf(props.answers[`q:${q.id}`])).filter((x): x is string => Boolean(x)));
  const bankFor = (positions?: number[]) => (positions?.length ? props.bank.filter((_, i) => positions.includes(i + 1)) : props.bank);
  return (
    <div className="space-y-8">
      <TaskIntro props={props} />
      {c.passages.map((p, idx) => {
        const bank = bankFor(p.bank_positions);
        return (
          <article key={p.key} className="space-y-3">
            <p className="font-semibold text-accent">Texto {idx + 1}</p>
            <section className="rounded-lg border border-line bg-surface-2 px-4 py-3">
              <h3 className="mb-2 text-sm font-semibold">{c.bank_title}</h3>
              <ul className="space-y-1.5">
                {bank.map((o) => (
                  <li key={o.id} className={cn("rounded-md bg-surface px-3 py-2 text-[0.95rem]", used.has(o.id) && "text-ink-3")}>
                    <span className="mr-1.5 font-semibold">{o.label}.</span>
                    {inline(o.body)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-3">Cada fragmento se usa una sola vez; sobra uno.</p>
            </section>
            {p.title ? <h3 className="text-center font-semibold tracking-wide uppercase">{p.title}</h3> : null}
            <GappedText
              body={p.body}
              renderGap={(n) => {
                const q = byPos.get(n);
                if (!q) return <span className="text-danger">[hueco {n}]</span>;
                return (
                  <span className="mx-0.5 inline-flex items-center gap-1">
                    <span className="text-xs font-semibold text-ink-3">{n}</span>
                    <BankSelect props={props} question={q} bank={bank} used={used} ariaLabel={`Fragmento para el hueco ${n}`} className="w-40 bg-accent-soft" />
                  </span>
                );
              }}
            />
            {p.source ? <p className="text-right text-xs text-ink-3">({p.source})</p> : null}
          </article>
        );
      })}
      {props.feedback
        ? props.questions.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium">Hueco {q.position}</p>
              <FeedbackNote props={props} question={q} renderOption={(id) => props.bank.find((o) => o.id === id)?.label ?? "?"} />
            </div>
          ))
        : null}
    </div>
  );
}

export function MultiSelectTask(props: TaskRendererProps) {
  const c = props.task.content as MultiSelectContent;
  const q = props.questions[0];
  if (!q) return <TaskIntro props={props} />;
  const selected = optionsOf(props.answers[`q:${q.id}`]);
  const fb = feedbackFor(props.feedback, q.id);
  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    if (next.length > q.max_selections) return;
    props.onAnswer(`q:${q.id}`, { option_ids: next });
  };
  return (
    <div className="space-y-6">
      <TaskIntro props={props} />
      {c.prompt ? <p className="font-medium">{c.prompt}</p> : null}
      <p className="text-sm text-ink-2" aria-live="polite">
        Seleccionadas: <strong>{selected.length}</strong> de {q.max_selections}
      </p>
      <ul className="grid gap-2 md:grid-cols-2">
        {props.bank.map((o) => {
          const checked = selected.includes(o.id);
          const isKey = fb?.correct_option_ids.includes(o.id);
          return (
            <li key={o.id}>
              <label
                className={cn(
                  "flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border px-4 py-3",
                  checked ? "border-ink bg-surface shadow-sm" : "border-line bg-surface hover:bg-surface-2",
                  fb && isKey && "border-ok bg-ok-soft",
                  fb && checked && !isKey && "border-danger bg-danger-soft",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-5 shrink-0 accent-[var(--ink)]"
                  checked={checked}
                  disabled={props.readOnly || (!checked && selected.length >= q.max_selections)}
                  onChange={() => toggle(o.id)}
                />
                <span>
                  <span className="mr-1 font-semibold">{o.label}.</span>
                  {inline(o.body)}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {fb?.explanation ? <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">{fb.explanation}</p> : null}
    </div>
  );
}
