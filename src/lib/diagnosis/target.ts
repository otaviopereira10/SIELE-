import type { Skill } from "@/lib/exam/content-schema";
import { SKILL_ORDER, levelRank } from "@/lib/exam/skills";
import type { SkillProgress } from "./engine";

/**
 * Distancia hasta el nivel que necesita el estudiante, destreza por destreza. Los umbrales son los de
 * la tabla pública de referencia: sirven para orientar el estudio, nunca como nota oficial.
 */
export type ScoreUnit = "aciertos" | "puntos";

export interface ReferenceEntry {
  unit: ScoreUnit;
  max: number;
  bands: { level: string; min: number }[];
}
export type ReferenceTable = Partial<Record<Skill, ReferenceEntry>>;

export interface ScoringRow {
  skill: string;
  kind: string;
  bands: { level: string; min_raw?: number; min_points?: number }[];
  max_raw: number | null;
  max_points: number;
}

export function toReferenceTable(rows: readonly ScoringRow[]): ReferenceTable {
  const table: ReferenceTable = {};
  for (const row of rows) {
    const raw = row.kind === "raw_to_level";
    table[row.skill as Skill] = {
      unit: raw ? "aciertos" : "puntos",
      max: raw ? (row.max_raw ?? 0) : row.max_points,
      bands: row.bands.map((b) => ({ level: b.level, min: Number(raw ? b.min_raw : b.min_points) })),
    };
  }
  return table;
}

export type GapStatus = "reached" | "close" | "far" | "unknown";

export interface SkillGap {
  skill: Skill;
  status: GapStatus;
  level: string | null;
  /** lo que pide la tabla de referencia para el nivel objetivo */
  need: { value: number; max: number; unit: ScoreUnit } | null;
  /** lo obtenido en la misma escala, si la última prueba es comparable con la tabla */
  have: number | null;
  missing: number | null;
}

export function skillGaps(skills: readonly SkillProgress[], target: string | null | undefined, table: ReferenceTable): SkillGap[] {
  const goal = levelRank(target);
  return SKILL_ORDER.map((skill) => {
    const latest = skills.find((s) => s.skill === skill)?.latest ?? null;
    const reference = table[skill];
    const threshold = reference?.bands.find((b) => b.level === target);
    const need = reference && threshold ? { value: threshold.min, max: reference.max, unit: reference.unit } : null;
    const level = latest?.pedagogicalLevel ?? null;
    const rank = levelRank(level);
    const score = latest?.score ?? null;
    const have = need && score && score.unit === need.unit && score.max === need.max ? score.value : null;
    const status: GapStatus = goal < 0 || rank < 0 ? "unknown" : rank >= goal ? "reached" : rank === goal - 1 ? "close" : "far";
    return { skill, status, level, need, have, missing: need && have != null ? Math.max(0, Math.ceil(need.value - have)) : null };
  });
}

export interface GapSummary {
  reached: number;
  measured: number;
  total: number;
  /** la destreza medida más alejada del objetivo: por dónde conviene empezar */
  weakest: Skill | null;
}

export function gapSummary(gaps: readonly SkillGap[]): GapSummary {
  const measured = gaps.filter((g) => g.status !== "unknown");
  const pending = measured.filter((g) => g.status !== "reached").sort((a, b) => levelRank(a.level) - levelRank(b.level));
  return { reached: measured.filter((g) => g.status === "reached").length, measured: measured.length, total: gaps.length, weakest: pending[0]?.skill ?? null };
}
