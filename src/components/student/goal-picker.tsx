"use client";

import { useActionState, useState } from "react";
import { setGoal } from "@/app/estudiante/actions";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { LEVEL_GUIDE, TARGET_LEVELS } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";

/** Elegir el nivel que se necesita: cada opción explica en una frase qué significa. */
export function GoalPicker({ level, date, today, submitLabel = "Guardar mi objetivo" }: { level?: string | null; date?: string | null; today: string; submitLabel?: string }) {
  const [state, action] = useActionState(setGoal, null);
  const [chosen, setChosen] = useState(level ?? "");
  return (
    // sin esto, React devuelve los campos a sus valores iniciales al terminar la acción y el siguiente envío llevaría otro nivel
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-4">
      <fieldset>
        <legend className="sr-only">Nivel que necesita</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {TARGET_LEVELS.map((l) => {
            const selected = chosen === l;
            return (
              <label
                key={l}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border bg-surface p-3 text-ink transition-colors has-focus-visible:outline-2 has-focus-visible:outline-focus",
                  selected ? "border-brand ring-2 ring-brand" : "border-line hover:border-line-strong",
                )}
              >
                <input type="radio" name="target_level" value={l} checked={selected} onChange={() => setChosen(l)} className="sr-only" />
                <span className="flex items-baseline gap-2">
                  <span className="text-xl font-semibold">{l}</span>
                  <span className="text-xs text-ink-3">{LEVEL_GUIDE[l].name}</span>
                </span>
                <span className="text-sm text-ink-2">{LEVEL_GUIDE[l].canDo}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm text-ink-2">¿No sabe cuál necesita? Consulte qué nivel exige la universidad, la empresa o el organismo que le pide el certificado.</p>
      <Field label="Fecha del examen (opcional)" htmlFor="target_date" hint="Con la fecha, su próximo plan se ajusta al tiempo que tiene." className="max-w-xs">
        <Input id="target_date" name="target_date" type="date" min={today} defaultValue={date ?? ""} />
      </Field>
      <FormMessage state={state} />
      <SubmitButton disabled={!chosen}>{submitLabel}</SubmitButton>
    </form>
  );
}
