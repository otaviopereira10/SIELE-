import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SKILL_META } from "@/lib/exam/skills";
import { formatDateTime } from "@/lib/utils";
import { ArchiveAssignmentButton, AssignmentForm } from "./forms";

export const metadata: Metadata = { title: "Asignar simulacros" };

export default async function AssignmentsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: versions }, { data: classes }, { data: students }, { data: assignments }] = await Promise.all([
    supabase
      .from("exam_versions")
      .select("id, version_no, format_label, exam_templates(title, code), exam_sections(id, skill, title, position, time_limit_seconds)")
      .eq("status", "published")
      .order("published_at", { ascending: false }),
    supabase.from("classes").select("id, name").is("archived_at", null).order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "student").eq("is_active", true).order("full_name"),
    supabase
      .from("exam_assignments")
      .select("id, title, mode, opens_at, closes_at, max_attempts, immediate_feedback, archived_at, class_id, student_id, section_ids, classes(name), profiles!exam_assignments_student_id_fkey(full_name)")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const versionOptions = (versions ?? []).map((v) => ({
    id: v.id,
    label: `${(v.exam_templates as unknown as { title: string } | null)?.title ?? "Simulacro"} · v${v.version_no}`,
    sections: ((v.exam_sections ?? []) as { id: string; skill: string; title: string; position: number; time_limit_seconds: number }[])
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, label: `${SKILL_META[s.skill as keyof typeof SKILL_META].label} (${Math.round(s.time_limit_seconds / 60)} min)` })),
  }));

  return (
    <>
      <PageHeader
        title="Asignar simulacros"
        description="Asigne una versión publicada a una clase o a un alumno, completa o por pruebas, en modo práctica o simulacro formal."
      />
      <Card className="mb-6">
        <CardHeader title="Nueva asignación" />
        <CardBody>
          {versionOptions.length === 0 ? (
            <EmptyState title="No hay simulacros publicados">La administración (o una profesora con permiso de autoría) debe publicar una versión.</EmptyState>
          ) : (
            <AssignmentForm
              versions={versionOptions}
              targets={[
                ...(classes ?? []).map((c) => ({ value: `class:${c.id}`, label: `Clase: ${c.name}` })),
                ...(students ?? []).map((s) => ({ value: `student:${s.id}`, label: `Alumno: ${s.full_name || s.email}` })),
              ]}
            />
          )}
        </CardBody>
      </Card>
      {(assignments ?? []).length ? (
        <Table>
          <thead>
            <tr>
              <Th>Título</Th>
              <Th>Destinatarios</Th>
              <Th>Modo</Th>
              <Th>Ventana</Th>
              <Th>Intentos</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {(assignments ?? []).map((a) => (
              <tr key={a.id}>
                <Td>
                  {a.title}
                  {a.section_ids.length ? <p className="text-xs text-ink-3">{a.section_ids.length} prueba(s) seleccionada(s)</p> : null}
                </Td>
                <Td>{(a.classes as unknown as { name: string } | null)?.name ?? (a.profiles as unknown as { full_name: string } | null)?.full_name ?? "—"}</Td>
                <Td>
                  <Badge tone={a.mode === "formal" ? "danger" : "brand"}>{a.mode === "formal" ? "Formal" : "Práctica"}</Badge>
                  {a.immediate_feedback ? <Badge tone="ok" className="ml-1">Corrección inmediata</Badge> : null}
                </Td>
                <Td className="text-xs">
                  {formatDateTime(a.opens_at)} → {a.closes_at ? formatDateTime(a.closes_at) : "sin cierre"}
                </Td>
                <Td>{a.max_attempts}</Td>
                <Td>
                  <ArchiveAssignmentButton id={a.id} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : null}
    </>
  );
}
