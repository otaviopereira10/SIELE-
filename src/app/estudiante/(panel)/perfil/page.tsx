import type { Metadata } from "next";
import { GoalPicker } from "@/components/student/goal-picker";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { requestTime } from "@/lib/clock";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils";
import { JoinClassForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const profile = await requireRole("student");
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name");
  const today = todayISO(requestTime());
  return (
    <>
      <PageHeader title="Perfil" description="Su objetivo, sus datos personales y sus clases." />
      <Card className="mb-6">
        <CardHeader title="Mi objetivo" description="Sus lecciones, su progreso y su próximo plan se orientan a este nivel." />
        <CardBody>
          <GoalPicker level={profile.targetLevel} date={profile.targetDate && profile.targetDate > today ? profile.targetDate : null} today={today} />
        </CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Mis datos" />
          <CardBody>
            <ProfileForm fullName={profile.fullName} />
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
              <p>Si su centro activa la asistencia de inteligencia artificial, el texto escrito se envía, sin su nombre ni su correo, a un proveedor externo para proponerle sugerencias a su profesora.</p>
              <p>Para solicitar la eliminación de su cuenta y de sus datos, contacte con la administración del centro.</p>
              <p>Correo de la cuenta: {profile.email}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
