"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { createOwnPlan } from "../../actions";

export function PlanForm({ defaultLevel, defaultDate }: { defaultLevel: string; defaultDate: string }) {
  const [state, action] = useActionState(createOwnPlan, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Intensidad" htmlFor="minutes">
        <Select id="minutes" name="minutes" defaultValue="30">
          <option value="15">15 minutos al día</option>
          <option value="30">30 minutos al día</option>
          <option value="60">60 minutos al día</option>
        </Select>
      </Field>
      <Field label="Duración" htmlFor="weeks">
        <Select id="weeks" name="weeks" defaultValue="4">
          {[2, 4, 6, 8, 12].map((w) => (
            <option key={w} value={w}>
              {w} semanas
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nivel deseado" htmlFor="target_level">
        <Select id="target_level" name="target_level" defaultValue={defaultLevel}>
          <option value="">Sin indicar</option>
          {["A1", "A2", "B1", "B2", "C1"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fecha objetivo" htmlFor="target_date">
        <Input id="target_date" name="target_date" type="date" defaultValue={defaultDate} />
      </Field>
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
        <SubmitButton className="mt-2" pendingLabel="Generando…">
          Generar el plan
        </SubmitButton>
      </div>
    </form>
  );
}
