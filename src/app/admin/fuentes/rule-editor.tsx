"use client";

import { useActionState, useState } from "react";
import { FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { updateRuleSource } from "../actions";

export function RuleEditor({ ruleKey, verification, verifiedAt, notes }: { ruleKey: string; verification: string; verifiedAt: string; notes: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateRuleSource, null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs text-brand underline">
        Actualizar verificación
      </button>
    );
  }
  return (
    <form action={action} className="mt-2 grid gap-2 sm:grid-cols-[auto_auto_1fr_auto]">
      <input type="hidden" name="rule_key" value={ruleKey} />
      <Select name="verification" defaultValue={verification} aria-label="Estado">
        <option value="verified">Verificada</option>
        <option value="verified_older_edition">Solo en edición antigua</option>
        <option value="pending">Pendiente</option>
        <option value="contradictory">Contradictoria</option>
      </Select>
      <Input name="verified_at" type="date" defaultValue={verifiedAt} aria-label="Fecha de verificación" />
      <Input name="notes" defaultValue={notes} aria-label="Notas" />
      <SubmitButton size="sm">Guardar</SubmitButton>
      <div className="sm:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}
