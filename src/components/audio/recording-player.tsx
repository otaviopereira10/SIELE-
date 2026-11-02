"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type Ref } from "react";
import { Bookmark, Download, Loader2, Pause, Play, RotateCcw, RotateCw, TriangleAlert, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";

/** Por debajo de este tamaño el archivo solo tiene cabeceras: no contiene audio. */
export const EMPTY_RECORDING_BYTES = 512;

export interface PlayerMarker {
  id: string;
  ms: number;
  kind: "error" | "strength" | "suggestion";
  label: string;
}

export interface RecordingPlayerHandle {
  seek(ms: number): void;
}

const BARS = 110;
const SPEEDS = [1, 1.25, 1.5, 0.75];
const MARKER_TONE = { error: "bg-danger", strength: "bg-ok", suggestion: "bg-warn" };
const FILL = { orange: "bg-orange", brand: "bg-brand" };

/** Solo suena una grabación cada vez. */
let nowPlaying: HTMLAudioElement | null = null;

async function analyse(buffer: ArrayBuffer): Promise<{ peaks: number[]; duration: number; silent: boolean } | null> {
  const Ctx = window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) return null;
  try {
    const audio = await new Ctx(1, 1, 44100).decodeAudioData(buffer);
    const data = audio.getChannelData(0);
    const size = Math.max(1, Math.floor(data.length / BARS));
    const raw: number[] = [];
    let max = 0;
    for (let i = 0; i < BARS; i++) {
      let peak = 0;
      const end = Math.min(data.length, (i + 1) * size);
      for (let j = i * size; j < end; j += 8) peak = Math.max(peak, Math.abs(data[j]));
      raw.push(peak);
      max = Math.max(max, peak);
    }
    return { peaks: raw.map((p) => (max > 0 ? Math.max(0.05, p / max) : 0.05)), duration: audio.duration, silent: max < 0.01 };
  } catch {
    // el navegador no descodifica este formato; el reproductor sigue funcionando sin forma de onda
    return null;
  }
}

/**
 * Reproductor de grabaciones orales. Descarga el archivo una vez, de modo que se puede saltar a cualquier
 * punto (las grabaciones del navegador no llevan índice ni duración) y no se interrumpe aunque la página se refresque.
 * Distingue una grabación vacía, una silenciosa y un fallo de carga, y ofrece qué hacer en cada caso.
 */
