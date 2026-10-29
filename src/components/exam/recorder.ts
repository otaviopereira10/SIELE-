"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Formatos preferidos: Opus/WebM (Chrome, Edge, Firefox) y AAC/MP4 (Safari en iPad e iPhone). */
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

export function baseMime(type: string): string {
  return type.split(";")[0].trim() || "audio/webm";
}

export function extensionFor(type: string): string {
  const base = baseMime(type);
  if (base === "audio/mp4" || base === "audio/x-m4a" || base === "audio/aac") return "mp4";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/wav") return "wav";
  return "webm";
}

export function micErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name ?? "";
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "El micrófono solo funciona en una conexión segura (https). Abra la plataforma desde su dirección https.";
  }
  if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return "Este navegador no permite grabar audio. Use una versión actual de Safari, Chrome, Edge o Firefox.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "El navegador ha bloqueado el micrófono. Pulse el icono del candado o de «aA» junto a la dirección, permita el micrófono y vuelva a intentarlo.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No se detecta ningún micrófono conectado.";
  if (name === "NotReadableError") return "El micrófono está siendo usado por otra aplicación. Ciérrela y vuelva a intentarlo.";
  return "No se pudo acceder al micrófono.";
}

let sharedStream: Promise<MediaStream> | null = null;

/** Un único permiso de micrófono para toda la prueba (evita avisos repetidos). */
export function getMicStream(): Promise<MediaStream> {
  if (!sharedStream) {
    sharedStream = navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .catch((err) => {
        sharedStream = null;
        throw err;
      });
  }
  return sharedStream;
}

export function releaseMicStream() {
  void sharedStream?.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => undefined);
  sharedStream = null;
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type RecorderState = "idle" | "starting" | "recording" | "stopped" | "error";

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const raf = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  const stopMeter = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setState("starting");
    try {
      const mime = pickMimeType();
      if (!mime) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
      const stream = await getMicStream();
      const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };
      rec.start(1000);
      recRef.current = rec;
      startedAt.current = performance.now();
      setState("recording");

      // medidor de nivel para confirmar que el micrófono capta sonido
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        ctxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const loop = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          raf.current = requestAnimationFrame(loop);
        };
        loop();
      }
    } catch (err) {
      setError(micErrorMessage(err));
      setState("error");
      throw err;
    }
  }, []);

  const stop = useCallback(async (): Promise<{ blob: Blob; durationMs: number }> => {
    const rec = recRef.current;
    if (!rec) throw new Error("No hay ninguna grabación en curso.");
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    if (rec.state !== "inactive") rec.stop();
    await done;
    stopMeter();
    const durationMs = Math.round(performance.now() - startedAt.current);
    const blob = new Blob(chunks.current, { type: baseMime(rec.mimeType) });
    recRef.current = null;
    setState("stopped");
    if (blob.size === 0) throw new Error("La grabación está vacía.");
    return { blob, durationMs };
  }, [stopMeter]);

  useEffect(
    () => () => {
      stopMeter();
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    },
    [stopMeter],
  );

  return { state, error, level, start, stop };
}
