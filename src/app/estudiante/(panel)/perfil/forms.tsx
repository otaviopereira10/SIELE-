"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { joinClass, updateProfile } from "../../actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-4">
      <Field label="Nombre completo" htmlFor="full_name">
        <Input id="full_name" name="full_name" defaultValue={fullName} required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton>Guardar</SubmitButton>
    </form>
  );
}

export function JoinClassForm() {
  const [state, action] = useActionState(joinClass, null);
  return (
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-3">
      <Field label="Unirse a otra clase con un código" htmlFor="code">
        <Input id="code" name="code" placeholder="XXXX-XXXX-XXXX" className="font-mono uppercase" autoComplete="off" />
      </Field>
      <FormMessage state={state} />
      <SubmitButton variant="secondary">Unirme</SubmitButton>
    </form>
  );
}
