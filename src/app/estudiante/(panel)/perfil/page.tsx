import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { JoinClassForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name");
  return (
    <>
      <PageHeader title="Perfil" description="Sus datos personales y sus objetivos de preparación." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Datos y objetivo" />
          <CardBody>
            <ProfileForm fullName={profile.fullName} targetLevel={profile.targetLevel ?? ""} targetDate={profile.targetDate ?? ""} />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Mis clases" />
            <CardBody>
              {classes?.length ? (
                <ul className="list-disc pl-5">
                  {classes.map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Todavía no pertenece a ninguna clase.</p>
              )}
              <div className="mt-4">
                <JoinClassForm />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Privacidad" />
            <CardBody className="space-y-2 text-sm text-ink-2">
              <p>Sus respuestas, grabaciones y resultados solo los ven usted, las profesoras de sus clases y la administración del centro.</p>
              <p>Para solicitar la eliminación de su cuenta y de sus datos, contacte con la administración del centro.</p>
              <p>Correo de la cuenta: {profile.email}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
