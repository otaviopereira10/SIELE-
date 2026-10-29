import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Card, CardBody } from "@/components/ui/primitives";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { NewPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Nueva contraseña" };

export default async function NewPasswordPage() {
  await connection();
  if (!isSupabaseConfigured()) redirect("/configuracion");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/acceso?error=enlace");
  return (
    <Card>
      <CardBody className="space-y-5 py-6">
        <div>
          <h1 className="text-2xl font-semibold">Defina su contraseña</h1>
          <p className="mt-1 text-sm text-ink-2">Elija una contraseña que no use en otros servicios.</p>
        </div>
        <NewPasswordForm />
      </CardBody>
    </Card>
  );
}
