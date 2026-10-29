import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { RuleEditor } from "./rule-editor";

export const metadata: Metadata = { title: "Fuentes, versión y metodología" };

const V: Record<string, [string, "ok" | "warn" | "neutral" | "danger"]> = {
  verified: ["Verificada", "ok"],
  verified_older_edition: ["Solo en edición antigua", "warn"],
  pending: ["Pendiente de verificación", "neutral"],
  contradictory: ["Fuentes contradictorias", "danger"],
};

export default async function SourcesPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const [{ data: sources }, { data: rules }, { data: tables }] = await Promise.all([
    supabase.from("sources").select("id, code, title, url, edition, consulted_at, notes").order("code"),
    supabase.from("rule_sources").select("rule_key, area, description, value, verification, verified_at, notes, sources(code, title)").order("area"),
    supabase.from("scoring_tables").select("skill, kind, bands, max_raw, max_points, verification, notes, is_active").eq("is_active", true),
  ]);
  return (
    <>
      <PageHeader
        title="Fuentes, versión y metodología"
        description="Qué documento sustenta cada regla del examen, cuándo se consultó y si está verificada en documentación actualizada. Ninguna regla sin respaldo se presenta como oficial."
      />
      <Card className="mb-6">
        <CardHeader title="Metodología de puntuación de la plataforma" />
        <CardBody className="space-y-2 text-sm">
          <p>La plataforma distingue cuatro conceptos y nunca los mezcla:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <strong>Aciertos y errores observados</strong> en comprensión, corregidos con la clave privada (1 punto por ítem; los errores no restan).
            </li>
            <li>
              <strong>Puntuaciones pedagógicas internas:</strong> porcentaje de aciertos y desempeño ponderado de las bandas de la rúbrica.
            </li>
            <li>
              <strong>Estimación de nivel MCER</strong> con criterios documentados: tablas públicas de 2016 cuando son aplicables; si no, un nivel pedagógico
              estimado, etiquetado como tal.
            </li>
            <li>
              <strong>Puntuación oficial:</strong> la plataforma no la emite. Para comprensión solo muestra el intervalo de puntos de la franja (la guía no publica
              la conversión exacta acierto a acierto). Para producción aplica la tabla pública de puntos por banda solo si la prueba está completa.
            </li>
          </ol>
          <p className="text-ink-3">El total global (0–1000) solo se muestra como suma de intervalos cuando las cuatro pruebas tienen una conversión aplicable.</p>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Documentos consultados" />
        <CardBody>
          <ul className="space-y-3">
            {(sources ?? []).map((s) => (
              <li key={s.id} className="rounded-lg border border-line px-4 py-3 text-sm">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-brand underline">
                  {s.title}
                </a>
                <p className="text-ink-3">
                  {s.code} · {s.edition} · consulta: {formatDate(s.consulted_at)}
                </p>
                <p className="mt-1 text-ink-2">{s.notes}</p>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <Card className="mb-6">
        <CardHeader title="Reglas del examen y su respaldo" description="Puede actualizar el estado de verificación cuando consulte documentación nueva." />
        <CardBody className="space-y-3">
          {(rules ?? []).map((r) => {
            const [label, tone] = V[r.verification] ?? ["—", "neutral"];
            const src = r.sources as unknown as { code: string; title: string } | null;
            return (
              <div key={r.rule_key} className="rounded-lg border border-line px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p>
                    <span className="text-ink-3">{r.area} ·</span> <strong>{r.description}</strong>
                  </p>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                <p className="mt-1">{r.value}</p>
                <p className="text-xs text-ink-3">
                  Fuente: {src ? `${src.title} (${src.code})` : "Regla propia de la plataforma"}
                  {r.verified_at ? ` · verificada el ${formatDate(r.verified_at)}` : ""}
                </p>
                {r.notes ? <p className="mt-1 text-xs text-ink-2">{r.notes}</p> : null}
                <RuleEditor ruleKey={r.rule_key} verification={r.verification} verifiedAt={r.verified_at ?? ""} notes={r.notes} />
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tablas de puntuación activas" />
        <CardBody className="space-y-4 text-sm">
          {(tables ?? []).map((t) => (
            <div key={t.skill}>
              <p className="font-medium">
                {t.skill} · {t.kind === "raw_to_level" ? `aciertos → nivel (válida para ${t.max_raw} ítems)` : `puntos → nivel (sobre ${t.max_points})`}{" "}
                <Badge tone="warn">{t.verification}</Badge>
              </p>
              <p className="font-mono text-xs text-ink-2">
                {(t.bands as { level: string; min_raw?: number; max_raw?: number; min_points: number; max_points: number }[])
                  .map((b) => `${b.level}: ${b.min_raw != null ? `${b.min_raw}–${b.max_raw} aciertos → ` : ""}${b.min_points}–${b.max_points}`)
                  .join(" · ")}
              </p>
              <p className="text-xs text-ink-3">{t.notes}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
