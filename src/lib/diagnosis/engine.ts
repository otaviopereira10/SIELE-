import type { Skill } from "@/lib/exam/content-schema";
import { LEVELS, SKILL_META, SKILL_ORDER, levelRank } from "@/lib/exam/skills";
import { objectivePercent, type LevelEstimate, type PublishedReport, type ReportSection } from "@/lib/results/report";
import { getModule } from "@/content/refuerzo";
import { categoryLabel, getCategory } from "./taxonomy";

/**
 * Motor de diagnóstico: convierte los informes publicados y las observaciones docentes en
 * prioridades concretas, errores recurrentes con evidencias, recomendaciones y un plan semanal.
 * Es determinista (mismas entradas → mismo resultado) y nunca promete una nota.
 */

export interface SkillSnapshot {
  skill: Skill;
  attemptId: string;
  date: string;
  /** porcentaje pedagógico: aciertos (comprensión) o media ponderada de bandas (producción) */
  percent: number | null;
  /** estimación con tabla pública verificada (puede no ser aplicable) */
  tableEstimate: LevelEstimate | null;
  /** nivel pedagógico estimado: siempre etiquetado como estimación interna */
  pedagogicalLevel: string | null;
  pedagogicalLevelBasis: string;
}

export interface SkillProgress {
  skill: Skill;
  latest: SkillSnapshot | null;
  previous: SkillSnapshot | null;
  delta: number | null;
  trend: "up" | "down" | "flat" | "na";
  history: { date: string; percent: number | null }[];
}

export interface RecurringError {
  category: string;
  label: string;
  count: number;
  attempts: number;
  systematic: boolean;
  examples: { quote: string; correction: string; explanation: string }[];
  module: string | null;
}

export interface Priority {
  key: string;
  title: string;
  why: string;
  evidence: string[];
  modules: string[];
  indicator: string;
  skill: Skill | "general";
  score: number;
}

export interface Diagnosis {
  generatedFrom: number;
  skills: SkillProgress[];
  strengths: string[];
  recurringErrors: RecurringError[];
  priorities: Priority[];
  weeklyGoal: string;
  globalRange: { min: number; max: number } | null;
}

const PASS_RATIO = 0.6;

export function levelFromObjective(byLevel: { level: string; correct: number; total: number }[]): string | null {
  const relevant = byLevel.filter((l) => levelRank(l.level) >= 1 && l.total > 0).sort((a, b) => levelRank(a.level) - levelRank(b.level));
  if (relevant.length === 0) return null;
  let reached: string | null = null;
  for (const l of relevant) {
    if (l.correct / l.total >= PASS_RATIO) reached = l.level;
    else break;
  }
  return reached ?? "pre_A1";
}

const LANGUAGE_CRITERIA = new Set(["cohesion", "correccion", "alcance", "uso_lengua"]);

export function levelFromBands(bands: number[]): string | null {
  if (bands.length === 0) return null;
  const sorted = [...bands].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  return LEVELS[Math.max(0, Math.min(5, median))];
}

