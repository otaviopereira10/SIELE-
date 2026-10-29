import type { Metadata } from "next";
import { InvitationForm, InvitationTable, type InvitationRow } from "@/components/invitations";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitaciones" };

export default async function AdminInvitations() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: classes }, { data: invitations }] = await Promise.all([
    supabase.from("classes").select("id, name").is("archived_at", null).order("name"),
    supabase.from("invitations").select("id, code_hint, role, email, uses, max_uses, expires_at, revoked_at, note, classes(name)").order("created_at", { ascending: false }).limit(300),
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
        description="Códigos de un solo uso o de uso limitado para crear cuentas. El rol lo determina el código en el servidor; los intentos de canje tienen límite de frecuencia."
      />
      <Card className="mb-6">
        <CardHeader title="Nuevo código" />
        <CardBody>
          <InvitationForm classes={classes ?? []} allowTeacher />
        </CardBody>
      </Card>
      {rows.length ? <InvitationTable rows={rows} /> : null}
    </>
  );
}
