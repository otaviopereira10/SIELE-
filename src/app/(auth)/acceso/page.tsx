import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { getCurrentProfile, homeFor } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Acceso" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (!isSupabaseConfigured()) redirect("/configuracion");
  const profile = await getCurrentProfile();
  if (profile) redirect(homeFor(profile.role));
  return (
    <Card>
      <CardBody className="space-y-5 py-6">
        <div>
          <h1 className="text-2xl font-semibold">Acceso</h1>
          <p className="mt-1 text-sm text-ink-2">Estudiantes, profesoras y administración usan el mismo acceso; el panel depende de su rol.</p>
        </div>
        {error ? <Alert tone="danger" title="El enlace no es válido o ha caducado." /> : null}
        <LoginForm next={next} />
      </CardBody>
    </Card>
  );
}