export function snapshotFor(report: PublishedReport, section: ReportSection): SkillSnapshot | null {
  const base = { skill: section.skill, attemptId: report.attempt.id, date: report.attempt.submitted_at ?? report.generated_at };
  if (section.objective) {
    const o = section.objective;
    const estimate = o.estimate?.applicable ? o.estimate : null;
    return {
      ...base,
      percent: objectivePercent(o),
      tableEstimate: o.estimate ?? null,
      pedagogicalLevel: estimate?.level ?? levelFromObjective(o.by_level),
      pedagogicalLevelBasis: estimate
        ? "Tabla pública de aciertos (Guía de preparadores, 2016)"
        : "Estimación interna: nivel más alto con al menos un 60 % de aciertos en sus ítems",
    };
  }
  if (section.productive && section.productive.tasks.some((t) => t.evaluation)) {
    const evaluated = section.productive.tasks.filter((t) => t.evaluation?.pedagogical_percent != null);
    const percent = evaluated.length
      ? Math.round((evaluated.reduce((s, t) => s + Number(t.evaluation!.pedagogical_percent), 0) / evaluated.length) * 10) / 10
      : null;
    const bands = section.productive.tasks.flatMap((t) =>
      (t.evaluation?.criteria ?? []).filter((c) => LANGUAGE_CRITERIA.has(c.key) && c.band != null).map((c) => c.band as number),
    );
    const estimate = section.productive.estimate?.applicable ? section.productive.estimate : null;
    return {
      ...base,
      percent,
      tableEstimate: section.productive.estimate ?? null,
      pedagogicalLevel: estimate?.level ?? levelFromBands(bands),
      pedagogicalLevelBasis: estimate
        ? "Puntos por banda y puntos de corte públicos (Guía de preparadores, 2016)"
        : "Estimación interna: mediana de las bandas de uso de la lengua",
    };
  }
  return null;
}

function trendOf(delta: number | null): SkillProgress["trend"] {
  if (delta == null) return "na";
  if (delta >= 5) return "up";
  if (delta <= -5) return "down";
  return "flat";
}

const OBJECTIVE_MODULES: Record<Skill, (taskPosition: number) => string> = {
  reading: (p) => (p <= 3 ? "lectura-global" : p === 5 ? "cloze-gramatical" : "inferencia"),
  listening: (p) => (p <= 3 ? "escucha-estrategias" : "escucha-conferencias"),
  writing: () => "cumplir-enunciado",
  speaking: () => "desarrollar-ideas",
};

const CRITERION_MODULE: Record<string, (skill: Skill) => string> = {
  cohesion: () => "conectores",
  correccion: () => "concordancia",
  alcance: () => "precision-lexica",
  cumplimiento: (skill) => (skill === "speaking" ? "desarrollar-ideas" : "cumplir-enunciado"),
  uso_lengua: () => "fluidez",
};

/** Ordena los informes del más antiguo al más reciente. */
function chronological(reports: PublishedReport[]): PublishedReport[] {
  return [...reports].sort((a, b) =>
    (a.attempt.submitted_at ?? a.generated_at).localeCompare(b.attempt.submitted_at ?? b.generated_at),
  );
}

