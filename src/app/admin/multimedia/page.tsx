import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { requireAuthor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { MediaUploader } from "./uploader";

export const metadata: Metadata = { title: "Multimedia" };

export default async function MediaPage() {
  await requireAuthor();
  const supabase = await createClient();
  const { data: assets } = await supabase
    .from("media_assets")
    .select("id, path, kind, mime_type, size_bytes, duration_seconds, is_synthetic_voice, alt_text, source, check_status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const { data: signed } = assets?.length
    ? await supabase.storage.from("exam-media").createSignedUrls(
        assets.map((a) => a.path),
        900,
      )
    : { data: [] };
  return (
    <>
      <PageHeader
        title="Multimedia"
        description="Audios e imágenes del banco. Se guardan en un almacenamiento privado; los estudiantes solo reciben URLs temporales cuando el servidor autoriza cada reproducción."
      />
      <Card className="mb-6">
        <CardHeader title="Subir archivo" description="Se comprueba que el audio o la imagen se puede reproducir o cargar antes de registrarlo." />
        <CardBody>
          <MediaUploader />
        </CardBody>
      </Card>
      <Table>
        <thead>
          <tr>
            <Th>Archivo</Th>
            <Th>Tipo</Th>
            <Th>Detalles</Th>
            <Th>Estado</Th>
            <Th>Vista previa</Th>
          </tr>
        </thead>
        <tbody>
          {(assets ?? []).map((a) => {
            const url = signed?.find((s) => s.path === a.path)?.signedUrl;
            return (
              <tr key={a.id}>
                <Td>
                  <p className="font-mono text-xs break-all">{a.path}</p>
                  <p className="font-mono text-[0.7rem] text-ink-3 select-all">{a.id}</p>
                </Td>
                <Td>
                  {a.kind === "audio" ? "Audio" : "Imagen"}
                  {a.is_synthetic_voice ? <Badge tone="warn" className="ml-1">Voz sintética</Badge> : null}
                </Td>
                <Td className="text-xs text-ink-2">
                  {(a.size_bytes / 1024).toFixed(0)} KB{a.duration_seconds ? ` · ${Math.round(Number(a.duration_seconds))} s` : ""}
                  <br />
                  {a.alt_text || a.source} · {formatDate(a.created_at)}
                </Td>
                <Td>{a.check_status === "ok" ? <Badge tone="ok">Comprobado</Badge> : a.check_status === "failed" ? <Badge tone="danger">No reproducible</Badge> : <Badge>Sin comprobar</Badge>}</Td>
                <Td>
                  {url ? (
                    a.kind === "audio" ? (
                      <audio src={url} controls preload="none" className="w-56" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt={a.alt_text} className="h-16 rounded border border-line object-cover" />
                    )
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </>
  );
}
