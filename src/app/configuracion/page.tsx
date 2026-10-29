import type { Metadata } from "next";
import { connection } from "next/server";
import { Logo } from "@/components/brand";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdminClientConfigured } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "Configuración pendiente" };

export default async function ConfigPage() {
  await connection();
  const pub = isSupabaseConfigured();
  const secret = isAdminClientConfigured();
  return (
    <main id="contenido" className="mx-auto max-w-2xl px-4 py-12">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold">Configuración del servidor</h1>
      <p className="mt-2 text-ink-2">
        La plataforma necesita un proyecto de Supabase (base de datos, autenticación y almacenamiento). Mientras no esté configurado, solo está
        disponible la demostración pública.
      </p>
      <Card className="mt-6">
        <CardBody className="space-y-3">
          <Alert tone={pub ? "ok" : "danger"} title="Variables públicas">
            NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {pub ? "configuradas" : "faltan"}
          </Alert>
          <Alert tone={secret ? "ok" : "warn"} title="Clave secreta del servidor">
            SUPABASE_SECRET_KEY: {secret ? "configurada" : "falta (necesaria para registro con invitación y audios del examen)"}
          </Alert>
          <ol className="ml-5 list-decimal space-y-1 text-sm text-ink-2">
            <li>Cree un proyecto en Supabase y aplique las migraciones de la carpeta supabase/migrations.</li>
            <li>Copie .env.example a .env.local (o configure las variables en Vercel) y reinicie la aplicación.</li>
            <li>Cree el primer administrador con scripts/bootstrap-admin.ts.</li>
          </ol>
          <p className="text-sm text-ink-3">Las instrucciones completas están en el README del proyecto.</p>
        </CardBody>
      </Card>
    </main>
  );
}
