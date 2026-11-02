"use client";

import { useEffect, useId, useState } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { formatDuration } from "@/lib/exam/skills";
import { countWords, wordRangeStatus } from "@/lib/exam/words";
import { cn } from "@/lib/utils";

const WORDS = {
  empty: { text: "Todavía no ha escrito nada", tone: "text-ink-3" },
  below: { text: "Le faltan palabras", tone: "text-warn" },
  within: { text: "Buena extensión", tone: "text-ok" },
  above: { text: "Se ha pasado un poco", tone: "text-warn" },
};

/**
 * Practicar la escritura con las condiciones del examen: enunciado, número de palabras y tiempo.
 * El borrador se queda en este dispositivo y no lo corrige nadie: para eso están los simulacros.
 */
export function WritingPad({ moduleKey, prompt }: { moduleKey: string; prompt: { text: string; minWords: number; maxWords: number; minutes: number; checklist: string[] } }) {
  const id = useId();
  const storageKey = `stp:escritura:${moduleKey}`;
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const words = countWords(text);
  const status = WORDS[wordRangeStatus(words, prompt.minWords, prompt.maxWords)];

  // el borrador se recupera después de montar: el servidor no puede conocerlo
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setText(window.localStorage.getItem(storageKey) ?? "");
      } catch {
        // sin acceso al almacenamiento del navegador, el borrador no se conserva
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, text);
    } catch {
      // sin acceso al almacenamiento del navegador, el borrador no se conserva
    }
  }, [loaded, storageKey, text]);

  const running = left !== null;
  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  return (
    <div className="space-y-3 rounded-lg border border-blue/30 bg-blue-soft p-4">
      <p className="font-medium">{prompt.text}</p>
      <p className="text-sm text-ink-2">
        {prompt.minWords}–{prompt.maxWords} palabras · {prompt.minutes} minutos
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <>
            <span role="timer" className={cn("font-semibold tabular-nums", left === 0 && "text-danger")}>
              {left === 0 ? "Se ha acabado el tiempo" : formatDuration(left ?? 0)}
            </span>
            <Button size="sm" variant="secondary" onClick={() => setLeft(null)}>
              <Square className="size-4" aria-hidden /> Parar el reloj
            </Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setLeft(prompt.minutes * 60)}>
            <Play className="size-4" aria-hidden /> Escribir con tiempo
          </Button>
        )}
      </div>
      <Textarea id={id} aria-label="Su texto" className="min-h-48 bg-surface" lang="es" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      <p className={cn("text-sm font-medium", status.tone)} role="status">
        {words} {words === 1 ? "palabra" : "palabras"} · {status.text}
      </p>
      <fieldset>
        <legend className="text-sm font-medium">Antes de darlo por terminado, compruebe:</legend>
        <ul className="mt-1 space-y-1 text-sm">
          {prompt.checklist.map((item) => (
            <li key={item}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5 size-4 shrink-0" />
                {item}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <p className="text-xs text-ink-3">Su texto se guarda solo en este dispositivo y nadie lo corrige. Para recibir la corrección de su profesora, escriba en un simulacro.</p>
    </div>
  );
}