export function buildDiagnosis(input: PublishedReport[]): Diagnosis {
  const reports = chronological(input);

  // --- progreso por destreza -------------------------------------------------
  const skills: SkillProgress[] = SKILL_ORDER.map((skill) => {
    const snaps: SkillSnapshot[] = [];
    for (const r of reports) {
      for (const s of r.sections.filter((x) => x.skill === skill)) {
        const snap = snapshotFor(r, s);
        if (snap) snaps.push(snap);
      }
    }
    const latest = snaps.at(-1) ?? null;
    const previous = snaps.length > 1 ? snaps[snaps.length - 2] : null;
    const delta =
      latest?.percent != null && previous?.percent != null ? Math.round((latest.percent - previous.percent) * 10) / 10 : null;
    return { skill, latest, previous, delta, trend: trendOf(delta), history: snaps.map((s) => ({ date: s.date, percent: s.percent })) };
  });

  // --- errores recurrentes -----------------------------------------------------
  const errors = new Map<string, RecurringError & { attemptIds: Set<string>; severity: number }>();
  const strengthsFromTeacher: string[] = [];
  for (const r of reports) {
    for (const s of r.sections) {
      for (const t of s.productive?.tasks ?? []) {
        for (const f of t.evaluation?.feedback ?? []) {
          if (f.kind === "strength") {
            strengthsFromTeacher.push(f.explanation || `${categoryLabel(f.category)}${f.quote ? `: «${f.quote}»` : ""}`);
            continue;
          }
          if (f.kind !== "error") continue;
          const cur =
            errors.get(f.category) ??
            ({
              category: f.category,
              label: categoryLabel(f.category),
              count: 0,
              attempts: 0,
              systematic: false,
              examples: [],
              module: getCategory(f.category)?.module ?? null,
              attemptIds: new Set<string>(),
              severity: 0,
            } as RecurringError & { attemptIds: Set<string>; severity: number });
          cur.count += 1;
          cur.severity += f.severity ?? 2;
          cur.systematic ||= f.is_systematic;
          cur.attemptIds.add(r.attempt.id);
          cur.attempts = cur.attemptIds.size;
          if (f.quote && cur.examples.length < 3) {
            cur.examples.push({ quote: f.quote, correction: f.correction, explanation: f.explanation });
          }
          errors.set(f.category, cur);
        }
      }
    }
  }
  const recurringErrors: RecurringError[] = [...errors.values()]
    .sort((a, b) => b.count - a.count || b.severity - a.severity)
    .map(({ attemptIds: _ids, severity: _sev, ...rest }) => rest);

  // --- candidatos a prioridad ---------------------------------------------------
  const candidates: Priority[] = [];
  for (const e of errors.values()) {
    const cat = getCategory(e.category);
    candidates.push({
      key: `error:${e.category}`,
      title: e.label,
      why: e.systematic
        ? `Error sistemático señalado por la profesora (${e.count} ${e.count === 1 ? "vez" : "veces"}).`
        : `Aparece ${e.count} ${e.count === 1 ? "vez" : "veces"} en las correcciones${e.attempts > 1 ? ` de ${e.attempts} simulacros` : ""}.`,
      evidence: e.examples.map((x) => (x.correction ? `«${x.quote}» → «${x.correction}»` : `«${x.quote}»`)),
      modules: e.module ? [e.module] : [],
      indicator: `En el próximo simulacro: como máximo una observación de «${e.label.toLowerCase()}» por tarea.`,
      skill: cat?.skills.length === 1 ? cat.skills[0] : "general",
      score: e.count * 2 + (e.systematic ? 3 : 0) + (e.attempts > 1 ? 3 : 0) + e.severity / 2,
    });
  }

  const latestReport = reports.at(-1);
  for (const sp of skills) {
    const snap = sp.latest;
    if (!snap) continue;
    const report = reports.find((r) => r.attempt.id === snap.attemptId);
    const section = report?.sections.find((s) => s.skill === sp.skill);
    if (section?.objective) {
      for (const t of section.objective.by_task) {
        const total = t.correct + t.wrong + t.blank;
        if (total === 0) continue;
        const pct = (t.correct / total) * 100;
        if (pct < 60) {
          const suggested = OBJECTIVE_MODULES[sp.skill](t.position);
          candidates.push({
            key: `task:${sp.skill}:${t.position}`,
            title: `${SKILL_META[sp.skill].label}: Tarea ${t.position}`,
            why: `${t.correct} de ${total} aciertos (${Math.round(pct)} %) en la última prueba.`,
            evidence: t.blank > 0 ? [`${t.blank} ${t.blank === 1 ? "pregunta quedó" : "preguntas quedaron"} sin responder.`] : [],
            modules: [suggested],
            indicator: `Superar el 60 % de aciertos en la Tarea ${t.position} del próximo simulacro.`,
            skill: sp.skill,
            score: (60 - pct) / 8 + 2 + (sp.trend === "down" ? 1 : 0),
          });
        }
      }
    }
    if (section?.productive) {
      for (const t of section.productive.tasks) {
        for (const c of t.evaluation?.criteria ?? []) {
          if (c.band == null || c.band > 2) continue;
          const suggested = CRITERION_MODULE[c.key]?.(sp.skill);
          if (!suggested) continue;
          candidates.push({
            key: `criterion:${sp.skill}:${c.key}`,
            title: `${c.label} (${SKILL_META[sp.skill].short.toLowerCase()})`,
            why: `Banda ${c.band} en la Tarea ${t.position}.${c.comment ? ` Comentario: «${c.comment}»` : ""}`,
            evidence: [],
            modules: [suggested],
            indicator: `Alcanzar al menos la banda ${c.band + 1} en «${c.label}» en la próxima evaluación.`,
            skill: sp.skill,
            score: (3 - c.band) * 2 + (c.key === "cumplimiento" ? 1.5 : 0),
          });
        }
      }
    }
  }

  // fusionar candidatos que apuntan al mismo módulo y quedarse con los tres mejores
  const merged = new Map<string, Priority>();
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const mod = c.modules[0] ?? c.key;
    const existing = merged.get(mod);
    if (existing) {
      existing.score += c.score / 2;
      existing.evidence = [...existing.evidence, c.why, ...c.evidence].slice(0, 4);
    } else {
      merged.set(mod, { ...c, evidence: [...c.evidence] });
    }
  }
  const priorities = [...merged.values()].sort((a, b) => b.score - a.score).slice(0, 3);

  // --- fortalezas ---------------------------------------------------------------------
  const strengths: string[] = [];
  for (const sp of skills) {
    if (sp.latest?.percent != null && sp.latest.percent >= 70) {
      strengths.push(`${SKILL_META[sp.skill].label}: ${sp.latest.percent} % en el último simulacro.`);
    }
    if (sp.trend === "up" && sp.delta != null) {
      strengths.push(`${SKILL_META[sp.skill].label}: mejora de ${sp.delta} puntos porcentuales respecto al intento anterior.`);
    }
  }
  if (latestReport) {
    for (const s of latestReport.sections) {
      for (const t of s.productive?.tasks ?? []) {
        for (const c of t.evaluation?.criteria ?? []) {
          if (c.band != null && c.band >= 4) strengths.push(`${c.label} (Tarea ${t.position}, ${SKILL_META[s.skill].short.toLowerCase()}): banda ${c.band}.`);
        }
      }
    }
  }
  strengths.push(...strengthsFromTeacher.slice(-3));

  // --- objetivo semanal y rango global ------------------------------------------------
  const top = priorities[0];
  const topModule = top?.modules[0] ? getModule(top.modules[0]) : undefined;
  const weeklyGoal = top
    ? `Trabajar «${top.title}»${topModule ? ` con el módulo «${topModule.title}»` : ""} al menos tres días y aplicarlo en una producción cronometrada.`
    : "Hacer un simulacro cronometrado para obtener un primer diagnóstico.";

  const ranges = skills.map((s) => s.latest?.tableEstimate).filter((e): e is LevelEstimate => Boolean(e?.applicable));
  const globalRange =
    ranges.length === 4
      ? {
          min: Math.round(ranges.reduce((sum, e) => sum + (e.min_points ?? 0), 0) * 100) / 100,
          max: Math.round(ranges.reduce((sum, e) => sum + (e.max_points ?? 0), 0) * 100) / 100,
        }
      : null;

  return {
    generatedFrom: reports.length,
    skills,
    strengths: [...new Set(strengths)].slice(0, 6),
    recurringErrors,
    priorities,
    weeklyGoal,
    globalRange,
  };
}