export function RecordingPlayer({
  src,
  sizeBytes,
  durationMs,
  markers = [],
  onMark,
  tone = "orange",
  lazy = false,
  emptyAction,
  ref,
}: {
  src: string | undefined;
  sizeBytes?: number;
  durationMs: number;
  markers?: PlayerMarker[];
  onMark?: (ms: number) => void;
  tone?: keyof typeof FILL;
  /** No descarga nada hasta que se pulsa reproducir (informes con muchas grabaciones). */
  lazy?: boolean;
  /** Acción que se ofrece cuando la grabación no contiene audio. */
  emptyAction?: ReactNode;
  ref?: Ref<RecordingPlayerHandle>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const fixing = useRef(false);
  const playWhenReady = useRef(false);
  const [requested, setRequested] = useState(!lazy);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error" | "unsupported">("loading");
  const [url, setUrl] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [silent, setSilent] = useState(false);
  const [duration, setDuration] = useState(durationMs / 1000);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const tooSmall = sizeBytes != null && sizeBytes < EMPTY_RECORDING_BYTES;

  useEffect(() => {
    if (!src || !requested || tooSmall) return;
    let alive = true;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const buffer = await res.arrayBuffer();
        if (!alive) return;
        if (buffer.byteLength < EMPTY_RECORDING_BYTES) {
          setStatus("empty");
          return;
        }
        objectUrl = URL.createObjectURL(new Blob([buffer], { type: res.headers.get("content-type") ?? "audio/webm" }));
        const info = await analyse(buffer.slice(0));
        if (!alive) return;
        setUrl(objectUrl);
        if (info) {
          setPeaks(info.peaks);
          setDuration(info.duration);
          setSilent(info.silent);
        }
        setStatus("ready");
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, requested, tooSmall, attempt]);

  // posición fluida mientras suena (unas 20 veces por segundo)
  useEffect(() => {
    if (!playing) return;
    let id = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last > 50) {
        last = t;
        setTime(audioRef.current?.currentTime ?? 0);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  useEffect(
    () => () => {
      if (nowPlaying === audioRef.current) nowPlaying = null;
    },
    [],
  );

  const seekTo = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setTime(el.currentTime);
  }, []);

  useImperativeHandle(ref, () => ({ seek: (ms) => seekTo(ms / 1000) }), [seekTo]);

  const toggle = useCallback(() => {
    if (!requested) {
      playWhenReady.current = true;
      setRequested(true);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      if (nowPlaying && nowPlaying !== el) nowPlaying.pause();
      nowPlaying = el;
      void el.play().catch(() => setStatus("unsupported"));
    } else el.pause();
  }, [requested]);

  const seekFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    seekTo(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)) * duration);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, select")) return;
    if (e.key === " " && target.tagName !== "BUTTON") {
      e.preventDefault();
      toggle();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(time - 5);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(Math.min(duration, time + 5));
    } else if (e.key.toLowerCase() === "m" && onMark) {
      e.preventDefault();
      onMark(Math.round(time * 1000));
    }
  };

  if (!src) {
    return <Notice icon={<TriangleAlert className="size-4" aria-hidden />} tone="warn" title="Grabación no disponible" text="Esta grabación todavía no está verificada." />;
  }

  if (tooSmall || status === "empty") {
    return (
      <Notice
        icon={<VolumeX className="size-4" aria-hidden />}
        tone="danger"
        title="Grabación vacía: no hay nada que escuchar"
        text={`El micrófono del estudiante no envió sonido durante los ${formatDuration(durationMs / 1000)} que duró la grabación.`}
      >
        {emptyAction}
      </Notice>
    );
  }

  if (status === "error") {
    return (
      <Notice icon={<TriangleAlert className="size-4" aria-hidden />} tone="danger" title="No se pudo cargar la grabación" text="Compruebe la conexión e inténtelo de nuevo.">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setStatus("loading");
            setAttempt((a) => a + 1);
          }}
        >
          Reintentar
        </Button>
      </Notice>
    );
  }

  if (status === "unsupported") {
    return (
      <Notice icon={<TriangleAlert className="size-4" aria-hidden />} tone="warn" title="Este navegador no reproduce el formato de la grabación" text="Abra la corrección en Chrome o Edge, o descargue el archivo.">
        {url ? (
          <a href={url} download="grabacion.webm" className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium">
            <Download className="size-4" aria-hidden /> Descargar
          </a>
        ) : null}
      </Notice>
    );
  }

  const progress = duration > 0 ? Math.min(1, time / duration) : 0;
  const loading = requested && status === "loading";
  const bars = peaks ?? Array.from({ length: BARS }, (_, i) => 0.18 + 0.1 * Math.abs(Math.sin(i * 0.7)));

  return (
    // el foco en el contenedor permite usar el teclado: espacio, flechas y M
    <div className="rounded-xl bg-surface-2 px-3 py-3 sm:px-4" tabIndex={0} onKeyDown={onKeyDown} aria-label="Reproductor de la grabación">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={loading}
          aria-label={playing ? "Pausar" : "Reproducir"}
          className={cn("flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-transform hover:brightness-95 active:scale-95 disabled:opacity-60", FILL[tone])}
        >
          {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : playing ? <Pause className="size-5" aria-hidden /> : <Play className="ml-0.5 size-5" aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={-1}
            aria-label="Posición en la grabación"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(time)}
            aria-valuetext={formatDuration(time)}
            className={cn("relative h-12 touch-none select-none", status === "ready" ? "cursor-pointer" : "cursor-default")}
            onPointerDown={(e) => {
              if (status !== "ready") return;
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromPointer(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) seekFromPointer(e);
            }}
          >
            <div className={cn("flex h-full items-center gap-px", loading && "animate-pulse")}>
              {bars.map((p, i) => (
                <span key={i} className={cn("min-w-px flex-1 rounded-full", i / BARS < progress ? FILL[tone] : "bg-line-strong/70")} style={{ height: `${Math.round(p * 100)}%` }} />
              ))}
            </div>
            {status === "ready" ? <span className="pointer-events-none absolute inset-y-0 w-0.5 rounded bg-ink" style={{ left: `${progress * 100}%` }} /> : null}
            {markers.map((m) => (
              <button
                key={m.id}
                type="button"
                title={`${formatDuration(m.ms / 1000)} · ${m.label}`}
                aria-label={`Ir a la observación en ${formatDuration(m.ms / 1000)}: ${m.label}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => seekTo(m.ms / 1000)}
                className={cn("absolute -top-1 size-3 -translate-x-1/2 rounded-full ring-2 ring-surface-2 transition-transform hover:scale-125", MARKER_TONE[m.kind])}
                style={{ left: `${duration > 0 ? Math.min(100, (m.ms / 1000 / duration) * 100) : 0}%` }}
              />
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-sm text-ink-2 tabular-nums">
              {formatDuration(time)} <span className="text-ink-3">/ {formatDuration(duration)}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1">
              <PlayerButton label="Retroceder 5 segundos" disabled={status !== "ready"} onClick={() => seekTo(time - 5)}>
                <RotateCcw className="size-3.5" aria-hidden /> 5 s
              </PlayerButton>
              <PlayerButton label="Avanzar 5 segundos" disabled={status !== "ready"} onClick={() => seekTo(Math.min(duration, time + 5))}>
                <RotateCw className="size-3.5" aria-hidden /> 5 s
              </PlayerButton>
              <PlayerButton
                label={`Velocidad de reproducción: ${speed}×`}
                disabled={status !== "ready"}
                onClick={() => {
                  const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                  setSpeed(next);
                  if (audioRef.current) audioRef.current.playbackRate = next;
                }}
              >
                <span className="tabular-nums">{speed}×</span>
              </PlayerButton>
              {onMark ? (
                <button
                  type="button"
                  disabled={status !== "ready"}
                  onClick={() => onMark(Math.round(time * 1000))}
                  title="Atajo: tecla M"
                  className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2.5 text-[0.82rem] font-medium text-ink transition-colors hover:bg-surface-3 disabled:opacity-50"
                >
                  <Bookmark className="size-3.5" aria-hidden /> Comentar este momento
                </button>
              ) : null}
            </span>
          </div>
        </div>
      </div>
      {silent ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-warn">
          <VolumeX className="size-4 shrink-0" aria-hidden /> Se grabó, pero apenas contiene sonido. Puede que el micrófono estuviera silenciado.
        </p>
      ) : null}
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          preload="auto"
          className="hidden"
          onLoadedMetadata={(e) => {
            // las grabaciones del navegador no declaran su duración: se obliga a calcularla saltando al final
            if (!Number.isFinite(e.currentTarget.duration)) {
              fixing.current = true;
              e.currentTarget.currentTime = 1e7;
            }
          }}
          onDurationChange={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0 && !peaks) setDuration(d);
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (fixing.current) {
              fixing.current = false;
              el.currentTime = 0;
              return;
            }
            setTime(el.currentTime);
          }}
          onCanPlay={(e) => {
            if (playWhenReady.current && !fixing.current) {
              playWhenReady.current = false;
              const el = e.currentTarget;
              if (nowPlaying && nowPlaying !== el) nowPlaying.pause();
              nowPlaying = el;
              void el.play().catch(() => undefined);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setStatus("unsupported")}
        />
      ) : null}
    </div>
  );
}

function PlayerButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[0.82rem] text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function Notice({ icon, tone, title, text, children }: { icon: ReactNode; tone: "danger" | "warn"; title: string; text: string; children?: ReactNode }) {
  return (
    <div className={cn("rounded-xl border px-4 py-3", tone === "danger" ? "border-danger/25 bg-danger-soft" : "border-warn/30 bg-warn-soft")} role="status">
      <p className={cn("flex items-center gap-2 font-medium", tone === "danger" ? "text-danger" : "text-warn")}>
        {icon} {title}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">{text}</p>
      {children ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
