import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/dal";
import { isAiConfigured } from "@/lib/ai/feedback";
import { recordingUrlsFor } from "@/lib/data/recordings";
import { loadGrading } from "@/lib/data/teacher";
import { createClient } from "@/lib/supabase/server";
import { GradingWorkspace } from "./workspace";

export const metadata: Metadata = { title: "Corrección" };

export default async function GradingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const data = await loadGrading(id);
  if (!data) notFound();
  const recordingUrls = await recordingUrlsFor(id);
  const supabase = await createClient();
  const { data: setting } = await supabase.from("app_settings").select("value").eq("key", "ai.enabled").maybeSingle();
  const aiEnabled = isAiConfigured() && setting?.value === true;
  return (
    <>
      <p className="mb-3 text-sm">
        <Link href="/profesora/correcciones" className="text-brand underline">
          ← Volver a correcciones
        </Link>
        {data.attempt.status === "published" ? (
          <>
            {" · "}
            <Link href={`/profesora/informes/${id}`} className="text-brand underline">
              Ver el informe publicado
            </Link>
          </>
        ) : null}
      </p>
      <GradingWorkspace data={data} recordingUrls={recordingUrls} aiEnabled={aiEnabled} />
    </>
  );
}
