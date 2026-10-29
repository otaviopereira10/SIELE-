import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExamRunner } from "@/components/exam/exam-runner";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { AttemptState } from "@/lib/exam/types";

export const metadata: Metadata = { title: "Simulacro" };

export default async function AttemptPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireRole("student");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  // get_attempt_state solo devuelve intentos del propio estudiante y aplica los vencimientos
  const { data, error } = await supabase.rpc("get_attempt_state", { p_attempt: id });
  if (error || !data) notFound();
  return <ExamRunner initialState={data as AttemptState} userId={profile.id} />;
}
