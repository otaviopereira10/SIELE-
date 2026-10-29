"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorCode, errorMessage } from "@/lib/exam/errors";

const ids = z.object({ attemptId: z.uuid(), taskId: z.uuid() });

type AudioResult = { ok: true; url: string; synthetic: boolean; remaining: number | null } | { ok: false; error: string; code: string | null };

/**
 * Autoriza una reproducción de audio. La base de datos comprueba el intento, la sección activa,
 * la navegación y el límite de escuchas; solo después se firma una URL temporal del archivo privado.
 */
export async function requestAudioUrl(attemptId: string, taskId: string, mediaKey: string): Promise<AudioResult> {
  const parsed = ids.extend({ mediaKey: z.string().regex(/^[a-z0-9_.-]{1,80}$/) }).safeParse({ attemptId, taskId, mediaKey });
  if (!parsed.success) return { ok: false, error: "Solicitud no válida.", code: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_audio_play", {
    p_attempt: attemptId,
    p_task: taskId,
    p_media_key: mediaKey,
  });
  if (error) return { ok: false, error: errorMessage(error), code: errorCode(error) };
  const play = data as { asset_id: string; remaining: number | null };

  const admin = createAdminClient();
  const { data: asset, error: assetError } = await admin
    .from("media_assets")
    .select("path, is_synthetic_voice")
    .eq("id", play.asset_id)
    .single();
  if (assetError || !asset) return { ok: false, error: "El audio no está disponible.", code: "media_not_found" };
  const { data: signed, error: signError } = await admin.storage.from("exam-media").createSignedUrl(asset.path, 600);
  if (signError || !signed) return { ok: false, error: "No se pudo preparar el audio.", code: null };
  return { ok: true, url: signed.signedUrl, synthetic: asset.is_synthetic_voice, remaining: play.remaining };
}

/** URLs firmadas de las imágenes de la tarea (sin límite de visualización). */
export async function getTaskImageUrls(attemptId: string, taskId: string): Promise<Record<string, string>> {
  if (!ids.safeParse({ attemptId, taskId }).success) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize_task_images", { p_attempt: attemptId, p_task: taskId });
  if (error || !Array.isArray(data) || data.length === 0) return {};
  const admin = createAdminClient();
  const { data: assets } = await admin.from("media_assets").select("id, path").in("id", data as string[]);
  const out: Record<string, string> = {};
  for (const a of assets ?? []) {
    const { data: signed } = await admin.storage.from("exam-media").createSignedUrl(a.path, 3600);
    if (signed) out[a.id] = signed.signedUrl;
  }
  return out;
}
