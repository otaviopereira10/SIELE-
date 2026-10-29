import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Drill } from "@/components/refuerzo/drill";
import { ModuleLesson } from "@/components/refuerzo/module-view";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getModule } from "@/content/refuerzo";
import { requireStaff } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Módulo de refuerzo" };

/** Vista docente de un módulo (los resultados de la profesora no se guardan). */
export default async function StaffModulePage({ params }: { params: Promise<{ key: string }> }) {
  await requireStaff();
  const { key } = await params;
  const m = getModule(key);
  if (!m) notFound();
  return (
    <>
      <PageHeader
        eyebrow={
          <Link href="/profesora/manual#refuerzo" className="underline">
            Manual · Biblioteca de refuerzo
          </Link>
        }
        title={m.title}
        description={m.summary}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <ModuleLesson module={m} />
        <Card>
          <CardHeader title="Ejercicios (vista previa)" />
          <CardBody>
            <Drill exercises={m.exercises} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
