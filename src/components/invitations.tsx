"use client";

import { useActionState, useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { createInvitation, revokeInvitation, type ActionState } from "@/app/profesora/actions";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { Badge, Table, Td, Th } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/utils";

export function InvitationForm({ classes, allowTeacher }: { classes: { id: string; name: string }[]; allowTeacher: boolean }) {
  const [state, action] = useActionState<ActionState, FormData>(createInvitation, null);
  const [role, setRole] = useState("student");
  const code = state?.ok ? (state.data as { code: string } | undefined)?.code : undefined;
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allowTeacher ? (
          <Field label="Tipo de cuenta" htmlFor="role">
            <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="student">Estudiante</option>
              <option value="teacher">Profesora</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="role" value="student" />
        )}
        <Field label={role === "teacher" ? "Clase asignada (opcional)" : "Clase"} htmlFor="class_id">
          <Select id="class_id" name="class_id" required={!allowTeacher}>
            {allowTeacher ? <option value="">Sin clase</option> : null}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Correo concreto (opcional)" htmlFor="email" hint="Si lo indica, solo esa persona podrá usar el código.">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Usos máximos" htmlFor="max_uses">
          <Input id="max_uses" name="max_uses" type="number" min={1} max={200} defaultValue={role === "teacher" ? 1 : 30} />
        </Field>
        <Field label="Caduca en (días)" htmlFor="days">
          <Input id="days" name="days" type="number" min={1} max={60} defaultValue={14} />
        </Field>
        <Field label="Nota interna" htmlFor="note">
          <Input id="note" name="note" maxLength={200} />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <FormMessage state={state} />
          <SubmitButton className="mt-2">Crear código</SubmitButton>
        </div>
      </form>
      {code ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ok/30 bg-ok-soft p-4">
          <code className="text-2xl font-semibold tracking-widest">{code}</code>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            }}
          >
            <Copy className="size-4" aria-hidden /> {copied ? "Copiado" : "Copiar"}
          </Button>
          <p className="w-full text-sm text-ink-2">
            Enlace directo: <span className="font-mono">{typeof window !== "undefined" ? `${window.location.origin}/registro?codigo=${code}` : ""}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export interface InvitationRow {
  id: string;
  code_hint: string;
  role: string;
  class_name: string | null;
  email: string | null;
  uses: number;
  max_uses: number;
  expires_at: string;
  revoked_at: string | null;
  note: string;
  /** calculado en el servidor en el momento de la petición */
  state: "active" | "revoked" | "expired" | "exhausted";
}

export function InvitationTable({ rows }: { rows: InvitationRow[] }) {
  const [pending, start] = useTransition();
  return (
    <Table>
      <thead>
        <tr>
          <Th>Código</Th>
          <Th>Tipo</Th>
          <Th>Clase</Th>
          <Th>Usos</Th>
          <Th>Estado</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const active = r.state === "active";
          return (
            <tr key={r.id}>
              <Td>
                <span className="font-mono">••••-{r.code_hint}</span>
                {r.note ? <p className="text-xs text-ink-3">{r.note}</p> : null}
              </Td>
              <Td>{r.role === "teacher" ? "Profesora" : "Estudiante"}</Td>
              <Td>{r.class_name ?? "—"}{r.email ? <p className="text-xs text-ink-3">{r.email}</p> : null}</Td>
              <Td>
                {r.uses}/{r.max_uses}
              </Td>
              <Td>
                {r.state === "revoked" ? <Badge>Revocado</Badge> : r.state === "expired" ? <Badge>Caducado</Badge> : r.state === "exhausted" ? <Badge>Agotado</Badge> : <Badge tone="ok">Activo hasta {formatDateTime(r.expires_at)}</Badge>}
              </Td>
              <Td>
                {active ? (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => void (await revokeInvitation(r.id)))}>
                    Revocar
                  </Button>
                ) : null}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
