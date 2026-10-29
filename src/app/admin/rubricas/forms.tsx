"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { createRubricVersion, publishRubric } from "../actions";

export function NewRubricForm({ defaults }: { defaults: { code: string; title: string; skill: string; criteria: string; points_table: string } }) {
  const [state, action] = useActionState(createRubricVersion, null);
  return (
    <form action={action} className="grid gap-4 md:grid-cols-3">
      <Field label="Código" htmlFor="code">
        <Input id="code" name="code" defaultValue={defaults.code} />
      </Field>
      <Field label="Título" htmlFor="title">
        <Input id="title" name="title" defaultValue={defaults.title} />
      </Field>
      <Field label="Destreza" htmlFor="skill">
        <Select id="skill" name="skill" defaultValue={defaults.skill}>
          <option value="writing">Expresión escrita</option>
          <option value="speaking">Expresión oral</option>
        </Select>
      </Field>
      <Field label="Criterios (JSON)" htmlFor="criteria" className="md:col-span-3">
        <Textarea id="criteria" name="criteria" defaultValue={defaults.criteria} className="min-h-64 font-mono text-xs" />
      </Field>
      <Field label="Tabla de puntos por banda (JSON: posición de tarea o «*» → criterio → 6 valores)" htmlFor="points_table" className="md:col-span-3">
        <Textarea id="points_table" name="points_table" defaultValue={defaults.points_table} className="min-h-40 font-mono text-xs" />
      </Field>
      <div className="md:col-span-3">
        <FormMessage state={state} />
        <SubmitButton className="mt-2">Crear versión (borrador)</SubmitButton>
      </div>
    </form>
  );
}

export function PublishRubricButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" disabled={pending} onClick={() => confirm("¿Publicar esta rúbrica? Se usará en las nuevas evaluaciones.") && start(async () => void (await publishRubric(id)))}>
      Publicar
    </Button>
  );
}
