/**
 * Carga el simulacro de ejemplo (contenido original) en un proyecto de Supabase.
 *
 *   node --env-file=.env.local --experimental-strip-types scripts/seed-content.ts
 *
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY (o SUPABASE_SERVICE_ROLE_KEY).
 * Es idempotente respecto a los archivos multimedia (upsert por ruta) y crea una versión nueva
 * de la plantilla en cada ejecución; las versiones anteriores no se modifican.
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { simulacro01 } from "../content/simulacro-01.ts";
import type { SeedExam, SeedMediaRef, SeedTask } from "../content/types.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) {
  console.error("Defina NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local");
  process.exit(1);
}
const db = createClient(url, secret, { auth: { persistSession: false } });

const scripts = JSON.parse(readFileSync(path.join(root, "content/audio/scripts.json"), "utf8")) as {
  files: { file: string; segments: { text: string }[] }[];
};
const transcriptOf = (file: string) =>
  scripts.files.find((f) => f.file === file)?.segments.map((s) => s.text).join("\n") ?? "";

const MIME: Record<string, string> = { ".mp3": "audio/mpeg", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

/** Para inserciones sin `.select()`: solo comprueba el error (los datos vienen vacíos). */
async function ok(label: string, p: PromiseLike<{ error: unknown }>): Promise<void> {
  const { error } = await p;
  if (error) throw new Error(`${label}: ${JSON.stringify(error)}`);
}

async function must<T>(label: string, p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error || data == null) throw new Error(`${label}: ${JSON.stringify(error ?? "sin datos")}`);
  return data as NonNullable<T>;
}

const assetCache = new Map<string, string>();
async function uploadMedia(ref: SeedMediaRef): Promise<string> {
  if (assetCache.has(ref.file)) return assetCache.get(ref.file)!;
  const local = ref.kind === "audio" ? path.join(root, "content/audio/files", ref.file) : path.join(root, "content/images", ref.file);
  if (!existsSync(local)) throw new Error(`Falta el archivo ${local}. Ejecute scripts/generate_audio.py o scripts/rasterize-images.mjs`);
  const body = readFileSync(local);
  const ext = path.extname(ref.file);
  const storagePath = `seed/${ref.file}`;
  await must("subida", db.storage.from("exam-media").upload(storagePath, body, { contentType: MIME[ext], upsert: true }));
  const row = await must(
    "media_assets",
    db
      .from("media_assets")
      .upsert(
        {
          path: storagePath,
          kind: ref.kind,
          mime_type: MIME[ext],
          size_bytes: body.length,
          is_synthetic_voice: ref.kind === "audio",
          alt_text: ref.alt ?? ref.label ?? "",
          transcript: ref.kind === "audio" ? transcriptOf(ref.file) : "",
          source: ref.kind === "audio" ? "Guion original; voz sintética (edge-tts)" : "Ilustración original de SIELE Trainer Pro",
          check_status: "ok",
          checked_at: new Date().toISOString(),
        },
        { onConflict: "path" },
      )
      .select("id")
      .single(),
  );
  assetCache.set(ref.file, row.id);
  return row.id;
}

async function resolveContent(task: SeedTask): Promise<Record<string, unknown>> {
  const content = structuredClone(task.content) as Record<string, unknown> & { media?: Record<string, SeedMediaRef> };
  const media: Record<string, { asset_id: string; kind: string; label?: string; max_plays?: number }> = {};
  for (const [key, ref] of Object.entries(content.media ?? {})) {
    media[key] = { asset_id: await uploadMedia(ref), kind: ref.kind, ...(ref.label ? { label: ref.label } : {}), ...(ref.max_plays != null ? { max_plays: ref.max_plays } : {}) };
  }
  content.media = media as never;
  return content;
}

