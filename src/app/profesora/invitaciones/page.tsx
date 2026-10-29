import type { Metadata } from "next";
import { InvitationForm, InvitationTable, type InvitationRow } from "@/components/invitations";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitaciones" };

export default async function TeacherInvitations() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const [{ data: classes }, { data: invitations }] = await Promise.all([
    supabase.from("classes").select("id, name").is("archived_at", null).order("name"),
    supabase.from("invitations").select("id, code_hint, role, email, uses, max_uses, expires_at, revoked_at, note, classes(name)").order("created_at", { ascending: false }),
  ]);
  const now = requestTime();
  const rows: InvitationRow[] = (invitations ?? []).map((i) => ({
    ...i,
    class_name: (i.classes as unknown as { name: string } | null)?.name ?? null,
    state: i.revoked_at ? "revoked" : new Date(i.expires_at).getTime() < now ? "expired" : i.uses >= i.max_uses ? "exhausted" : "active",
  }));
  return (
    <>
      <PageHeader
        title="Invitaciones"
        description="Los alumnos solo pueden crear una cuenta con un código. El código se muestra una vez; la plataforma guarda únicamente su huella cifrada."
      />
      <Card className="mb-6">
        <CardHeader title="Nuevo código" />
        <CardBody>
          {classes?.length ? (
            <InvitationForm classes={classes} allowTeacher={profile.role === "admin"} />
          ) : (
            <EmptyState title="No tiene clases asignadas" />
          )}
        </CardBody>
      </Card>
      {rows.length ? <InvitationTable rows={rows} /> : null}
    </>
  );
}
