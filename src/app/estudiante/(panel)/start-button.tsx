"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { startAttempt } from "../actions";

export function StartAttemptButton({ assignmentId, label, mode }: { assignmentId: string; label: string; mode: "practice" | "formal" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const go = () =>
    start(async () => {
      const res = await startAttempt(assignmentId);
      if (res && !res.ok) setError(res.error ?? "No se pudo iniciar el simulacro.");
    });

  return (
    <>
      <Button onClick={() => (mode === "formal" && label.startsWith("Empezar") ? setConfirm(true) : go())} disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Empezar el simulacro formal"
        description="Cada prueba tiene un tiempo controlado por el servidor que empieza al pulsar «Comenzar la prueba». Si cierra la página, sus respuestas se conservan, pero el tiempo sigue corriendo. Busque un lugar tranquilo y, para la prueba oral, un micrófono."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Ahora no
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                go();
              }}
            >
              Entrar al simulacro
            </Button>
          </>
        }
      />
    </>
  );
}
