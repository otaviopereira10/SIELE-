import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { PublishedReport } from "@/lib/results/report";
import { objectivePercent } from "@/lib/results/report";

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  // evita la inyección de fórmulas al abrir el CSV en una hoja de cálculo
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Exporta en CSV los resultados publicados de una clase (solo si la profesora la tiene asignada: RLS). */
export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "teacher" && profile.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const classId = request.nextUrl.searchParams.get("clase") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(classId)) return NextResponse.json({ error: "Clase no válida" }, { status: 400 });
  const supabase = await createClient();
  const { data: cls } = await supabase.from("classes").select("id, name").eq("id", classId).maybeSingle();
  if (!cls) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });
  const { data: members } = await supabase.from("class_members").select("student_id").eq("class_id", classId);
  const ids = (members ?? []).map((m) => m.student_id);
  const { data: students } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const { data: results } = ids.length ? await supabase.from("published_results").select("student_id, published_at, report").in("student_id", ids) : { data: [] };

  const header = [
    "alumno",
    "correo",
    "simulacro",
    "publicado",
    "lectura_aciertos",
    "lectura_total",
    "lectura_porcentaje",
    "lectura_nivel_estimado",
    "auditiva_aciertos",
    "auditiva_total",
    "auditiva_porcentaje",
    "auditiva_nivel_estimado",
    "escrita_puntos",
    "escrita_max",
    "escrita_nivel_estimado",
    "oral_puntos",
    "oral_max",
    "oral_nivel_estimado",
  ];
  const lines = [header.join(";")];
  for (const r of results ?? []) {
    const rep = r.report as PublishedReport;
    const s = (students ?? []).find((x) => x.id === r.student_id);
    const sec = (skill: string) => rep.sections.find((x) => x.skill === skill);
    const obj = (skill: string) => {
      const o = sec(skill)?.objective;
      return o
        ? [o.correct, o.correct + o.wrong + o.blank, objectivePercent(o), o.estimate?.applicable ? o.estimate.level : ""]
        : ["", "", "", ""];
    };
    const prod = (skill: string) => {
      const p = sec(skill)?.productive;
      return p ? [p.total_points ?? "", p.max_points ?? "", p.estimate?.applicable ? p.estimate.level : ""] : ["", "", ""];
    };
    lines.push(
      [s?.full_name ?? "", s?.email ?? "", rep.attempt.assignment_title, r.published_at, ...obj("reading"), ...obj("listening"), ...prod("writing"), ...prod("speaking")]
        .map(csvCell)
        .join(";"),
    );
  }
  const body = "﻿" + lines.join("\r\n");
  const name = `resultados-${cls.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
