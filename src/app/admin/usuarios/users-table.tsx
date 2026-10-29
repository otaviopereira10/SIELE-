"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { Alert, Badge, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";
import { deleteAccount, setActive, setAuthor, setRole } from "../actions";

interface U {
  id: string;
  email: string;
  full_name: string;
  role: "student" | "teacher" | "admin";
  is_active: boolean;
  can_author: boolean;
  created_at: string;
}

export function UsersTable({ users, meId }: { users: U[]; meId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [del, setDel] = useState<U | null>(null);
  const [confirm, setConfirm] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string } | null>) =>
    start(async () => {
      const r = await fn();
      setMsg(r?.ok ? { ok: true, text: r.message ?? "Hecho." } : { ok: false, text: r?.error ?? "Error." });
    });
  return (
    <>
      {msg ? <Alert tone={msg.ok ? "ok" : "danger"} title={msg.text} className="mb-4" /> : null}
      <Table>
        <thead>
          <tr>
            <Th>Usuario</Th>
            <Th>Rol</Th>
            <Th>Estado</Th>
            <Th>Alta</Th>
            <Th>Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <Td>
                <p className="font-medium">{u.full_name || "—"}</p>
                <p className="text-xs text-ink-3">{u.email}</p>
              </Td>
              <Td>
                <select
                  aria-label={`Rol de ${u.email}`}
                  defaultValue={u.role}
                  disabled={pending || u.id === meId}
                  onChange={(e) => run(() => setRole(u.id, e.target.value as U["role"]))}
                  className="min-h-9 rounded-md border border-line-strong bg-surface px-2"
                >
                  <option value="student">Estudiante</option>
                  <option value="teacher">Profesora</option>
                  <option value="admin">Administración</option>
                </select>
                {u.role === "teacher" ? (
                  <label className="mt-1 flex items-center gap-1.5 text-xs">
                    <input type="checkbox" defaultChecked={u.can_author} disabled={pending} onChange={(e) => run(() => setAuthor(u.id, e.target.checked))} />
                    Puede editar simulacros
                  </label>
                ) : null}
              </Td>
              <Td>{u.is_active ? <Badge tone="ok">Activa</Badge> : <Badge tone="danger">Acceso revocado</Badge>}</Td>
              <Td>{formatDate(u.created_at)}</Td>
              <Td>
                {u.id !== meId ? (
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="secondary" disabled={pending} onClick={() => run(() => setActive(u.id, !u.is_active))}>
                      {u.is_active ? "Revocar acceso" : "Reactivar"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} onClick={() => setDel(u)}>
                      Eliminar
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-ink-3">Su cuenta</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Dialog
        open={Boolean(del)}
        onOpenChange={(o) => {
          if (!o) {
            setDel(null);
            setConfirm("");
          }
        }}
        title="Eliminar la cuenta definitivamente"
        description="Se borrarán la cuenta, sus intentos, respuestas, grabaciones, evaluaciones y planes. Esta acción no se puede deshacer. Escriba el correo de la cuenta para confirmar."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDel(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              disabled={pending || !del || confirm.trim().toLowerCase() !== del.email.toLowerCase()}
              onClick={() => {
                if (!del) return;
                run(() => deleteAccount(del.id, confirm));
                setDel(null);
                setConfirm("");
              }}
            >
              Eliminar
            </Button>
          </>
        }
      >
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={del?.email} aria-label="Correo de confirmación" />
      </Dialog>
    </>
  );
}
