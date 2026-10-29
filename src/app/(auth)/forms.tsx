"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import { registerWithInvitation, requestPasswordReset, signIn, updatePassword, type FormState } from "@/lib/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Entrando…">
        Entrar
      </SubmitButton>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/recuperar" className="text-brand underline">
          ¿Ha olvidado su contraseña?
        </Link>
        <Link href="/registro" className="text-brand underline">
          Tengo un código de invitación
        </Link>
      </div>
    </form>
  );
}

export function RegisterForm({ code }: { code?: string }) {
  const [state, action] = useActionState<FormState, FormData>(registerWithInvitation, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Código de invitación" htmlFor="code" hint="Se lo facilita su profesora o la administración del centro.">
        <Input id="code" name="code" defaultValue={code} autoComplete="off" placeholder="XXXX-XXXX-XXXX" required className="font-mono tracking-wider uppercase" />
      </Field>
      <Field label="Nombre completo" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint="Mínimo 10 caracteres, con letras y números.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repita la contraseña" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" name="consent" className="mt-1 size-4" required />
        <span>
          Acepto que mis respuestas, grabaciones y resultados se almacenen para mi preparación y sean evaluados por el personal docente de mi centro.
        </span>
      </label>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Creando la cuenta…">
        Crear cuenta
      </SubmitButton>
      <p className="text-center text-sm">
        ¿Ya tiene cuenta?{" "}
        <Link href="/acceso" className="text-brand underline">
          Inicie sesión
        </Link>
      </p>
    </form>
  );
}

export function ResetRequestForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Correo electrónico" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full" pendingLabel="Enviando…">
        Enviar instrucciones
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/acceso" className="text-brand underline">
          Volver al acceso
        </Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field label="Nueva contraseña" htmlFor="password" hint="Mínimo 10 caracteres, con al menos un número.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repita la contraseña" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormMessage state={state} />
      <SubmitButton className="w-full">Guardar la contraseña</SubmitButton>
    </form>
  );
}
