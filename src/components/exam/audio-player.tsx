"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Loader2, Play, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/exam/errors";
import { formatDuration } from "@/lib/exam/skills";
import type { MediaApi } from "./types";

type Phase = "idle" | "reading" | "loading" | "playing" | "between" | "after" | "done" | "blocked" | "error";

/**
 * Reproductor de comprensión auditiva.
 * - Modo pautado (formal): tiempo de lectura → 1.ª escucha → pausa → 2.ª escucha → tiempo final.
 * - Modo libre (práctica): el estudiante decide cuándo escuchar, hasta el máximo permitido.
 * Cada reproducción la registra el servidor antes de entregar la URL del audio.
 */
export function ListeningPlayer({
  media,
  mediaKey,
  timing,
  paced,
  label = "Audio de la tarea",
  onSequenceEnd,
}: {
  media: MediaApi;
  mediaKey: string;
  timing?: { read_seconds: number; between_seconds: number; after_seconds: number };
  paced: boolean;
  label?: string;
  onSequenceEnd?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (paced && media.maxPlays(mediaKey) > 0 && media.playsUsed(mediaKey) >= media.maxPlays(mediaKey) ? "done" : "idle"));
  const [countdown, setCountdown] = useState(0);
  const [plays, setPlays] = useState(media.playsUsed(mediaKey));
  const [synthetic, setSynthetic] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const max = media.maxPlays(mediaKey);
  const remaining = max > 0 ? Math.max(0, max - plays) : Infinity;
  const startedPaced = useRef(false);
  const endRef = useRef(onSequenceEnd);
  useEffect(() => {
    endRef.current = onSequenceEnd;
  }, [onSequenceEnd]);

  const runCountdown = useCallback((seconds: number, next: Phase) => {
    return new Promise<void>((resolve) => {
      if (seconds <= 0) return resolve();
      setPhase(next);
      setCountdown(seconds);
      const end = Date.now() + seconds * 1000;
      const id = window.setInterval(() => {
        const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        setCountdown(left);
        if (left <= 0) {
          window.clearInterval(id);
          resolve();
        }
      }, 250);
    });
  }, []);

  const playOnce = useCallback(async (): Promise<boolean> => {
    setError(null);
    setPhase("loading");
    try {
      const { url, synthetic: synth } = await media.requestAudio(mediaKey);
      setSynthetic(synth);
      setPlays((p) => p + 1);
      const el = audioRef.current!;
      el.src = url;
      setProgress(0);
      await new Promise<void>((resolve, reject) => {
        el.onended = () => resolve();
        el.onerror = () => reject(new Error("No se pudo reproducir el audio."));
        el.play()
          .then(() => setPhase("playing"))
          .catch((err) => {
            // el navegador puede bloquear la reproducción automática sin gesto del usuario
            if (err?.name === "NotAllowedError") {
              setPhase("blocked");
              reject(err);
            } else reject(err);
          });
      });
      return true;
    } catch (err) {
      if ((err as Error)?.name !== "NotAllowedError") {
        setError(errorMessage(err));
        setPhase("error");
      }
      return false;
    }
  }, [media, mediaKey]);

  const runPacedSequence = useCallback(async () => {
    const t = timing ?? { read_seconds: 30, between_seconds: 10, after_seconds: 30 };
    let used = media.playsUsed(mediaKey);
    if (used === 0) await runCountdown(t.read_seconds, "reading");
    while (max === 0 || used < max) {
      const ok = await playOnce();
      if (!ok) return;
      used++;
      if (max !== 0 && used < max) await runCountdown(t.between_seconds, "between");
      else break;
    }
    await runCountdown(t.after_seconds, "after");
    setPhase("done");
    endRef.current?.();
  }, [timing, media, mediaKey, max, runCountdown, playOnce]);

  useEffect(() => {
    if (paced && !startedPaced.current && phase === "idle") {
      startedPaced.current = true;
      // la secuencia actualiza el estado desde temporizadores y callbacks, no de forma síncrona
      const id = window.setTimeout(() => void runPacedSequence(), 0);
      return () => window.clearTimeout(id);
    }
  }, [paced, runPacedSequence, phase]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setProgress(el.duration ? el.currentTime / el.duration : 0);
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, []);

  const statusText: Record<Phase, string> = {
    idle: remaining === Infinity ? "Pulse para escuchar." : `Puede escuchar el audio ${remaining === 1 ? "una vez más" : `${remaining} veces`}.`,
    reading: `Tiempo para leer las preguntas: ${formatDuration(countdown)}`,
    loading: "Cargando audio…",
    playing: `Reproduciendo (escucha ${plays}${max ? ` de ${max}` : ""})…`,
    between: `La segunda escucha empieza en ${formatDuration(countdown)}`,
    after: `Tiempo para revisar sus respuestas: ${formatDuration(countdown)}`,
    done: "Ha completado las escuchas de este audio.",
    blocked: "El navegador ha bloqueado la reproducción automática. Pulse «Reproducir».",
    error: error ?? "Error de reproducción.",
  };

  return (
    <section aria-label={label} className="rounded-xl border border-line bg-surface-2 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-gold text-white" aria-hidden>
          {phase === "playing" ? <Volume2 className="size-5" /> : <Headphones className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{label}</p>
          <p className="text-sm text-ink-2" aria-live="polite">
            {statusText[phase]}
          </p>
        </div>
        {synthetic ? <Badge tone="warn">Voz sintética</Badge> : null}
        {!paced && phase !== "playing" && phase !== "loading" && remaining > 0 ? (
          <Button variant="secondary" onClick={() => void playOnce().then(() => setPhase("idle"))}>
            <Play className="size-4" aria-hidden /> Escuchar
          </Button>
        ) : null}
        {phase === "blocked" ? (
          <Button
            onClick={() => {
              void audioRef.current?.play().then(() => setPhase("playing"));
            }}
          >
            <Play className="size-4" aria-hidden /> Reproducir
          </Button>
        ) : null}
        {phase === "loading" ? <Loader2 className="size-5 animate-spin text-ink-3" aria-hidden /> : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
        <div className="h-full bg-gold transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      {/* Sin controles nativos para no permitir saltos ni repeticiones fuera de las autorizadas */}
      <audio ref={audioRef} preload="none" className="hidden" />
    </section>
  );
}

/** Reproduce una sola vez el enunciado oral de una pregunta (Tareas 1 y 4 de expresión oral). */
export function PromptAudio({ media, mediaKey, autoPlay, onEnded }: { media: MediaApi; mediaKey: string; autoPlay: boolean; onEnded?: () => void }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "done" | "error">("idle");
  const [plays, setPlays] = useState(media.playsUsed(mediaKey));
  const [synthetic, setSynthetic] = useState(false);
  const max = media.maxPlays(mediaKey);
  const started = useRef(false);
  const endRef = useRef(onEnded);
  useEffect(() => {
    endRef.current = onEnded;
  }, [onEnded]);

  const play = useCallback(async () => {
    setState("loading");
    try {
      const { url, synthetic: synth } = await media.requestAudio(mediaKey);
      setSynthetic(synth);
      setPlays((p) => p + 1);
      const el = ref.current!;
      el.src = url;
      el.onended = () => {
        setState("done");
        endRef.current?.();
      };
      await el.play();
      setState("playing");
    } catch {
      setState("error");
      endRef.current?.();
    }
  }, [media, mediaKey]);

  useEffect(() => {
    if (autoPlay && !started.current && media.playsUsed(mediaKey) === 0) {
      started.current = true;
      void play();
    }
  }, [autoPlay, play, media, mediaKey]);

  const canReplay = max === 0 || plays < max;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="sm" disabled={!canReplay || state === "playing" || state === "loading"} onClick={() => void play()}>
        <Play className="size-4" aria-hidden />
        {plays === 0 ? "Escuchar la pregunta" : "Escuchar otra vez"}
      </Button>
      <span className="text-sm text-ink-3">
        {state === "playing" ? "Reproduciendo…" : state === "error" ? "No se pudo reproducir el audio." : max ? `Escuchas: ${plays}/${max}` : null}
      </span>
      {synthetic ? <Badge tone="warn">Voz sintética</Badge> : null}
      <audio ref={ref} preload="none" className="hidden" />
    </div>
  );
}
