"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { addSection, addTask, deleteDraftVersion, deleteSection, publishVersion, updateSection } from "../../actions";

const TYPES_BY_SKILL: Record<string, [string, string][]> = {
  reading: [
    ["single_choice", "Selección única"],
    ["matching", "Asociación con banco común"],
    ["fragment_gap", "Huecos con fragmentos"],
    ["dropdown_gap", "Huecos con lista desplegable"],
    ["multi_select", "Selección múltiple"],
  ],
  listening: [
    ["single_choice", "Selección única"],
    ["matching", "Asociación con banco común"],
    ["multi_select", "Selección múltiple"],
  ],
  writing: [["writing", "Producción escrita"]],
  speaking: [["speaking", "Producción oral"]],
};

export function SectionForm({
  section,
}: {
  section: { id: string; title: string; instructions: string; time_limit_seconds: number; allow_back: boolean; pause_after_seconds: number };
}) {
  const [state, action] = useActionState(updateSection, null);
  return (
    <form action={action} className="grid gap-3 md:grid-cols-4">
      <input type="hidden" name="id" value={section.id} />
      <Field label="Título" htmlFor={`t-${section.id}`}>
        <Input id={`t-${section.id}`} name="title" defaultValue={section.title} />
      </Field>
      <Field label="Tiempo (minutos)" htmlFor={`m-${section.id}`}>
        <Input id={`m-${section.id}`} name="minutes" type="number" min={1} max={240} defaultValue={Math.round(section.time_limit_seconds / 60)} />
      </Field>
      <Field label="Descanso después (min)" htmlFor={`p-${section.id}`}>
        <Input id={`p-${section.id}`} name="pause_minutes" type="number" min={0} max={60} defaultValue={Math.round(section.pause_after_seconds / 60)} />
      </Field>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" name="allow_back" defaultChecked={section.allow_back} className="size-4" />
        Permitir volver a tareas anteriores
      </label>
      <Field label="Instrucciones de la prueba" htmlFor={`i-${section.id}`} className="md:col-span-4">
        <Textarea id={`i-${section.id}`} name="instructions" defaultValue={section.instructions} className="min-h-16" />
      </Field>
      <div className="md:col-span-4">
        <FormMessage state={state} />
        <SubmitButton size="sm" variant="secondary">
          Guardar la prueba
        </SubmitButton>
      </div>
    </form>
  );
}

export function AddTask({ versionId, sectionId, skill }: { versionId: string; sectionId: string; skill: string }) {
  const options = TYPES_BY_SKILL[skill] ?? [];
  const [type, setType] = useState(options[0]?.[0] ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label="Tipo de tarea">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await addTask(versionId, sectionId, type);
            if (r && !r.ok) setError(r.error ?? "Error.");
          })
        }
      >
        Añadir tarea
      </Button>
      {error ? <span className="text-sm text-danger">{error}</span> : null}
    </div>
  );
}

export function AddSection({ versionId }: { versionId: string }) {
  const [skill, setSkill] = useState("reading");
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong p-4">
      <span className="text-sm font-medium">Añadir prueba:</span>
      <Select value={skill} onChange={(e) => setSkill(e.target.value)} className="w-auto" aria-label="Destreza">
        <option value="reading">Comprensión de lectura</option>
        <option value="listening">Comprensión auditiva</option>
        <option value="writing">Expresión escrita</option>
        <option value="speaking">Expresión oral</option>
      </Select>
      <Button variant="secondary" disabled={pending} onClick={() => start(async () => void (await addSection(versionId, skill)))}>
        Añadir
      </Button>
    </div>
  );
}

export function DeleteSection({ versionId, sectionId }: { versionId: string; sectionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => confirm("¿Eliminar la prueba y todas sus tareas?") && start(async () => void (await deleteSection(versionId, sectionId)))}
    >
      Eliminar prueba
    </Button>
  );
}

export function PublishPanel({ versionId, disabled }: { versionId: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
      <Button
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const r = await publishVersion(versionId);
            setResult(r?.ok ? { ok: true, text: r.message ?? "Publicada." } : { ok: false, text: r?.error ?? "Error." });
          })
        }
      >
        Publicar la versión
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => confirm("¿Eliminar este borrador?") && start(async () => void (await deleteDraftVersion(versionId)))}>
        Eliminar borrador
      </Button>
      {disabled ? <span className="text-sm text-ink-3">Corrija los errores de validación para poder publicar.</span> : null}
      {result ? <Alert tone={result.ok ? "ok" : "danger"} title={result.text} className="w-full" /> : null}
    </div>
  );
}
