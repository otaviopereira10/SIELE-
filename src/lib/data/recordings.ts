import "server-only";
import { createClient } from "@/lib/supabase/server";

/** Direcciones estables de las grabaciones de un intento (véase /api/grabaciones/[id]). */
export async function recordingUrlsFor(attemptId: string): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data: recs } = await supabase.from("oral_recordings").select("id, task_id, part_key, segment_key").eq("attempt_id", attemptId).eq("status", "verified");
  const out: Record<string, string> = {};
  for (const r of recs ?? []) {
    const url = `/api/grabaciones/${r.id}`;
    out[`${r.task_id}/${r.part_key}/${r.segment_key}`] = url;
    out[r.id] = url;
  }
  return out;
}
