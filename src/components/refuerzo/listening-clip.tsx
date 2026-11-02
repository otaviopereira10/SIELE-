"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

const SPEEDS = [
  { rate: 0.8, label: "Más despacio" },
  { rate: 1, label: "Normal" },
];

const noSubscribe = () => () => undefined;

/**
 * Audición de práctica leída por la voz en español del propio navegador. No hace falta descargar nada
 * ni guardar archivos, aunque la voz es sintética y cambia de un dispositivo a otro.
 */
export function ListeningClip({ script }: { script: string }) {
  const supported = useSyncExternalStore(
    noSubscribe,
    () => "speechSynthesis" in window,
    () => true,
  );
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [rate, setRate] = useState(1);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  const play = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(script);
    u.lang = "es-ES";
    u.rate = rate;
    const spanish = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("es"));
    if (spanish) u.voice = spanish;
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utterance.current = u; // algunos navegadores cortan la lectura si el objeto se libera
    setPlaying(true);
    setPlays((n) => n + 1);
    synth.speak(u);
  };

  if (!supported) {
    return (
      <Alert tone="warn" title="Este navegador no puede leer el texto en voz alta">
        Pruebe con Chrome o con Edge, o lea la transcripción de abajo.
      </Alert>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-gold/30 bg-gold-soft p-4">
      <p className="font-medium">Escuche dos veces, como en el examen, y después responda.</p>
      <div className="flex flex-wrap items-center gap-2">
        {playing ? (
          <Button
            variant="secondary"
            onClick={() => {
              window.speechSynthesis.cancel();
              setPlaying(false);
            }}
          >
            <Square className="size-4" aria-hidden /> Parar
          </Button>
        ) : (
          <Button onClick={play}>
            <Play className="size-4" aria-hidden /> {plays === 0 ? "Escuchar" : "Escuchar otra vez"}
          </Button>
        )}
        {SPEEDS.map((s) => (
          <button
            key={s.rate}
            type="button"
            aria-pressed={rate === s.rate}
            onClick={() => setRate(s.rate)}
            className={`min-h-9 rounded-full border px-3 text-sm transition-colors ${rate === s.rate ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:bg-surface-2"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-ink-2" role="status">
        {plays === 0 ? "Todavía no lo ha escuchado." : plays === 1 ? "Lo ha escuchado una vez." : `Lo ha escuchado ${plays} veces.`}
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">Ver la transcripción (mejor, después de responder)</summary>
        <p className="mt-2 text-ink-2">{script}</p>
      </details>
      <p className="text-xs text-ink-3">Voz sintética de su navegador: suena distinta según el dispositivo. El examen usa grabaciones.</p>
    </div>
  );
}
