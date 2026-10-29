"use client";

import { useRef, useState } from "react";
import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichText, inline } from "@/components/ui/primitives";
import type { WritingContent } from "@/lib/exam/content-schema";
import { countWords, wordRangeStatus } from "@/lib/exam/words";
import { cn } from "@/lib/utils";
import type { TaskRendererProps } from "./types";

const SPANISH_KEYS = ["á", "é", "í", "ó", "ú", "ü", "ñ", "Á", "É", "Í", "Ó", "Ú", "Ñ", "¿", "¡", "«", "»"];

/** Tarea de expresión escrita: opción (si la hay), enunciado, estímulo, editor con contador y teclado español. */
export function WritingTask(props: TaskRendererProps) {
  const c = props.task.content as WritingContent;
  const saved = props.answers["text"];
  const savedText = saved && "text" in saved ? saved.text : "";
  const savedOption = saved && "text" in saved ? (saved.option_key ?? null) : null;
  const [text, setText] = useState(savedText);
  const [optionKey, setOptionKey] = useState<string | null>(savedOption);
  const [showKeys, setShowKeys] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const option = c.options?.find((o) => o.key === optionKey) ?? null;
  const bullets = option ? option.bullets : c.bullets;
  const stimulus = option ? option.stimulus : c.stimulus;
  const min = option ? option.word_min : c.word_min;
  const max = option ? option.word_max : c.word_max;
  const words = countWords(text);
  const status = wordRangeStatus(words, min, max);

  const update = (next: string) => {
    setText(next);
    props.onAnswer("text", { text: next, option_key: optionKey }, { debounceMs: 1200 });
  };

  const insert = (ch: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + ch + text.slice(end);
    update(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  if (c.options?.length && !option) {
    return (
      <div className="space-y-6">
        <RichText text={props.task.instructions} className="space-y-2 text-lg leading-relaxed" />
        <p className="font-medium">Elija una de las opciones. Una vez que empiece a escribir, la opción quedará fijada.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {c.options.map((o, i) => (
            <article key={o.key} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <p className="text-sm font-semibold text-ink-3">Opción {i + 1}</p>
              <h3 className="mt-1 text-lg font-semibold">{o.title}</h3>
              <RichText text={o.instructions} className="mt-2 flex-1 space-y-2 text-ink-2" />
              <Button
                className="mt-4 self-start"
                variant="exam"
                disabled={props.readOnly}
                onClick={() => {
                  setOptionKey(o.key);
                  props.onAnswer("text", { text, option_key: o.key });
                }}
              >
                Elegir opción {i + 1}
              </Button>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {option ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-lg">
            <strong>Opción {c.options!.findIndex((o) => o.key === option.key) + 1}.</strong> {option.title}
          </p>
          {!text.trim() && !props.readOnly ? (
            <Button variant="ghost" size="sm" onClick={() => setOptionKey(null)}>
              Cambiar de opción
            </Button>
          ) : null}
        </div>
      ) : null}
      <RichText text={option ? option.instructions : props.task.instructions} className="space-y-2 text-lg leading-relaxed" />
      {bullets.length ? (
        <ul className="ml-6 list-disc space-y-1 text-[1.02rem]">
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>
      ) : null}
      {stimulus ? (
        <article className="rounded-lg bg-surface-2 px-5 py-5 sm:px-7">
          {stimulus.title ? <h3 className="mb-3 text-center font-semibold tracking-wide uppercase">{stimulus.title}</h3> : null}
          <RichText text={stimulus.body} className="reading-text" />
        </article>
      ) : null}
      {min || max ? (
        <p className="rounded-md bg-surface-2 px-4 py-3 font-semibold text-accent">
          Número de palabras recomendado: {min && max ? `entre ${min} y ${max}` : min ? `al menos ${min}` : `hasta ${max}`}
        </p>
      ) : null}
      <div>
        <label htmlFor={`text-${props.task.id}`} className="sr-only">
          Escriba aquí su respuesta
        </label>
        <textarea
          id={`text-${props.task.id}`}
          ref={ref}
          value={text}
          readOnly={props.readOnly}
          onChange={(e) => update(e.target.value)}
          placeholder="Escriba aquí"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="sentences"
          className="min-h-[18rem] w-full resize-y rounded-lg border border-line-strong bg-surface px-4 py-3 text-[1.02rem] leading-relaxed focus:border-focus focus:ring-2 focus:ring-focus/30 focus:outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p
            className={cn(
              "text-sm",
              status === "within" && "text-ok",
              status === "below" && "text-warn",
              status === "above" && "text-danger",
            )}
            aria-live="polite"
          >
            Número de palabras escritas: <strong className="tabular-nums">{words}</strong>
            {status === "below" ? " · por debajo de lo recomendado" : status === "above" ? " · por encima de lo recomendado" : ""}
          </p>
          {c.keyboard !== false && !props.readOnly ? (
            <Button variant="exam" size="sm" onClick={() => setShowKeys((s) => !s)} aria-expanded={showKeys}>
              <Keyboard className="size-4" aria-hidden /> Teclado español
            </Button>
          ) : null}
        </div>
        {showKeys ? (
          <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 p-2" role="group" aria-label="Teclado español">
            {SPANISH_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(k)}
                className="flex size-11 items-center justify-center rounded-md border border-line-strong bg-surface text-lg hover:bg-brand-soft"
                aria-label={`Insertar ${k}`}
              >
                {k}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