async function seedExam(exam: SeedExam) {
  const { data: existing } = await db.from("exam_templates").select("id").eq("code", exam.code).maybeSingle();
  const templateId =
    existing?.id ??
    (await must("plantilla", db.from("exam_templates").insert({ code: exam.code, title: exam.title, description: exam.description }).select("id").single())).id;
  const { data: last } = await db.from("exam_versions").select("version_no").eq("template_id", templateId).order("version_no", { ascending: false }).limit(1);
  const { data: source } = await db.from("sources").select("id").eq("code", "SIELE_EXAMEN_WEB").maybeSingle();
  const version = await must(
    "versión",
    db
      .from("exam_versions")
      .insert({ template_id: templateId, version_no: (last?.[0]?.version_no ?? 0) + 1, format_label: exam.format_label, format_source_id: source?.id ?? null, notes: exam.notes })
      .select("id, version_no")
      .single(),
  );

  for (const [si, section] of exam.sections.entries()) {
    const sec = await must(
      "sección",
      db
        .from("exam_sections")
        .insert({
          version_id: version.id,
          skill: section.skill,
          position: si + 1,
          title: section.title,
          instructions: section.instructions,
          time_limit_seconds: section.time_limit_seconds,
          allow_back: section.allow_back,
          pause_after_seconds: section.pause_after_seconds,
        })
        .select("id")
        .single(),
    );
    for (const [ti, task] of section.tasks.entries()) {
      const content = await resolveContent(task);
      const t = await must(
        `tarea ${task.code}`,
        db
          .from("tasks")
          .insert({
            section_id: sec.id,
            position: ti + 1,
            code: task.code,
            title: task.title,
            interaction_type: task.type,
            level_label: task.level_label,
            instructions: task.instructions,
            content,
            declared_items: task.declared_items,
            suggested_seconds: task.suggested_seconds ?? null,
            max_audio_plays: task.max_audio_plays ?? 2,
            skill_focus: task.skill_focus ?? [],
            lexical_topic: task.lexical_topic ?? "",
            grammar_topic: task.grammar_topic ?? "",
            difficulty: task.difficulty ?? Math.min(5, ti + 1),
            source_ref: "Material original de SIELE Trainer Pro",
            reviewed_at: new Date().toISOString(),
          })
          .select("id")
          .single(),
      );
      const transcript = (task.transcript_from ?? []).map(transcriptOf).join("\n\n");
      if (transcript || task.teacher_notes) {
        await ok("privado", db.from("task_private").insert({ task_id: t.id, transcript, teacher_notes: task.teacher_notes ?? "" }));
      }
      const bankIds: string[] = [];
      for (const [bi, o] of (task.bank ?? []).entries()) {
        const row = await must("banco", db.from("question_options").insert({ task_id: t.id, question_id: null, position: bi + 1, label: o.label ?? "", body: o.body }).select("id").single());
        bankIds.push(row.id);
      }
      for (const [qi, q] of (task.questions ?? []).entries()) {
        const qr = await must(
          "pregunta",
          db
            .from("questions")
            .insert({ task_id: t.id, position: qi + 1, prompt: q.prompt, level: q.level ?? null, focus: q.focus ?? "", max_selections: q.max_selections ?? 1, points: q.points ?? 1 })
            .select("id")
            .single(),
        );
        const own: string[] = [];
        for (const [oi, o] of (q.options ?? []).entries()) {
          const row = await must("opción", db.from("question_options").insert({ task_id: t.id, question_id: qr.id, position: oi + 1, label: o.label ?? "", body: o.body }).select("id").single());
          own.push(row.id);
        }
        const pool = q.options?.length ? own : bankIds;
        const correct = (Array.isArray(q.correct) ? q.correct : [q.correct]).map((i) => pool[i]);
        if (correct.some((c) => !c)) throw new Error(`Clave fuera de rango en ${task.code} pregunta ${qi + 1}`);
        await ok("clave", db.from("question_keys").insert({ question_id: qr.id, correct_option_ids: correct, explanation: q.explanation }));
      }
      console.log(`  ✓ ${task.code}`);
    }
  }

  const result = (await must("publicación", db.rpc("publish_exam_version", { p_version: version.id }))) as { status: string; issues: unknown[] };
  if (result.status !== "published") {
    console.error("La versión no superó la validación:", JSON.stringify(result.issues, null, 2));
    process.exit(1);
  }
  console.log(`Publicada ${exam.code} v${version.version_no} (${version.id})`);
}

console.log("Cargando contenido de ejemplo…");
await seedExam(simulacro01);
