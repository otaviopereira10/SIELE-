import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanView, type PlanItemView } from "@/components/plan-view";
import { DiagnosisPanel } from "@/components/results/diagnosis-panel";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth/dal";
import { buildDiagnosis } from "@/lib/diagnosis/engine";
import type { PublishedReport } from "@/lib/results/report";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import { MODULES } from "@/content/refuerzo";
import { TeacherPlanForm } from "./plan-form";

export const metadata: Metadata = { title: "Ficha del alumno" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  // RLS: solo devuelve el perfil si el alumno pertenece a una clase de la profesora
  const { data: student } = await supabase.from("profiles").select("id, full_name, email, target_level, target_date, is_active").eq("id", id).eq("role", "student").maybeSingle();
  if (!student) notFound();
  const [{ data: results }, { data: attempts }, { data: plan }, { data: practice }] = await Promise.all([
    supabase.from("published_results").select("attempt_id, published_at, report").eq("student_id", id),
    supabase.from("attempts").select("id, status, mode, started_at, submitted_at, exam_assignments(title)").eq("student_id", id).order("started_at", { ascending: false }),
    supabase
      .from("study_plans")
      .select("id, title, minutes_per_day, weeks, starts_on, teacher_note, study_plan_items(id, week_no, day_no, position, activity, title, description, module_key, minutes, completed_at)")
      .eq("student_id", id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("practice_progress").select("module_key, score, max_score, completed_at").eq("student_id", id).order("completed_at", { ascending: false }).limit(20),
  ]);
  const diagnosis = buildDiagnosis((results ?? []).map((r) => r.report as PublishedReport));

  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/profesora/clases" className="underline">
            Clases y alumnos
          </Link>
        }
        title={student.full_name || student.email}
        description={`${student.email}${student.target_level ? ` · objetivo ${student.target_level}` : ""}${student.target_date ? ` para el ${formatDate(student.target_date)}` : ""}`}
      />
      <DiagnosisPanel diagnosis={diagnosis} moduleBase="/profesora/manual/refuerzo" />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Intentos" />
          <CardBody>
            <ul className="divide-y divide-line">
              {(attempts ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {(a.exam_assignments as unknown as { title: string } | null)?.title ?? "Simulacro"}
                    <span className="text-ink-3"> · {formatDateTime(a.submitted_at ?? a.started_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge>{a.status}</Badge>
                    <Link href={`/profesora/correcciones/${a.id}`} className="text-brand underline">
                      Abrir
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Práctica de refuerzo reciente" />
          <CardBody>
            {(practice ?? []).length === 0 ? (
              <p className="text-sm text-ink-3">Sin actividad.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {(practice ?? []).map((p, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{MODULES.find((m) => m.key === p.module_key)?.title ?? p.module_key}</span>
                    <span className="text-ink-3">
                      {p.score}/{p.max_score} · {formatDate(p.completed_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Plan de mejora" description="Genere un plan a partir del diagnóstico y añada una nota personal. Sustituye al plan activo." />
        <CardBody className="space-y-6">
          <TeacherPlanForm studentId={student.id} />
          {plan ? (
            <div>
              <p className="mb-3 font-medium">
                Plan activo: {plan.title} · desde {formatDate(plan.starts_on)}
              </p>
              <PlanView items={(plan.study_plan_items ?? []) as PlanItemView[]} moduleBase="/profesora/manual/refuerzo" editable={false} />
            </div>
          ) : null}
        </CardBody>
      </Card>
    </>
  );
}
