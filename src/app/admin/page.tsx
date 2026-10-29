import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { isAiConfigured } from "@/lib/ai/feedback";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Administración" };

export default async function AdminHome() {
  await requireRole("admin");
  const supabase = await createClient();
  await supabase.rpc("sweep_expired_attempts");
  const { data: status, error } = await supabase.rpc("app_status");
  const s = (status ?? {}) as Record<string, number | Record<string, number> | string>;
  const users = (s.users ?? {}) as Record<string, number>;
  return (
    <>
      <PageHeader title="Estado de la aplicación" description={`Datos en tiempo real · servidor de base de datos: ${formatDateTime(s.db_time as string)}`} />
      {error ? <Alert tone="danger" title="No se pudo leer el estado">{error.message}</Alert> : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Estudiantes" value={users.student ?? 0} />
        <Stat label="Profesoras" value={users.teacher ?? 0} />
        <Stat label="Administración" value={users.admin ?? 0} />
        <Stat label="Cuentas desactivadas" value={(s.inactive_users as number) ?? 0} />
        <Stat label="Intentos en curso" value={(s.attempts_in_progress as number) ?? 0} />
        <Stat label="Pendientes de evaluación" value={(s.attempts_pending_grading as number) ?? 0} tone={(s.attempts_pending_grading as number) ? "danger" : undefined} />
        <Stat label="Evaluaciones en borrador" value={(s.draft_evaluations as number) ?? 0} />
        <Stat label="Versiones publicadas" value={(s.published_versions as number) ?? 0} hint={`${(s.draft_versions as number) ?? 0} en borrador`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comprobaciones" />
          <CardBody className="space-y-2">
            <Alert tone={isAdminClientConfigured() ? "ok" : "danger"} title="Clave secreta del servidor">
              {isAdminClientConfigured() ? "Configurada (registro con invitación y audios del examen operativos)." : "Falta SUPABASE_SECRET_KEY."}
            </Alert>
            <Alert tone={(s.unverified_recordings as number) ? "warn" : "ok"} title="Grabaciones">
              {(s.recordings as number) ?? 0} grabaciones · {(s.unverified_recordings as number) ?? 0} sin verificar
            </Alert>
            <Alert tone={(s.pending_rule_verifications as number) ? "warn" : "ok"} title="Reglas del examen pendientes de verificar">
              {(s.pending_rule_verifications as number) ?? 0} reglas con fuentes pendientes o contradictorias.{" "}
              <Link href="/admin/fuentes" className="underline">
                Revisar
              </Link>
            </Alert>
            <Alert tone="info" title="Asistencia de IA">
              {isAiConfigured() ? "Proveedor configurado; actívela o desactívela en «Datos, IA y retención»." : "Sin proveedor configurado: la plataforma funciona sin IA."}
            </Alert>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Tareas habituales" />
          <CardBody>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <Link href="/admin/invitaciones" className="text-brand underline">
                  Invitar profesoras o estudiantes
                </Link>{" "}
                ({(s.active_invitations as number) ?? 0} códigos activos)
              </li>
              <li>
                <Link href="/admin/clases" className="text-brand underline">
                  Crear clases y conceder acceso a profesoras
                </Link>
              </li>
              <li>
                <Link href="/admin/simulacros" className="text-brand underline">
                  Crear, validar y publicar simulacros
                </Link>
              </li>
              <li>
                <Link href="/profesora/correcciones" className="text-brand underline">
                  Ver la bandeja de corrección
                </Link>
              </li>
              <li>
                <Link href="/admin/auditoria" className="text-brand underline">
                  Consultar el registro de auditoría
                </Link>
              </li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
