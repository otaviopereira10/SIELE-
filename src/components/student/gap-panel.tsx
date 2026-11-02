import Link from "next/link";
import { Badge, Card, ProgressBar } from "@/components/ui/primitives";
import type { GapStatus, SkillGap } from "@/lib/diagnosis/target";
import { LEVEL_LABEL, SKILL_META } from "@/lib/exam/skills";
import { formatNumber } from "@/lib/utils";

const STATUS: Record<GapStatus, { label: string; tone: "ok" | "warn" | "danger" | "neutral" }> = {
  reached: { label: "Objetivo alcanzado", tone: "ok" },
  close: { label: "A un nivel", tone: "warn" },
  far: { label: "A más de un nivel", tone: "danger" },
  unknown: { label: "Sin medir", tone: "neutral" },
};

const BAR = { comprehension: "gold", writing: "blue", speaking: "orange" } as const;

function Detail({ gap, target }: { gap: SkillGap; target: string }) {
  if (gap.need && gap.have != null) {
    const { value, max, unit } = gap.need;
    return (
      <>
        <ProgressBar value={gap.have} max={max} tone={gap.status === "reached" ? "ok" : BAR[SKILL_META[gap.skill].tone]} label={`${formatNumber(gap.have)} de ${max} ${unit}`} />
        <p className="mt-2 text-sm text-ink-2">
          {gap.status === "reached" ? (
            <>
              Tiene {formatNumber(gap.have)} {unit}; para {target} hacen falta unos {value}.
            </>
          ) : (
            <>
              <strong className="text-ink">
                {gap.missing === 1 ? `Le falta 1 ${unit === "aciertos" ? "acierto" : "punto"}` : `Le faltan ${gap.missing} ${unit}`}
              </strong>{" "}
              para llegar a los {value} de {max} de referencia.
            </>
          )}
        </p>
      </>
    );
  }
  if (gap.status === "unknown") {
    return (
      <p className="text-sm text-ink-2">
        {gap.need ? `Para ${target}: unos ${gap.need.value} de ${gap.need.max} ${gap.need.unit}. ` : ""}
        Un simulacro corregido le dirá dónde está.
      </p>
    );
  }
  return gap.need ? (
    <p className="text-sm text-ink-2">
      Para {target}: unos {gap.need.value} de {gap.need.max} {gap.need.unit}.
    </p>
  ) : null;
}

/** Cuánto falta para el nivel objetivo en cada prueba. */
export function GapPanel({ gaps, target }: { gaps: SkillGap[]; target: string }) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {gaps.map((gap) => {
          const meta = SKILL_META[gap.skill];
          const status = STATUS[gap.status];
          return (
            <Card key={gap.skill} className="overflow-hidden">
              <div className={`h-1.5 stripe-${meta.tone}`} />
              <div className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-ink">{meta.short}</p>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <p className="text-sm text-ink-2">
                  {gap.level ? (
                    <>
                      Nivel estimado <strong className="text-lg text-ink">{LEVEL_LABEL[gap.level] ?? gap.level}</strong> · objetivo <strong className="text-ink">{target}</strong>
                    </>
                  ) : (
                    <>
                      Objetivo <strong className="text-ink">{target}</strong>
                    </>
                  )}
                </p>
                <Detail gap={gap} target={target} />
              </div>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Estimación de preparación, no una nota oficial. Los umbrales proceden de una tabla pública de 2016 y pueden no coincidir con los actuales.{" "}
        <Link href="/estudiante/guia#niveles" className="underline">
          Ver qué pide cada nivel
        </Link>
      </p>
    </div>
  );
}
