import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Dirección estable de una grabación. Con la sesión de quien la pide, RLS decide si puede verla
 * (el propio estudiante o su profesora) y solo entonces se firma una URL de corta duración.
 * Así la página nunca contiene enlaces que caducan mientras la profesora está corrigiendo.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: recording } = await supabase.from("oral_recordings").select("storage_path").eq("id", id).maybeSingle();
  if (!recording) return new NextResponse(null, { status: 404 });
  const { data: signed, error } = await supabase.storage.from("recordings").createSignedUrl(recording.storage_path, 300);
  if (error || !signed) return new NextResponse(null, { status: 502 });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
