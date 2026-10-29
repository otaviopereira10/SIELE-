"use client";

import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { useRecorder } from "@/components/exam/recorder";

/** Grabadora de autoevaluación: la grabación se queda en el dispositivo (no se sube). */
export function SelfRecorder({ prompt }: { prompt: string }) {
  const rec = useRecorder();
  const [url, setUrl] = useState<string | null>(null);
  return (
    <div className="space-y-3 rounded-lg border border-orange/30 bg-orange-soft p-4">
      <p className="font-medium">{prompt}</p>
      <div className="flex flex-wrap items-center gap-3">
        {rec.state === "recording" ? (
          <Button
            variant="danger"
            onClick={async () => {
              const { blob } = await rec.stop();
              setUrl(URL.createObjectURL(blob));
            }}
          >
            <Square className="size-4" aria-hidden /> Detener
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void rec.start().catch(() => undefined)}>
            <Mic className="size-4" aria-hidden /> Grabarme
          </Button>
        )}
        {rec.state === "recording" ? <span className="rec-dot size-3 rounded-full bg-danger" aria-label="Grabando" /> : null}
      </div>
      {rec.error ? <Alert tone="danger">{rec.error}</Alert> : null}
      {url ? <audio src={url} controls className="w-full" /> : null}
      <p className="text-xs text-ink-3">Esta grabación no se envía al servidor: escúchese y compárela con los pasos del módulo.</p>
    </div>
  );
}
