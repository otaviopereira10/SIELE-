"use client";

import { useActionState, useState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { TARGET_LEVELS } from "@/lib/exam/skills";
import { cn } from "@/lib/utils";
import { createOwnPlan } from "../../actions";

const INTENSITY = [
  { value: "15", title: "15 minutos", hint: "Una actividad al día" },
  { value: "30", title: "30 minutos", hint: "Dos actividades al día" },
  { value: "60", title: "60 minutos", hint: "Cuatro actividades al día" },
];

export function PlanForm({ defaultLevel, defaultDate, today, submitLabel }: { defaultLevel: string; defaultDate: string; today: string; submitLabel: string }) {
  const [state, action] = useActionState(createOwnPlan, null);
  const [minutes, setMinutes] = useState("30");
  const [date, setDate] = useState(defaultDate);
  return (
    // sin esto, React devuelve los campos a sus valores iniciales al terminar la acción y el siguiente envío llevaría otros datos
    <form action={action} onReset={(e) => e.preventDefault()} className="space-y-5">
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">¿Cuánto tiempo puede dedicarle al día?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {INTENSITY.map((o) => (
            <label
              key={o.value}
              className={cn(
                "cursor-pointer rounded-xl border p-3 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-focus",
                minutes === o.value ? "border-brand ring-2 ring-brand" : "border-line hover:border-line-strong",
              )}
            >
              <input type="radio" name="minutes" value={o.value} checked={minutes === o.value} onChange={() => setMinutes(o.value)} className="sr-only" />
              <span className="block font-semibold">{o.title}</span>
              <span className="block text-sm text-ink-2">{o.hint}</span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-3">Mejor poco cada día que mucho de golpe: elija lo que de verdad pueda mantener.</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Nivel que necesita" htmlFor="target_level">
          <Select id="target_level" name="target_level" defaultValue={defaultLevel}>
            <option value="">Sin indicar</option>
            {TARGET_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Fecha del examen (opcional)" htmlFor="target_date" hint="El plan termina antes de esa fecha, con un máximo de 12 semanas.">
          <Input id="target_date" name="target_date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Duración" htmlFor="weeks" hint={date ? "Se ajusta a su fecha." : undefined}>
          <Select id="weeks" name="weeks" defaultValue="4" disabled={Boolean(date)}>
            {[2, 4, 6, 8, 12].map((w) => (
              <option key={w} value={w}>
                {w} semanas
              </option>
            ))}
          </Select>
          {date ? <input type="hidden" name="weeks" value="4" /> : null}
        </Field>
      </div>
      <div>
        <FormMessage state={state} />
        <SubmitButton className="mt-2 w-full sm:w-auto" pendingLabel="Creando el plan…">
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
