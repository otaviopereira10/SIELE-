import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { UsersTable } from "./users-table";

export const metadata: Metadata = { title: "Usuarios y roles" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; rol?: string }> }) {
  const me = await requireRole("admin");
  const { q = "", rol = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, email, full_name, role, is_active, can_author, created_at").order("created_at", { ascending: false }).limit(500);
  if (rol) query = query.eq("role", rol);
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, "")}%,email.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data } = await query;
  return (
    <>
      <PageHeader
        title="Usuarios y roles"
        description="Los roles solo se cambian aquí (y quedan auditados). Revocar el acceso desactiva la cuenta al instante en la base de datos y cierra sus sesiones."
      />
      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className="min-h-10 rounded-md border border-line-strong px-3" />
        <select name="rol" defaultValue={rol} className="min-h-10 rounded-md border border-line-strong bg-surface px-2">
          <option value="">Todos los roles</option>
          <option value="student">Estudiantes</option>
          <option value="teacher">Profesoras</option>
          <option value="admin">Administración</option>
        </select>
        <button className="min-h-10 rounded-lg bg-brand px-4 text-sm text-white">Filtrar</button>
      </form>
      <UsersTable users={data ?? []} meId={me.id} />
    </>
  );
}
