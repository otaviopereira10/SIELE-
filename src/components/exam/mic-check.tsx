"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Mic, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { useRecorder } from "./recorder";

/**
 * Comprobación previa del micrófono: graba unos segundos, muestra el nivel de entrada y permite
 * escuchar el resultado. No se sube nada al servidor.
 */
export function MicCheck({ onResult }: { onResult: (ok: boolean, detail?: string) => void }) {
  const rec = useRecorder();
  const [url, setUrl] = useState<string | null>(null);
  const [peak, setPeak] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const peakRef = useRef(0);

  useEffect(() => {
    if (rec.state === "recording" && rec.level > peakRef.current) peakRef.current = rec.level;
  }, [rec.level, rec.state]);

  const start = async () => {
    setUrl(null);
    setConfirmed(false);
    peakRef.current = 0;
    try {
      await rec.start();
      window.setTimeout(() => void stop(), 4000);
    } catch {
      onResult(false, "permission_or_device");
    }
  };

  const stop = async () => {
    try {
      const { blob } = await rec.stop();
      setUrl(URL.createObjectURL(blob));
      setPeak(peakRef.current);
    } catch {
      // ya detenido
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="font-medium">Comprobación del micrófono</p>
      <p className="text-sm text-ink-2">Pulse «Probar», diga una frase en voz alta durante cuatro segundos y escuche la grabación.</p>
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
        <div className="h-3 w-40 overflow-hidden rounded-full bg-surface-3" aria-label="Nivel de entrada">
          <div className="h-full bg-ok transition-[width]" style={{ width: `${Math.round(rec.level * 100)}%` }} />
        </div>
      </div>
      {rec.error ? <Alert tone="danger" title="Micrófono no disponible">{rec.error}</Alert> : null}
      {url ? (
        <div className="space-y-2">
          <audio src={url} controls className="w-full" />
          {peak < 0.05 ? (
            <Alert tone="warn" title="Apenas se detecta sonido">Acérquese al micrófono o revise que no esté silenciado.</Alert>
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
