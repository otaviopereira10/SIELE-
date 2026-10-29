"use client";

import { useActionState, useState, useTransition } from "react";
import { ButtonLink, Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { archiveVersion, createTemplate, duplicateVersion } from "../actions";

export function CreateTemplateForm() {
  const [state, action] = useActionState(createTemplate, null);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-4">
      <Field label="Código" htmlFor="code" hint="Ej.: SIM-GLOBAL-02">
        <Input id="code" name="code" required className="uppercase" />
      </Field>
      <Field label="Título" htmlFor="title">
        <Input id="title" name="title" required />
      </Field>
      <Field label="Descripción" htmlFor="description">
        <Input id="description" name="description" />
      </Field>
      <Field label="Estructura inicial" htmlFor="scaffold">
        <Select id="scaffold" name="scaffold" defaultValue="global">
          <option value="global">SIELE Global (4 pruebas con tiempos de referencia)</option>
          <option value="empty">Vacía</option>
        </Select>
      </Field>
      <div className="md:col-span-4">
        <FormMessage state={state} />
        <SubmitButton className="mt-2">Crear y abrir el editor</SubmitButton>
      </div>
    </form>
  );
}

export function VersionActions({ versionId, status }: { versionId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ButtonLink href={`/admin/simulacros/${versionId}/vista-previa`} size="sm" variant="secondary">
        Vista previa
      </ButtonLink>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await duplicateVersion(versionId);
            if (r && !r.ok) setError(r.error ?? "Error.");
          })
        }
      >
        Duplicar como borrador
      </Button>
      {status !== "archived" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            confirm("¿Archivar la versión? Se archivarán también sus asignaciones abiertas.") &&
            start(async () => {
              const r = await archiveVersion(versionId);
              if (r && !r.ok) setError(r.error ?? "Error.");
            })
          }
        >
          Archivar
        </Button>
      ) : null}
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}
