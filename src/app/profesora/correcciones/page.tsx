import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { loadQueue, loadTeacherOverview } from "@/lib/data/teacher";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { LEVELS, LEVEL_LABEL, SKILL_META, levelRank } from "@/lib/exam/skills";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Correcciones" };

const STATUS = {
  in_progress: { label: "En curso", tone: "brand" },
  submitted: { label: "Pendiente de corrección", tone: "warn" },
  resubmission_requested: { label: "Nueva entrega solicitada", tone: "danger" },
  published: { label: "Publicado", tone: "ok" },
  expired: { label: "Caducado", tone: "neutral" },
} as const;

type Search = { estado?: string; clase?: string; alumno?: string; destreza?: string; desde?: string; hasta?: string; nivel?: string };

export default async function QueuePage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireStaff();
  const sp = await searchParams;
  const [rows, overview] = await Promise.all([loadQueue(), loadTeacherOverview()]);

  // nivel pedagógico global estimado por alumno (mediana de sus destrezas)
  const levelOf = new Map<string, string | null>();
  for (const s of overview.students) {
    const d = buildDiagnosis(overview.results.filter((r) => r.student_id === s.id).map((r) => r.report));
    const ranks = d.skills.map((k) => levelRank(k.latest?.pedagogicalLevel)).filter((r) => r >= 0).sort((a, b) => a - b);
    levelOf.set(s.id, ranks.length ? LEVELS[ranks[Math.floor((ranks.length - 1) / 2)]] : null);
  }

  const estado = sp.estado ?? "pendiente";
  const q = (sp.alumno ?? "").toLowerCase().trim();
  const filtered = rows.filter((r) => {
    if (estado === "pendiente" && !(r.status === "submitted" || r.status === "resubmission_requested")) return false;
    if (estado === "borrador" && r.drafts === 0) return false;
    if (estado === "publicado" && r.status !== "published") return false;
    if (estado === "en_curso" && r.status !== "in_progress") return false;
    if (sp.clase && !r.class_ids.includes(sp.clase)) return false;
    if (q && !r.student_name.toLowerCase().includes(q)) return false;
    if (sp.destreza && !r.skills.includes(sp.destreza)) return false;
    if (sp.desde && (r.submitted_at ?? r.started_at) < sp.desde) return false;
    if (sp.hasta && (r.submitted_at ?? r.started_at) > `${sp.hasta}T23:59:59`) return false;
    if (sp.nivel && levelOf.get(r.student_id) !== sp.nivel) return false;
    return true;
  });

  const exportHref = sp.clase ? `/profesora/exportar?clase=${sp.clase}` : null;

  return (
    <>
      <PageHeader
        title="Correcciones"
        description="Intentos de sus alumnos. Los simulacros vencidos se cierran automáticamente al abrir esta página."
        actions={exportHref ? <ButtonLink href={exportHref} variant="secondary">Exportar clase (CSV)</ButtonLink> : null}
      />
      <form className="mb-5 grid gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-7" method="get">
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Estado</span>
          <select name="estado" defaultValue={estado} className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-2">
            <option value="pendiente">Pendientes</option>
            <option value="borrador">Con borrador</option>
            <option value="publicado">Publicados</option>
            <option value="en_curso">En curso</option>
            <option value="todos">Todos</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Clase</span>
          <select name="clase" defaultValue={sp.clase ?? ""} className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-2">
            <option value="">Todas</option>
            {overview.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Alumno</span>
          <input name="alumno" defaultValue={sp.alumno ?? ""} placeholder="Nombre" className="min-h-10 w-full rounded-md border border-line-strong px-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Destreza</span>
          <select name="destreza" defaultValue={sp.destreza ?? ""} className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-2">
            <option value="">Todas</option>
            {(["reading", "listening", "writing", "speaking"] as const).map((s) => (
              <option key={s} value={s}>
                {SKILL_META[s].short}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Nivel pedagógico</span>
          <select name="nivel" defaultValue={sp.nivel ?? ""} className="min-h-10 w-full rounded-md border border-line-strong bg-surface px-2">
            <option value="">Todos</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Desde</span>
          <input type="date" name="desde" defaultValue={sp.desde ?? ""} className="min-h-10 w-full rounded-md border border-line-strong px-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-ink-3">Hasta</span>
          <input type="date" name="hasta" defaultValue={sp.hasta ?? ""} className="min-h-10 w-full rounded-md border border-line-strong px-2" />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-7">
          <button type="submit" className="min-h-10 rounded-lg bg-brand px-4 text-sm font-medium text-white">
            Filtrar
          </button>
          <Link href="/profesora/correcciones?estado=todos" className="text-sm text-ink-3 underline">
            Limpiar filtros
          </Link>
        </div>
      </form>

      {filtered.length === 0 ? (
        <EmptyState title="No hay intentos con estos filtros" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Alumno</Th>
              <Th>Simulacro</Th>
              <Th>Enviado</Th>
              <Th>Estado</Th>
              <Th>Evaluación</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const st = STATUS[r.status as keyof typeof STATUS] ?? { label: r.status, tone: "neutral" as const };
              const productive = r.skills.filter((s) => s === "writing" || s === "speaking").length;
              return (
                <tr key={r.id}>
                  <Td>
                    <Link href={`/profesora/alumnos/${r.student_id}`} className="font-medium underline">
                      {r.student_name}
                    </Link>
                    {levelOf.get(r.student_id) ? <p className="text-xs text-ink-3">Nivel est. {LEVEL_LABEL[levelOf.get(r.student_id)!]}</p> : null}
                  </Td>
                  <Td>
                    {r.assignment_title}
                    <p className="text-xs text-ink-3">{r.mode === "formal" ? "Formal" : "Práctica"} · {r.skills.map((s) => SKILL_META[s as keyof typeof SKILL_META]?.short).join(", ")}</p>
                  </Td>
                  <Td>{formatDateTime(r.submitted_at)}</Td>
                  <Td>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Td>
                  <Td>
                    {productive ? (
                      <span className="text-sm">
                        {r.evaluated} completas{r.drafts ? ` · ${r.drafts} en borrador` : ""}
                      </span>
                    ) : (
                      <span className="text-sm text-ink-3">Solo corrección automática</span>
                    )}
                  </Td>
                  <Td>
                    {r.status !== "in_progress" ? (
                      <ButtonLink href={`/profesora/correcciones/${r.id}`} size="sm">
                        {r.status === "published" ? "Revisar" : "Corregir"}
                      </ButtonLink>
                    ) : (
                      <ButtonLink href={`/profesora/correcciones/${r.id}`} size="sm" variant="secondary">
                        Ver
                      </ButtonLink>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
