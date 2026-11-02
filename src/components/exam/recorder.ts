"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Formatos preferidos: Opus/WebM (Chrome, Edge, Firefox) y AAC/MP4 (Safari en iPad e iPhone). */
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** Por debajo de este tamaño el archivo solo tiene cabeceras: el micrófono no ha entregado sonido. */
export const MIN_RECORDING_BYTES = 512;
/** Nivel máximo por debajo del cual se considera que no se ha captado voz (0 a 1). */
export const SILENCE_PEAK = 0.03;
/** Si en este tiempo el micrófono no ha entregado ningún dato, se intenta recuperar la señal. */
const NO_SIGNAL_MS = 2500;

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

/** El micrófono no ha entregado sonido: el archivo no tiene audio y no debe enviarse. */
export class EmptyRecordingError extends Error {
  constructor() {
    super("recording_empty");
    this.name = "EmptyRecordingError";
  }
}

const DEVICE_KEY = "stp:mic-device";
let sharedStream: Promise<MediaStream> | null = null;
/** Sin procesado de voz: se usa si con él el dispositivo no entrega sonido. */
let plainAudio = false;

export function preferredMic(): string {
  try {
    return localStorage.getItem(DEVICE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setPreferredMic(deviceId: string) {
  try {
    if (deviceId) localStorage.setItem(DEVICE_KEY, deviceId);
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    // sin almacenamiento se usa el micrófono predeterminado
  }
  releaseMicStream();
}

export async function listMicrophones(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "audioinput" && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `Micrófono ${i + 1}` }));
}

function requestStream(deviceId: string): Promise<MediaStream> {
  const processing = plainAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false } : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
  return navigator.mediaDevices.getUserMedia({ audio: { ...processing, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } });
}

/** Un único permiso de micrófono para toda la prueba; se vuelve a pedir si la pista dejó de estar activa. */
export async function getMicStream(): Promise<MediaStream> {
  if (sharedStream) {
    const current = await sharedStream.catch(() => null);
    if (current?.getAudioTracks().some((t) => t.readyState === "live")) return current;
    sharedStream = null;
  }
  const deviceId = preferredMic();
  sharedStream = requestStream(deviceId).catch((err) => {
    // el micrófono elegido ya no está conectado: se usa el predeterminado
    if (deviceId && (err?.name === "OverconstrainedError" || err?.name === "NotFoundError")) {
      setPreferredMic("");
      return requestStream("");
    }
    throw err;
  });
  try {
    return await sharedStream;
  } catch (err) {
    sharedStream = null;
    throw err;
  }
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

export interface RecordingResult {
  blob: Blob;
  durationMs: number;
  /** Nivel máximo detectado (0 a 1); null si el navegador no permitió medirlo. */
  peak: number | null;
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  /** El micrófono sigue sin entregar datos después de intentar recuperarlo. */
  const [noSignal, setNoSignal] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const raf = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const peak = useRef(0);
  const metered = useRef(false);
  const watchdog = useRef<number | null>(null);
  const starting = useRef(false);

  const stopMeter = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    void ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setLevel(0);
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdog.current) window.clearTimeout(watchdog.current);
    watchdog.current = null;
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    // medidor de nivel para confirmar que el micrófono capta sonido
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    // la grabación automática empieza sin gesto del usuario: el contexto puede nacer suspendido
    void ctx.resume().catch(() => undefined);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    let lastPaint = 0;
    const loop = (t: number) => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (const v of data) sum += ((v - 128) / 128) ** 2;
      const value = Math.min(1, Math.sqrt(sum / data.length) * 4);
      if (ctx.state === "running") metered.current = true;
      if (value > peak.current) peak.current = value;
      if (t - lastPaint > 80) {
        lastPaint = t;
        setLevel(value);
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  }, []);

  const beginRecorder = useCallback((stream: MediaStream, mime: string) => {
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 });
    chunks.current = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };
    rec.start(1000);
    recRef.current = rec;
    startedAt.current = performance.now();
    return rec;
  }, []);

  const start = useCallback(async () => {
    if (starting.current || recRef.current) return;
    starting.current = true;
    setError(null);
    setNoSignal(false);
    setState("starting");
    peak.current = 0;
    metered.current = false;
    try {
      const mime = pickMimeType();
      if (!mime) throw Object.assign(new Error("unsupported"), { name: "NotSupportedError" });
      const stream = await getMicStream();
      beginRecorder(stream, mime);
      setState("recording");
      startMeter(stream);

      // vigilancia: sin datos a los pocos segundos, se reabre el micrófono sin procesado de voz y se vuelve a empezar
      const check = (retried: boolean) => {
        watchdog.current = window.setTimeout(() => {
          const rec = recRef.current;
          if (!rec || chunks.current.length > 0) return;
          if (retried) {
            setNoSignal(true);
            return;
          }
          void (async () => {
            rec.ondataavailable = null;
            if (rec.state !== "inactive") rec.stop();
            stopMeter();
            plainAudio = true;
            releaseMicStream();
            try {
              const fresh = await getMicStream();
              beginRecorder(fresh, mime);
              startMeter(fresh);
              check(true);
            } catch {
              setNoSignal(true);
            }
          })();
        }, NO_SIGNAL_MS);
      };
      check(false);
    } catch (err) {
      setError(micErrorMessage(err));
      setState("error");
      throw err;
    } finally {
      starting.current = false;
    }
  }, [beginRecorder, startMeter, stopMeter]);

  const stop = useCallback(async (): Promise<RecordingResult> => {
    const rec = recRef.current;
    if (!rec) throw new Error("No hay ninguna grabación en curso.");
    recRef.current = null;
    clearWatchdog();
    await new Promise<void>((resolve) => {
      if (rec.state === "inactive") return resolve();
      rec.onstop = () => resolve();
      rec.stop();
      // algunos navegadores no avisan si el micrófono se desconectó durante la grabación
      window.setTimeout(resolve, 3000);
    });
    stopMeter();
    const durationMs = Math.round(performance.now() - startedAt.current);
    const blob = new Blob(chunks.current, { type: baseMime(rec.mimeType) });
    setState("stopped");
    if (blob.size < MIN_RECORDING_BYTES) throw new EmptyRecordingError();
    return { blob, durationMs, peak: metered.current ? peak.current : null };
  }, [clearWatchdog, stopMeter]);

  /** Descarta la grabación en curso sin devolver nada (cambiar de micrófono, repetir). */
  const cancel = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    clearWatchdog();
    stopMeter();
    if (rec && rec.state !== "inactive") {
      rec.ondataavailable = null;
      rec.stop();
    }
    setNoSignal(false);
    setState("idle");
  }, [clearWatchdog, stopMeter]);

  useEffect(
    () => () => {
      clearWatchdog();
      stopMeter();
      if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
      recRef.current = null;
    },
    [clearWatchdog, stopMeter],
  );

  return { state, error, level, noSignal, start, stop, cancel };
}
