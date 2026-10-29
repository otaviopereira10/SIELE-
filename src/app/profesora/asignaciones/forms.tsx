"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { archiveAssignment, createAssignment } from "../actions";

function localNow(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function AssignmentForm({
  versions,
  targets,
}: {
  versions: { id: string; label: string; sections: { id: string; label: string }[] }[];
  targets: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(createAssignment, null);
  const [versionId, setVersionId] = useState(versions[0]?.id ?? "");
  const [mode, setMode] = useState<"practice" | "formal">("practice");
  const version = versions.find((v) => v.id === versionId);
  // las fechas locales se convierten a ISO (con zona horaria) antes de enviarlas
  const [opens, setOpens] = useState(localNow());
  const [closes, setCloses] = useState(localNow(14));

  return (
    <form
      action={(fd) => {
        fd.set("opens_at", new Date(opens).toISOString());
        fd.set("closes_at", closes ? new Date(closes).toISOString() : "");
        return action(fd);
      }}
      className="grid gap-4 md:grid-cols-2"
    >
      <Field label="Simulacro (versión publicada)" htmlFor="version_id">
        <Select id="version_id" name="version_id" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Título para los alumnos" htmlFor="title">
        <Input id="title" name="title" required defaultValue="Simulacro SIELE Global" />
      </Field>
      <Field label="Destinatarios" htmlFor="target">
        <Select id="target" name="target" required>
          {targets.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Modalidad" htmlFor="mode">
        <Select id="mode" name="mode" value={mode} onChange={(e) => setMode(e.target.value as "practice" | "formal")}>
          <option value="practice">Práctica</option>
          <option value="formal">Simulacro formal</option>
        </Select>
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-1 text-sm font-medium">Pruebas incluidas (sin marcar = todas)</legend>
        <div className="flex flex-wrap gap-3">
          {version?.sections.map((s) => (
            <label key={s.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              <input type="checkbox" name="section_ids" value={s.id} className="size-4" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Abre" htmlFor="opens">
        <Input id="opens" type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} required />
      </Field>
      <Field label="Cierra (opcional)" htmlFor="closes">
        <Input id="closes" type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} />
      </Field>
      <Field label="Número máximo de intentos" htmlFor="max_attempts">
        <Input id="max_attempts" name="max_attempts" type="number" min={1} max={20} defaultValue={mode === "formal" ? 1 : 3} />
      </Field>
      <Field label="Reanudación tras una interrupción" htmlFor="resume_policy" hint="En formal puede exigir que la profesora desbloquee el intento.">
        <Select id="resume_policy" name="resume_policy" defaultValue="allow">
          <option value="allow">Permitir reanudar (el tiempo sigue corriendo)</option>
          <option value="teacher_unlock">Solo si la profesora no lo ha bloqueado</option>
        </Select>
      </Field>
      {mode === "practice" ? (
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" name="immediate_feedback" className="size-4" />
          Corrección inmediata en comprensión (el alumno puede comprobar cada tarea y ver las explicaciones)
        </label>
      ) : null}
      <div className="md:col-span-2">
        <FormMessage state={state} />
        <SubmitButton className="mt-2">Asignar</SubmitButton>
      </div>
    </form>
  );
}

export function ArchiveAssignmentButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await archiveAssignment(id)))}>
      Archivar
    </Button>
  );
}
