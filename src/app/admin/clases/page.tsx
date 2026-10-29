import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ClassCard, CreateClassForm } from "./forms";

export const metadata: Metadata = { title: "Clases" };

export default async function AdminClasses() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: classes }, { data: teachers }, { data: students }, { data: assignments }, { data: members }] = await Promise.all([
    supabase.from("classes").select("id, name, description, target_level").is("archived_at", null).order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "teacher").eq("is_active", true).order("full_name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "student").order("full_name"),
    supabase.from("teacher_assignments").select("class_id, teacher_id"),
    supabase.from("class_members").select("class_id, student_id"),
  ]);
  return (
    <>
      <PageHeader title="Clases" description="Cree clases, conceda a cada profesora acceso a sus clases y gestione los alumnos. Sin acceso concedido, una profesora no ve la clase." />
      <Card className="mb-6">
        <CardHeader title="Nueva clase" />
        <CardBody>
          <CreateClassForm />
        </CardBody>
      </Card>
      <div className="space-y-4">
        {(classes ?? []).map((c) => (
          <ClassCard
            key={c.id}
            cls={c}
            teachers={teachers ?? []}
            students={students ?? []}
            teacherIds={(assignments ?? []).filter((a) => a.class_id === c.id).map((a) => a.teacher_id)}
            studentIds={(members ?? []).filter((m) => m.class_id === c.id).map((m) => m.student_id)}
          />
        ))}
      </div>
    </>
  );
}
