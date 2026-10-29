"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // solo el identificador: nunca datos privados en la consola del cliente
    if (error.digest) console.error("Error de la aplicación", error.digest);
  }, [error]);
  return (
    <main id="contenido" className="mx-auto flex min-h-dvh max-w-lg flex-col items-start justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Algo no ha funcionado</h1>
      <p className="text-ink-2">
        No se pudo completar la operación. Sus respuestas guardadas no se pierden. Inténtelo de nuevo; si el problema continúa, comunique este código a la
        administración: <code>{error.digest ?? "sin código"}</code>.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Link href="/" className="inline-flex h-11 items-center rounded-lg border border-line-strong px-4">
          Inicio
        </Link>
      </div>
    </main>
  );
}
