import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * URLs firmadas (10 minutos) de las grabaciones de un intento, usando la sesión del usuario:
 * Storage solo las firma si sus políticas permiten leerlas (propietario o profesora de la clase).
 */
export async function recordingUrlsFor(attemptId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data: recs } = await supabase
    .from("oral_recordings")
    .select("id, task_id, part_key, segment_key, storage_path")
    .eq("attempt_id", attemptId)
    .eq("status", "verified");
  if (!recs?.length) return {};
  const { data: signed } = await supabase.storage.from("recordings").createSignedUrls(
    recs.map((r) => r.storage_path),
    600,
  );
  const out: Record<string, string> = {};
  for (const r of recs) {
    const s = signed?.find((x) => x.path === r.storage_path);
    if (s?.signedUrl) {
      out[`${r.task_id}/${r.part_key}/${r.segment_key}`] = s.signedUrl;
      out[r.id] = s.signedUrl;
    }
  }
  return out;
}
