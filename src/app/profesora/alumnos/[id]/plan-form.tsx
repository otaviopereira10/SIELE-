"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { createPlanForStudent } from "../../actions";

export function TeacherPlanForm({ studentId }: { studentId: string }) {
  const [state, action] = useActionState(createPlanForStudent, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="student_id" value={studentId} />
      <Field label="Intensidad" htmlFor="minutes">
        <Select id="minutes" name="minutes" defaultValue="30">
          <option value="15">15 min/día</option>
          <option value="30">30 min/día</option>
          <option value="60">60 min/día</option>
        </Select>
      </Field>
      <Field label="Semanas" htmlFor="weeks">
        <Select id="weeks" name="weeks" defaultValue="4">
          {[2, 4, 6, 8, 12].map((w) => (
            <option key={w}>{w}</option>
          ))}
        </Select>
      </Field>
      <Field label="Nivel deseado" htmlFor="target_level">
        <Select id="target_level" name="target_level" defaultValue="">
          <option value="">Sin indicar</option>
          {["A1", "A2", "B1", "B2", "C1"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha objetivo" htmlFor="target_date">
        <Input id="target_date" name="target_date" type="date" />
      </Field>
      <Field label="Nota para el estudiante" htmlFor="note" className="sm:col-span-2 lg:col-span-4">
        <Textarea id="note" name="note" placeholder="Por ejemplo: céntrate en los pasados y graba cada día una respuesta de un minuto." />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
        <SubmitButton className="mt-2">Generar el plan</SubmitButton>
      </div>
    </form>
  );
}
