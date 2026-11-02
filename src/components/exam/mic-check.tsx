"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, Play, Square } from "lucide-react";
import { RecordingPlayer } from "@/components/audio/recording-player";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { EmptyRecordingError, SILENCE_PEAK, listMicrophones, preferredMic, setPreferredMic, useRecorder } from "./recorder";

type Outcome = "none" | "empty" | "silent" | "ok";

/**
 * Comprobación previa del micrófono: graba unos segundos, mide si llega sonido de verdad y permite
 * escuchar el resultado. No se sube nada al servidor. Sin audio no se puede dar por buena.
 */
export function MicCheck({ onResult }: { onResult: (ok: boolean, detail?: string) => void }) {
  const rec = useRecorder();
  const [url, setUrl] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("none");
  const [confirmed, setConfirmed] = useState(false);
  const [mics, setMics] = useState<{ id: string; label: string }[]>([]);
  const [mic, setMic] = useState(preferredMic);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const stop = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    try {
      const { blob, peak } = await rec.stop();
      setUrl(URL.createObjectURL(blob));
      setOutcome(peak != null && peak < SILENCE_PEAK ? "silent" : "ok");
    } catch (err) {
      if (err instanceof EmptyRecordingError) {
        setOutcome("empty");
        onResult(false, "no_audio_data");
      }
    }
  };

  const start = async () => {
    setUrl(null);
    setOutcome("none");
    setConfirmed(false);
    try {
      await rec.start();
      setMics(await listMicrophones());
      timer.current = window.setTimeout(() => void stop(), 5000);
    } catch {
      onResult(false, "permission_or_device");
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="font-medium">Comprobación del micrófono</p>
      <p className="text-sm text-ink-2">Pulse «Probar», diga una frase en voz alta durante cinco segundos y escuche la grabación.</p>
      <div className="flex flex-wrap items-center gap-3">
        {rec.state === "recording" ? (
          <Button variant="danger" onClick={() => void stop()}>
            <Square className="size-4" aria-hidden /> Detener
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void start()}>
            <Mic className="size-4" aria-hidden /> Probar el micrófono
          </Button>
        )}
        <div className="h-3 w-40 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label="Nivel de entrada" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(rec.level * 100)}>
          <div className="h-full bg-ok transition-[width]" style={{ width: `${Math.round(rec.level * 100)}%` }} />
        </div>
        {mics.length > 1 ? (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-3">Micrófono</span>
            <Select
              className="min-h-9 w-56 py-1 text-sm"
              value={mic}
              onChange={(e) => {
                setMic(e.target.value);
                setPreferredMic(e.target.value);
                setOutcome("none");
                setUrl(null);
              }}
            >
              <option value="">Predeterminado del sistema</option>
              {mics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>
      {rec.error ? (
        <Alert tone="danger" title="Micrófono no disponible">
          {rec.error}
        </Alert>
      ) : null}
      {outcome === "empty" ? (
        <Alert tone="danger" title="El micrófono no está enviando sonido">
          <p>El navegador tiene permiso, pero no le llega audio. Así no se puede grabar la prueba.</p>
          <ul className="mt-2 ml-5 list-disc">
            <li>Compruebe que el micrófono esté conectado y no silenciado (botón físico o auriculares).</li>
            <li>En Windows: Configuración → Privacidad y seguridad → Micrófono → active el acceso para las aplicaciones de escritorio.</li>
            <li>Cierre otras aplicaciones que usen el micrófono (Teams, Zoom, Discord), elija otro micrófono si aparece la lista y repita la prueba.</li>
          </ul>
        </Alert>
      ) : null}
      {url ? (
        <div className="space-y-2">
          <RecordingPlayer key={url} src={url} durationMs={5000} tone="brand" />
          {outcome === "silent" ? (
            <Alert tone="warn" title="Apenas se detecta sonido">
              Acérquese al micrófono o revise que no esté silenciado. Escuche la grabación antes de continuar.
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              onClick={() => {
                setConfirmed(true);
                onResult(true);
              }}
            >
              <CheckCircle2 className="size-4" aria-hidden /> Se oye bien
            </Button>
            <Button variant="ghost" onClick={() => void start()}>
              <Play className="size-4" aria-hidden /> Repetir prueba
            </Button>
          </div>
          {confirmed ? <p className="text-sm font-medium text-ok">Micrófono comprobado.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
