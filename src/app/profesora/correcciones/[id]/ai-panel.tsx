"use client";

import { useState, useTransition } from "react";
import { Bot, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import { categoryLabel } from "@/lib/diagnosis/taxonomy";
import type { AiSuggestion } from "@/lib/ai/feedback";
import { requestAiSuggestion, setAiSuggestionStatus } from "../../actions";

/** Sugerencias de IA: nunca se aplican solas. La profesora decide qué usar. */
export function AiPanel({
  attemptId,
  taskId,
  latest,
  enabled,
  onApplyBand,
  onUseObservation,
}: {
  attemptId: string;
  taskId: string;
  latest: { id: string; model: string; status: string; created_at: string; suggestion: AiSuggestion } | null;
  enabled: boolean;
  onApplyBand: (criterion: string, band: number) => void;
  onUseObservation: (o: AiSuggestion["observations"][number]) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <p className="text-xs text-ink-3">
        Asistencia de IA desactivada. La administración puede activarla (requiere ANTHROPIC_API_KEY en el servidor). La plataforma funciona igual sin ella.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Bot className="size-4" aria-hidden /> Lectura inicial asistida
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await requestAiSuggestion(attemptId, taskId);
              if (!res?.ok) setError(res?.error ?? "Error.");
            })
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {latest ? "Pedir otra sugerencia" : "Pedir sugerencia"}
        </Button>
      </div>
      <p className="text-xs text-ink-3">
        Solo se envían el enunciado y el texto (sin datos personales). Las citas que no aparecen literalmente en el texto se descartan. Nada se aplica sin su revisión.
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {latest && latest.status !== "rejected" ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-ink-3">
            {latest.model} · {new Date(latest.created_at).toLocaleString("es-ES")} {latest.status === "accepted" ? "· revisada" : ""}
          </p>
          {latest.suggestion.summary_for_teacher ? <p>{latest.suggestion.summary_for_teacher}</p> : null}
          {latest.suggestion.uncertainty ? (
            <Alert tone="warn" title="Lo que la IA no puede valorar con seguridad">
              {latest.suggestion.uncertainty}
            </Alert>
          ) : null}
          <ul className="space-y-2">
            {latest.suggestion.criteria.map((c) => (
              <li key={c.key} className="rounded-lg bg-surface-2 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {c.key}: banda sugerida {c.suggested_band}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => onApplyBand(c.key, c.suggested_band)}>
                    Usar en la rúbrica
                  </Button>
                </div>
                <p className="text-ink-2">{c.justification}</p>
                {c.evidence_quotes.length ? <p className="mt-1 text-xs text-ink-3">Evidencias: {c.evidence_quotes.map((q) => `«${q}»`).join(" · ")}</p> : null}
              </li>
            ))}
          </ul>
          {latest.suggestion.observations.length ? (
            <ul className="space-y-2">
              {latest.suggestion.observations.map((o, i) => (
                <li key={i} className="rounded-lg border border-line px-3 py-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone={o.kind === "error" ? "danger" : o.kind === "strength" ? "ok" : "warn"}>{categoryLabel(o.category)}</Badge>
                    <Badge>confianza {o.confidence}</Badge>
                  </p>
                  <p className="mt-1 italic">«{o.quote}»</p>
                  {o.correction ? <p>→ {o.correction}</p> : null}
                  <p className="text-ink-2">{o.explanation}</p>
                  <Button size="sm" variant="ghost" className="mt-1" onClick={() => onUseObservation(o)}>
                    Revisar y añadir como observación
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-ink-3">No hay observaciones con citas verificables.</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => start(async () => void (await setAiSuggestionStatus(attemptId, latest.id, "accepted")))}>
              Marcar como revisada
            </Button>
            <Button size="sm" variant="ghost" onClick={() => start(async () => void (await setAiSuggestionStatus(attemptId, latest.id, "rejected")))}>
              Descartar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
