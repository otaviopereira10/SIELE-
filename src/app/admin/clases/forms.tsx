"use client";

import { useActionState, useState, useTransition } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { archiveClass, assignTeacher, createClass, setClassMember } from "../actions";

export function CreateClassForm() {
  const [state, action] = useActionState(createClass, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-3">
      <Field label="Nombre" htmlFor="name">
        <Input id="name" name="name" required />
      </Field>
      <Field label="Descripción" htmlFor="description">
        <Input id="description" name="description" />
      </Field>
      <Field label="Nivel objetivo" htmlFor="target_level">
        <Select id="target_level" name="target_level" defaultValue="">
          <option value="">—</option>
          {["A1", "A2", "B1", "B2", "C1"].map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
      </Field>
      <div className="sm:col-span-3">
        <FormMessage state={state} />
        <SubmitButton className="mt-2">Crear clase</SubmitButton>
      </div>
    </form>
  );
}

type Person = { id: string; full_name: string; email: string };

export function ClassCard({
  cls,
  teachers,
  students,
  teacherIds,
  studentIds,
}: {
  cls: { id: string; name: string; description: string; target_level: string | null };
  teachers: Person[];
  students: Person[];
  teacherIds: string[];
  studentIds: string[];
}) {
  const [pending, start] = useTransition();
  const [t, setT] = useState("");
  const [s, setS] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string } | null>) =>
    start(async () => {
      const r = await fn();
      setMsg(r?.ok ? null : (r?.error ?? "Error."));
    });
  const name = (p?: Person) => (p ? p.full_name || p.email : "—");
  return (
    <Card>
      <CardHeader
        title={cls.name}
        description={`${cls.description || "Sin descripción"}${cls.target_level ? ` · objetivo ${cls.target_level}` : ""}`}
        action={
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => confirm("¿Archivar la clase? Las profesoras dejarán de verla.") && run(() => archiveClass(cls.id))}>
            Archivar
          </Button>
        }
      />
      <CardBody className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-semibold">Profesoras con acceso</p>
          <ul className="mb-3 flex flex-wrap gap-2">
            {teacherIds.map((id) => (
              <li key={id} className="flex items-center gap-1 rounded-full bg-brand-soft px-3 py-1 text-sm">
                {name(teachers.find((x) => x.id === id))}
                <button type="button" aria-label="Revocar acceso" disabled={pending} onClick={() => run(() => assignTeacher(cls.id, id, false))}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Select value={t} onChange={(e) => setT(e.target.value)} aria-label="Profesora">
              <option value="">Elegir profesora…</option>
              {teachers.filter((x) => !teacherIds.includes(x.id)).map((x) => (
                <option key={x.id} value={x.id}>
                  {name(x)}
                </option>
              ))}
            </Select>
            <Button disabled={!t || pending} onClick={() => run(() => assignTeacher(cls.id, t, true))}>
              Conceder
            </Button>
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Alumnos ({studentIds.length})</p>
          <ul className="mb-3 max-h-40 space-y-1 overflow-y-auto text-sm">
            {studentIds.map((id) => (
              <li key={id} className="flex items-center justify-between rounded-md bg-surface-2 px-2 py-1">
                {name(students.find((x) => x.id === id))}
                <button type="button" aria-label="Quitar de la clase" disabled={pending} onClick={() => run(() => setClassMember(cls.id, id, false))}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Select value={s} onChange={(e) => setS(e.target.value)} aria-label="Alumno">
              <option value="">Añadir alumno…</option>
              {students.filter((x) => !studentIds.includes(x.id)).map((x) => (
                <option key={x.id} value={x.id}>
                  {name(x)}
                </option>
              ))}
            </Select>
            <Button disabled={!s || pending} onClick={() => run(() => setClassMember(cls.id, s, true))}>
              Añadir
            </Button>
          </div>
        </div>
        {msg ? <p className="text-sm text-danger md:col-span-2">{msg}</p> : null}
      </CardBody>
    </Card>
  );
}