// ---------------------------------------------------------------------------
// Plan semanal
// ---------------------------------------------------------------------------
export type PlanActivity = "receptive" | "writing" | "speaking" | "vocabulary" | "grammar" | "timed_mock";

export interface PlanItem {
  week_no: number;
  day_no: number;
  position: number;
  activity: PlanActivity;
  skill: Skill | null;
  title: string;
  description: string;
  module_key: string | null;
  minutes: number;
}

const ACTIVITY_OF_MODULE: Record<string, PlanActivity> = {
  grammar: "grammar",
  vocabulary: "vocabulary",
  receptive: "receptive",
  writing: "writing",
  speaking: "speaking",
};

const FALLBACK_BY_ACTIVITY: Record<Exclude<PlanActivity, "timed_mock">, string> = {
  receptive: "lectura-global",
  writing: "cumplir-enunciado",
  speaking: "desarrollar-ideas",
  vocabulary: "precision-lexica",
  grammar: "pasados",
};

/**
 * Genera un plan de N semanas (6 días de trabajo y uno de descanso) que alterna práctica receptiva,
 * escritura, oral, vocabulario, gramática y simulacros cronometrados, priorizando el diagnóstico.
 */
export function generatePlan(diagnosis: Diagnosis, minutesPerDay: 15 | 30 | 60, weeks: number): PlanItem[] {
  const blocks = minutesPerDay / 15;
  const priorityModules = diagnosis.priorities.flatMap((p) => p.modules).filter((m, i, arr) => arr.indexOf(m) === i);
  const weakestReceptive =
    diagnosis.skills
      .filter((s) => s.skill === "reading" || s.skill === "listening")
      .sort((a, b) => (a.latest?.percent ?? 101) - (b.latest?.percent ?? 101))[0]?.skill ?? "reading";

  // rotación base de actividades; las prioridades aparecen con más frecuencia
  const rotation: PlanActivity[] = ["grammar", "receptive", "writing", "speaking", "vocabulary", "receptive"];
  const items: PlanItem[] = [];

  for (let week = 1; week <= weeks; week++) {
    let slot = 0;
    for (let day = 1; day <= 6; day++) {
      const isMockDay = day === 6;
      for (let b = 0; b < blocks; b++) {
        const position = b + 1;
        if (isMockDay && (b === 0 || minutesPerDay === 60)) {
          if (b > 0) continue; // el simulacro ocupa el día entero en la intensidad de 60 min
          const mockSkill = SKILL_ORDER[(week - 1) % 4];
          items.push({
            week_no: week,
            day_no: day,
            position,
            activity: "timed_mock",
            skill: mockSkill,
            title:
              minutesPerDay === 60
                ? `Simulacro cronometrado: ${SKILL_META[mockSkill].label}`
                : `Tarea cronometrada de ${SKILL_META[mockSkill].short.toLowerCase()}`,
            description:
              minutesPerDay === 60
                ? "Realice la prueba completa en condiciones de examen y anote qué le costó más."
                : "Haga una sola tarea con el temporizador visible y revise el resultado.",
            module_key: "gestion-tiempo",
            minutes: minutesPerDay === 60 ? 60 : 15,
          });
          continue;
        }
        // cada dos bloques, uno es de prioridad
        const usePriority = priorityModules.length > 0 && (slot % 2 === 0 || blocks === 1);
        let moduleKey: string;
        let activity: PlanActivity;
        if (usePriority) {
          moduleKey = priorityModules[(Math.floor(slot / 2) + week - 1) % priorityModules.length];
          activity = ACTIVITY_OF_MODULE[getModule(moduleKey)?.activity ?? "grammar"] ?? "grammar";
        } else {
          activity = rotation[(slot + week) % rotation.length];
          moduleKey =
            activity === "receptive"
              ? weakestReceptive === "listening"
                ? "escucha-estrategias"
                : "lectura-global"
              : FALLBACK_BY_ACTIVITY[activity as Exclude<PlanActivity, "timed_mock">];
        }
        const mod = getModule(moduleKey);
        items.push({
          week_no: week,
          day_no: day,
          position,
          activity,
          skill: mod?.skill && mod.skill !== "general" ? mod.skill : activity === "receptive" ? weakestReceptive : null,
          title: mod?.title ?? moduleKey,
          description: usePriority
            ? `Prioridad del diagnóstico. ${mod?.summary ?? ""}`.trim()
            : (mod?.summary ?? "Práctica de mantenimiento."),
          module_key: moduleKey,
          minutes: 15,
        });
        slot++;
      }
    }
  }
  return items;
}
