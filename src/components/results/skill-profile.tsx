import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import type { SkillProgress } from "@/lib/diagnosis/engine";
import { LEVEL_LABEL, SKILL_META } from "@/lib/exam/skills";
import { formatNumber } from "@/lib/utils";

/** Mini gráfico de la evolución del porcentaje pedagógico. */
export function Sparkline({ values, tone }: { values: (number | null)[]; tone: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null);
  if (pts.length < 2) return null;
  const w = 120;
  const h = 36;
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * (w - 6) + 3;
  const y = (v: number) => h - 3 - (v / 100) * (h - 6);
  const d = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-[120px]" role="img" aria-label={`Evolución: ${pts.map((p) => `${Math.round(p.v)} %`).join(", ")}`}>
      <path d={d} fill="none" stroke={`var(--${tone})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r="2.5" fill={`var(--${tone})`} />
      ))}
    </svg>
  );
}

const TONE = { comprehension: "gold", writing: "blue", speaking: "orange" } as const;

export function SkillProfile({ skills }: { skills: SkillProgress[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {skills.map((s) => {
        const meta = SKILL_META[s.skill];
        const tone = TONE[meta.tone];
        const TrendIcon = s.trend === "up" ? ArrowUpRight : s.trend === "down" ? ArrowDownRight : s.trend === "flat" ? ArrowRight : Minus;
        return (
          <Card key={s.skill} className="overflow-hidden">
            <div className={`h-1.5 stripe-${meta.tone}`} />
            <div className="space-y-2 px-4 py-4">
              <p className="text-sm font-medium text-ink-2">{meta.label}</p>
              {s.latest ? (
                <>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-3xl font-semibold tabular-nums">
                      {s.latest.percent != null ? `${formatNumber(s.latest.percent)} %` : "—"}
                    </p>
                    <Sparkline values={s.history.map((h) => h.percent)} tone={tone} />
                  </div>
                  <p className="flex items-center gap-1 text-sm text-ink-2">
                    <TrendIcon className="size-4" aria-hidden />
                    {s.delta != null ? `${s.delta > 0 ? "+" : ""}${formatNumber(s.delta)} p. p. respecto al intento anterior` : "Primer resultado"}
                  </p>
                  <p className="text-sm">
                    Nivel pedagógico estimado: <strong>{s.latest.pedagogicalLevel ? (LEVEL_LABEL[s.latest.pedagogicalLevel] ?? s.latest.pedagogicalLevel) : "—"}</strong>
                  </p>
                  <p className="text-xs text-ink-3">{s.latest.pedagogicalLevelBasis}</p>
                </>
              ) : (
                <p className="text-sm text-ink-3">Todavía no hay resultados publicados.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
