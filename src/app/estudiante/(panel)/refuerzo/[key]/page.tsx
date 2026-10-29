import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ModuleLesson } from "@/components/refuerzo/module-view";
import { SelfRecorder } from "@/components/refuerzo/self-recorder";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getModule } from "@/content/refuerzo";
import { requireRole } from "@/lib/auth/dal";
import { recordPractice } from "../../../actions";
import { DrillWithSave } from "./drill-with-save";

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }): Promise<Metadata> {
  const { key } = await params;
  return { title: getModule(key)?.title ?? "Refuerzo" };
}

export default async function ModulePage({ params }: { params: Promise<{ key: string }> }) {
  await requireRole("student");
  const { key } = await params;
  const m = getModule(key);
  if (!m) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/estudiante/refuerzo" className="underline">
            Biblioteca de refuerzo
          </Link>
        }
        title={m.title}
        description={m.summary}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <ModuleLesson module={m} />
        <div className="space-y-6">
          {m.speakingPrompt ? <SelfRecorder prompt={m.speakingPrompt} /> : null}
          <Card>
            <CardHeader title="Ejercicios" description="Al corregir, el resultado se guarda en su progreso." />
            <CardBody>
              <DrillWithSave moduleKey={m.key} exercises={m.exercises} save={recordPractice} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
