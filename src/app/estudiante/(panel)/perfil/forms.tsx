"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { joinClass, updateProfile } from "../../actions";

export function ProfileForm({ fullName, targetLevel, targetDate }: { fullName: string; targetLevel: string; targetDate: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <Field label="Nombre completo" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nivel deseado" htmlFor="target_level">
          <Select id="target_level" name="target_level" defaultValue={targetLevel}>
            <option value="">Sin indicar</option>
            {["A1", "A2", "B1", "B2", "C1"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha del examen o objetivo" htmlFor="target_date">
          <Input id="target_date" name="target_date" type="date" defaultValue={targetDate} />
        </Field>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Guardar</SubmitButton>
    </form>
  );
}

export function JoinClassForm() {
  const [state, action] = useActionState(joinClass, null);
  return (
    <form action={action} className="space-y-3">
      <Field label="Unirse a otra clase con un código" htmlFor="code">
        <Input id="code" name="code" placeholder="XXXX-XXXX-XXXX" className="font-mono uppercase" autoComplete="off" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Unirme</SubmitButton>
    </form>
  );
}
