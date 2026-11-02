"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { errorCode, errorMessage } from "@/lib/exam/errors";
import { replacedRecordingFiles } from "@/lib/exam/recording-files";

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

/**
 * Borra los archivos que una grabación nueva ha dejado sin uso: son audio privado que ya nadie puede
 * escuchar ni eliminar. El estudiante no tiene permiso de borrado en el almacenamiento, por eso se hace
 * aquí, solo en su propia carpeta y solo si su sesión ve la grabación vigente ya verificada.
 * Si falla no afecta a la entrega: la grabación nueva ya está guardada.
 */
export async function discardReplacedRecordings(attemptId: string, taskId: string, partKey: string, segmentKey: string): Promise<void> {
  const key = z.string().regex(/^[a-z0-9_-]{1,30}$/);
  if (!ids.extend({ partKey: key, segmentKey: key }).safeParse({ attemptId, taskId, partKey, segmentKey }).success) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const folder = `${user.id}/${attemptId}/${taskId}`;
  const { data: recordings } = await supabase.from("oral_recordings").select("storage_path, part_key, segment_key, status").eq("attempt_id", attemptId).eq("task_id", taskId);
  const current = recordings?.find((r) => r.part_key === partKey && r.segment_key === segmentKey && r.status === "verified" && r.storage_path.startsWith(`${folder}/`));
  if (!recordings || !current) return;

  const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
  const bucket = createAdminClient().storage.from("recordings");
  const { data: files, error: listError } = await bucket.list(folder, { limit: 1000 });
  if (listError || !files) {
    console.error("No se pudieron listar las grabaciones sustituidas", listError?.message);
    return;
  }
  const stale = replacedRecordingFiles(
    files.map((f) => f.name),
    partKey,
    segmentKey,
    fileName(current.storage_path),
    new Set(recordings.map((r) => fileName(r.storage_path))),
  );
  if (!stale.length) return;
  const { error } = await bucket.remove(stale.map((name) => `${folder}/${name}`));
  if (error) console.error("No se pudieron borrar las grabaciones sustituidas", error.message);
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
