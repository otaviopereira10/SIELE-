import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Auditoría" };

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ accion?: string; desde?: string; p?: string }> }) {
  await requireRole("admin");
  const { accion = "", desde = "", p = "0" } = await searchParams;
  const page = Math.max(0, Number(p) || 0);
  const supabase = await createClient();
  let q = supabase.from("audit_logs").select("id, actor_id, action, entity, entity_id, details, created_at").order("created_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (accion) q = q.ilike("action", `%${accion.replace(/[%_]/g, "")}%`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(desde)) q = q.gte("created_at", desde);
  const { data: logs } = await q;
  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))] as string[];
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, email").in("id", actorIds) : { data: [] };
  return (
    <>
      <PageHeader title="Auditoría" description="Cambios de roles y accesos, invitaciones, publicaciones, anulaciones, configuración y retención. Los registros no se pueden editar desde la aplicación." />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="accion" defaultValue={accion} placeholder="Acción (p. ej. role_changed)" className="min-h-10 rounded-md border border-line-strong px-3" />
        <input name="desde" type="date" defaultValue={desde} className="min-h-10 rounded-md border border-line-strong px-3" />
        <button className="min-h-10 rounded-lg bg-brand px-4 text-sm text-white">Filtrar</button>
      </form>
      {(logs ?? []).length === 0 ? (
        <EmptyState title="Sin registros" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Fecha</Th>
              <Th>Usuario</Th>
              <Th>Acción</Th>
              <Th>Entidad</Th>
              <Th>Detalles</Th>
            </tr>
          </thead>
          <tbody>
            {(logs ?? []).map((l) => (
              <tr key={l.id}>
                <Td className="whitespace-nowrap">{formatDateTime(l.created_at)}</Td>
                <Td>{actors?.find((a) => a.id === l.actor_id)?.email ?? (l.actor_id ? l.actor_id.slice(0, 8) : "sistema")}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="text-xs">
                  {l.entity}
                  <br />
                  <span className="text-ink-3">{l.entity_id}</span>
                </Td>
                <Td>
                  <details className="text-xs">
                    <summary className="cursor-pointer">Ver</summary>
                    <pre className="mt-1 max-w-md overflow-x-auto whitespace-pre-wrap">{JSON.stringify(l.details, null, 1)}</pre>
                  </details>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <div className="mt-4 flex gap-3 text-sm">
        {page > 0 ? <Link href={`?accion=${accion}&desde=${desde}&p=${page - 1}`} className="text-brand underline">← Más recientes</Link> : null}
        {(logs ?? []).length === PAGE ? <Link href={`?accion=${accion}&desde=${desde}&p=${page + 1}`} className="text-brand underline">Anteriores →</Link> : null}
      </div>
    </>
  );
}
