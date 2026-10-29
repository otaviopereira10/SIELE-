import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { isAiConfigured } from "@/lib/ai/feedback";
import { createClient } from "@/lib/supabase/server";
import { RetentionButton, SettingsForm } from "./forms";

export const metadata: Metadata = { title: "Datos, IA y retención" };

export default async function DataPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: settings }, { data: retention }] = await Promise.all([
    supabase.from("app_settings").select("key, value"),
    supabase.from("retention_policies").select("entity, retain_days"),
  ]);
  const s = (k: string, d: unknown) => settings?.find((x) => x.key === k)?.value ?? d;
  const r = (k: string) => retention?.find((x) => x.entity === k)?.retain_days ?? 365;
  return (
    <>
      <PageHeader title="Datos, IA y retención" description="Conservación y eliminación de datos personales, y asistencia opcional de IA para la corrección." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Ajustes" />
          <CardBody>
            <SettingsForm
              aiConfigured={isAiConfigured()}
              values={{
                ai_enabled: s("ai.enabled", false) === true,
                ai_max_input_chars: Number(s("ai.max_input_chars", 6000)),
                ai_daily_limit: Number(s("ai.daily_limit_per_teacher", 40)),
                oral_recordings: r("oral_recordings"),
                attempt_events: r("attempt_events"),
                response_revisions: r("response_revisions"),
                audit_logs: r("audit_logs"),
              }}
            />
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Aplicar la política de conservación" description="Elimina eventos, borradores intermedios, registros y grabaciones de intentos publicados o anulados más antiguos que el plazo." />
            <CardBody>
              <RetentionButton />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Procedimientos" />
            <CardBody className="space-y-3 text-sm text-ink-2">
              <p>
                <strong>Revocar el acceso:</strong> en «Usuarios y roles», «Revocar acceso». La base de datos deja de devolver datos a esa cuenta de inmediato y se
                bloquean sus sesiones.
              </p>
              <p>
                <strong>Eliminar una cuenta:</strong> «Eliminar» en «Usuarios y roles» (confirmación con el correo). Se borran la cuenta, sus intentos, respuestas,
                evaluaciones, planes y grabaciones; la acción queda en la auditoría.
              </p>
              <p>
                <strong>Copias de seguridad:</strong> configure las copias diarias o PITR del proyecto de Supabase y exporte periódicamente con <code>supabase db dump</code>.
                El README describe la restauración.
              </p>
              <p>
                <strong>IA:</strong> solo se envía el enunciado y el texto del estudiante, sin nombre ni correo. Revise el acuerdo de tratamiento de datos de su
                proveedor antes de activarla.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
