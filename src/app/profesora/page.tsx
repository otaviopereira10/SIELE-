import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { loadTeacherOverview } from "@/lib/data/teacher";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import { SKILL_META, SKILL_ORDER } from "@/lib/exam/skills";
import { formatNumber } from "@/lib/utils";

export const metadata: Metadata = { title: "Panel de la profesora" };

export default async function TeacherHome() {
  const profile = await requireStaff();
  const data = await loadTeacherOverview();
  const activeStudents = data.students.filter((s) => s.is_active);
  const pending = data.attempts.filter((a) => a.status === "submitted" || a.status === "resubmission_requested").length;
  const drafts = data.evaluations.filter((e) => e.status === "draft").length;
  const published = data.attempts.filter((a) => a.status === "published").length;

  // diagnóstico por estudiante para detectar quién necesita refuerzo
  const perStudent = activeStudents.map((s) => {
    const reports = data.results.filter((r) => r.student_id === s.id).map((r) => r.report);
    const d = buildDiagnosis(reports);
    const latest = d.skills.map((k) => k.latest?.percent).filter((p): p is number => p != null);
    const avg = latest.length ? latest.reduce((a, b) => a + b, 0) / latest.length : null;
    const declining = d.skills.filter((k) => k.trend === "down").length;
    return { student: s, diagnosis: d, avg, declining };
  });
  const needSupport = perStudent
    .filter((p) => p.avg != null && (p.avg < 55 || p.declining > 0 || p.diagnosis.recurringErrors.some((e) => e.systematic)))
    .sort((a, b) => (a.avg ?? 0) - (b.avg ?? 0))
    .slice(0, 8);

  const classAvg = SKILL_ORDER.map((skill) => {
    const vals = perStudent.map((p) => p.diagnosis.skills.find((k) => k.skill === skill)?.latest?.percent).filter((v): v is number => v != null);
    return { skill, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, n: vals.length };
  });

  return (
    <>
      <PageHeader
        eyebrow={`Hola, ${profile.fullName.split(" ")[0] || "profesora"}`}
        title="Visión general"
        actions={
          <>
            <ButtonLink href="/profesora/correcciones?estado=pendiente">Corregir pendientes ({pending})</ButtonLink>
            <ButtonLink href="/profesora/asignaciones" variant="secondary">
              Asignar simulacro
            </ButtonLink>
          </>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Alumnos activos" value={activeStudents.length} hint={`${data.classes.length} clases`} />
        <Stat label="Simulacros asignados" value={data.assignments.length} />
        <Stat label="Entregas pendientes" value={pending} tone={pending ? "danger" : undefined} />
        <Stat label="Evaluaciones en borrador" value={drafts} />
        <Stat label="Resultados publicados" value={published} tone="ok" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Alumnos que necesitan refuerzo" description="Rendimiento bajo, destrezas que empeoran o errores sistemáticos." />
          <CardBody>
            {needSupport.length === 0 ? (
              <EmptyState title="Nadie destaca por ahora">Aparecerán aquí cuando haya resultados publicados.</EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {needSupport.map((p) => (
                  <li key={p.student.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <Link href={`/profesora/alumnos/${p.student.id}`} className="font-medium text-brand underline">
                        {p.student.full_name || p.student.email}
                      </Link>
                      <p className="text-xs text-ink-3">
                        {p.diagnosis.priorities[0] ? `Prioridad: ${p.diagnosis.priorities[0].title}` : "Sin prioridades calculadas"}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      {p.avg != null ? <Badge tone={p.avg < 55 ? "danger" : "warn"}>{formatNumber(p.avg)} % medio</Badge> : null}
                      {p.declining ? <Badge tone="danger">Empeora en {p.declining}</Badge> : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evolución general de la clase" description="Media del último resultado publicado de cada alumno (estadística pedagógica)." />
          <CardBody className="space-y-4">
            {classAvg.map((c) => (
              <div key={c.skill}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{SKILL_META[c.skill].label}</span>
                  <span className="tabular-nums text-ink-2">{c.avg != null ? `${formatNumber(c.avg)} % · ${c.n} alumnos` : "sin datos"}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-3">
                  <div className={`h-full stripe-${SKILL_META[c.skill].tone}`} style={{ width: `${c.avg ?? 0}%` }} />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
