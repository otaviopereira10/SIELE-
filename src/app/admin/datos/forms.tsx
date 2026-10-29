"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { runRetention, saveSettings } from "../actions";

export function SettingsForm({
  aiConfigured,
  values,
}: {
  aiConfigured: boolean;
  values: { ai_enabled: boolean; ai_max_input_chars: number; ai_daily_limit: number; oral_recordings: number; attempt_events: number; response_revisions: number; audit_logs: number };
}) {
  const [state, action] = useActionState(saveSettings, null);
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-3">
        <legend className="font-semibold">Asistencia de IA (opcional)</legend>
        {!aiConfigured ? <Alert tone="info" title="Sin proveedor configurado">Defina ANTHROPIC_API_KEY en el servidor para poder activarla.</Alert> : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ai_enabled" defaultChecked={values.ai_enabled} className="size-4" disabled={!aiConfigured} />
          Permitir que las profesoras pidan una lectura inicial asistida de los textos escritos
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Máximo de caracteres por texto" htmlFor="ai_max_input_chars">
            <Input id="ai_max_input_chars" name="ai_max_input_chars" type="number" min={500} max={30000} defaultValue={values.ai_max_input_chars} />
          </Field>
          <Field label="Sugerencias por profesora y día" htmlFor="ai_daily_limit">
            <Input id="ai_daily_limit" name="ai_daily_limit" type="number" min={0} max={1000} defaultValue={values.ai_daily_limit} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-semibold">Conservación de datos (días)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Grabaciones orales" htmlFor="oral_recordings">
            <Input id="oral_recordings" name="oral_recordings" type="number" min={30} max={3650} defaultValue={values.oral_recordings} />
          </Field>
          <Field label="Eventos de los intentos" htmlFor="attempt_events">
            <Input id="attempt_events" name="attempt_events" type="number" min={30} max={3650} defaultValue={values.attempt_events} />
          </Field>
          <Field label="Borradores intermedios de textos" htmlFor="response_revisions">
            <Input id="response_revisions" name="response_revisions" type="number" min={30} max={3650} defaultValue={values.response_revisions} />
          </Field>
          <Field label="Registro de auditoría" htmlFor="audit_logs">
            <Input id="audit_logs" name="audit_logs" type="number" min={30} max={3650} defaultValue={values.audit_logs} />
          </Field>
        </div>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>Guardar ajustes</SubmitButton>
    </form>
  );
}

export function RetentionButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="space-y-3">
      <Button
        variant="danger"
        disabled={pending}
        onClick={() =>
          confirm("Se eliminarán de forma permanente los datos fuera del plazo de conservación. ¿Continuar?") &&
          start(async () => {
            const r = await runRetention();
            setMsg(r?.ok ? { ok: true, text: r.message ?? "Hecho." } : { ok: false, text: r?.error ?? "Error." });
          })
        }
      >
        {pending ? "Aplicando…" : "Aplicar ahora"}
      </Button>
      {msg ? <Alert tone={msg.ok ? "ok" : "danger"} title={msg.text} /> : null}
    </div>
  );
}
