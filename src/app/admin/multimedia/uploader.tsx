"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Alert } from "@/components/ui/primitives";
import { getBrowserClient } from "@/lib/supabase/browser";
import { registerMedia } from "../actions";

const ALLOWED: Record<string, "audio" | "image"> = {
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "audio/wav": "audio",
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
};
const EXT: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/wav": "wav",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Comprueba en el navegador que el archivo se reproduce o se carga, y obtiene la duración. */
function probe(file: File, kind: "audio" | "image"): Promise<{ ok: boolean; duration: number | null }> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const done = (r: { ok: boolean; duration: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    if (kind === "image") {
      const img = new Image();
      img.onload = () => done({ ok: img.naturalWidth > 0, duration: null });
      img.onerror = () => done({ ok: false, duration: null });
      img.src = url;
    } else {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => done({ ok: Number.isFinite(audio.duration) && audio.duration > 0, duration: Number.isFinite(audio.duration) ? audio.duration : null });
      audio.onerror = () => done({ ok: false, duration: null });
      audio.src = url;
    }
  });
}

export function MediaUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [transcript, setTranscript] = useState("");
  const [source, setSource] = useState("Material original");
  const [synthetic, setSynthetic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const kind = file ? ALLOWED[file.type] : undefined;

  const upload = async () => {
    if (!file || !kind) return;
    setBusy(true);
    setMsg(null);
    try {
      const check = await probe(file, kind);
      if (!check.ok) {
        setMsg({ ok: false, text: kind === "audio" ? "El navegador no puede reproducir este audio. Conviértalo a MP3." : "La imagen no se puede cargar." });
        return;
      }
      const path = `uploads/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error } = await getBrowserClient().storage.from("exam-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setMsg({ ok: false, text: "No se pudo subir el archivo (¿tiene permiso de autoría?)." });
        return;
      }
      const res = await registerMedia({
        path,
        kind,
        mime_type: file.type,
        size_bytes: file.size,
        duration_seconds: check.duration,
        is_synthetic_voice: kind === "audio" && synthetic,
        alt_text: alt,
        transcript: kind === "audio" ? transcript : "",
        source,
        playable: check.ok,
      });
      setMsg(res?.ok ? { ok: true, text: `Archivo registrado. Referencia: {"asset_id": "${(res.data as { id: string }).id}", "kind": "${kind}"}` } : { ok: false, text: res?.error ?? "Error." });
      if (res?.ok) {
        setFile(null);
        setAlt("");
        setTranscript("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Archivo (MP3, M4A, OGG, WAV, PNG, JPG, WEBP · máx. 25 MB)" htmlFor="file">
        <Input
          id="file"
          type="file"
          accept={Object.keys(ALLOWED).join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f && f.size <= 26_214_400 && ALLOWED[f.type] ? f : null);
            setMsg(f && !ALLOWED[f.type] ? { ok: false, text: "Formato no admitido." } : f && f.size > 26_214_400 ? { ok: false, text: "El archivo supera 25 MB." } : null);
          }}
        />
      </Field>
      <Field label={kind === "image" ? "Texto alternativo (descripción accesible)" : "Etiqueta"} htmlFor="alt">
        <Input id="alt" value={alt} onChange={(e) => setAlt(e.target.value)} />
      </Field>
      <Field label="Fuente / autoría" htmlFor="source">
        <Input id="source" value={source} onChange={(e) => setSource(e.target.value)} />
      </Field>
      {kind === "audio" ? (
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} className="size-4" />
          Voz sintética (se indicará al estudiante)
        </label>
      ) : null}
      {kind === "audio" ? (
        <Field label="Transcripción privada" htmlFor="transcript" className="md:col-span-2">
          <Textarea id="transcript" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        </Field>
      ) : null}
      <div className="md:col-span-2">
        <Button onClick={() => void upload()} disabled={!file || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          Comprobar y subir
        </Button>
        {msg ? <Alert tone={msg.ok ? "ok" : "danger"} className="mt-3" title={msg.text} /> : null}
      </div>
    </div>
  );
}
