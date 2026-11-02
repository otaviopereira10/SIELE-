/**
 * Qué debe hacer ahora el estudiante. Una sola respuesta, siempre, para que nadie tenga que decidir
 * por dónde seguir: lo urgente primero y, después, el camino objetivo → punto de partida → plan → práctica.
 */
export interface NextStepInput {
  targetLevel: string | null;
  resubmissionAttemptId: string | null;
  inProgressAttemptId: string | null;
  submittedPending: number;
  /** alguna prueba tiene una estimación de nivel */
  hasResults: boolean;
  /** pruebas (de 4) con una estimación de nivel: un simulacro no está completo hasta que se corrigen las cuatro */
  measuredSkills: number;
  /** las cuatro pruebas medidas alcanzan el objetivo */
  goalReached: boolean;
  hasPlacement: boolean;
  hasPlan: boolean;
  /** el calendario del plan ya ha pasado */
  planFinished: boolean;
  /** un plan propio que ya no refleja lo que se sabe del estudiante */
  planOutdated: { reason: "goal"; planLevel: string } | { reason: "results" } | null;
  /** primera actividad pendiente que toca hoy o que quedó atrás */
  planItem: { title: string; moduleKey: string | null; overdue: boolean; control: boolean } | null;
  planDone: { done: number; total: number } | null;
  startableAssignment: { id: string; mode: "practice" | "formal"; label: string } | null;
}

export type NextStep =
  | { key: "resubmission" | "continue" | "placement" | "plan" | "practice"; title: string; why: string; label: string; href: string }
  | { key: "ready"; title: string; why: string; label: string; href: string; assignment: { id: string; mode: "practice" | "formal"; label: string } | null }
  | { key: "goal" | "waiting" | "done"; title: string; why: string }
  | { key: "mock"; title: string; why: string; assignment: { id: string; mode: "practice" | "formal"; label: string } };

export function nextStep(s: NextStepInput): NextStep {
  if (s.resubmissionAttemptId) {
    return { key: "resubmission", title: "Su profesora le pide una nueva entrega", why: "Abra la tarea para leer el motivo y enviar la nueva versión.", label: "Abrir la tarea", href: `/estudiante/intentos/${s.resubmissionAttemptId}` };
  }
  if (s.inProgressAttemptId) {
    return {
      key: "continue",
      title: "Tiene un simulacro sin terminar",
      why: "Sus respuestas están guardadas, pero el tiempo de cada prueba sigue corriendo aunque salga. Vuelva cuanto antes.",
      label: "Continuar el simulacro",
      href: `/estudiante/intentos/${s.inProgressAttemptId}`,
    };
  }
  if (!s.targetLevel) {
    return { key: "goal", title: "¿Qué nivel de español necesita?", why: "Con su objetivo, la plataforma elige qué estudiar y le muestra cuánto le falta." };
  }
  if (s.goalReached && s.submittedPending === 0) {
    return {
      key: "ready",
      title: `Sus últimos resultados apuntan al nivel ${s.targetLevel}`,
      why: "Confírmelo con otro simulacro poco antes del examen. Si quiere más margen, siga con su plan o suba su objetivo.",
      label: "Repasar la guía del examen",
      href: "/estudiante/guia",
      assignment: s.startableAssignment,
    };
  }
  if (!s.hasPlacement && !s.hasResults) {
    return { key: "placement", title: "Averigüe desde dónde parte", why: "Una prueba corta, sin tiempo ni nota, para no empezar ni demasiado fácil ni demasiado difícil.", label: "Hacer la prueba de nivel", href: "/estudiante/prueba-de-nivel" };
  }
  if (!s.hasPlan) {
    return { key: "plan", title: "Cree su plan de estudio", why: `Un plan día a día hacia el nivel ${s.targetLevel}, ajustado al tiempo que tiene.`, label: "Crear mi plan", href: "/estudiante/plan" };
  }
  if (s.planOutdated) {
    return {
      key: "plan",
      title: s.planOutdated.reason === "goal" ? `Su plan sigue orientado al nivel ${s.planOutdated.planLevel}` : "Tiene resultados nuevos: actualice su plan",
      why:
        s.planOutdated.reason === "goal"
          ? `Ahora necesita el nivel ${s.targetLevel}. Actualice el plan para que las actividades se ajusten a ese objetivo.`
          : "Al actualizarlo, los errores que se repiten en sus correcciones pasan a ser las prioridades de su plan.",
      label: "Actualizar mi plan",
      href: "/estudiante/plan",
    };
  }
  const planExhausted = s.planFinished || Boolean(s.planDone && s.planDone.total > 0 && s.planDone.done >= s.planDone.total);
  if (!planExhausted && s.planItem) {
    if (s.planItem.control && s.startableAssignment) {
      return { key: "mock", title: "Ha llegado al simulacro de control", why: "Resérvele unas 3 h 15 min y compare el resultado con su objetivo. Al terminar, márquelo como hecho en su plan.", assignment: s.startableAssignment };
    }
    if (s.planItem.control) {
      return { key: "practice", title: "Ha llegado al simulacro de control", why: "Pídale a su profesora un simulacro y, al terminar, márquelo como hecho en su plan.", label: "Ver mi plan", href: "/estudiante/plan" };
    }
    return {
      key: "practice",
      title: s.planItem.title,
      why: s.planItem.overdue ? "Es la actividad pendiente más antigua de su plan: póngase al día con ella." : "Es lo que toca hoy en su plan. Al terminar los ejercicios, se marca sola.",
      label: "Empezar la actividad",
      href: s.planItem.moduleKey ? `/estudiante/refuerzo/${s.planItem.moduleKey}` : "/estudiante/plan",
    };
  }
  if (s.submittedPending > 0) {
    return { key: "waiting", title: "Su profesora está corrigiendo su simulacro", why: "Verá aquí el resultado en cuanto se publique. Mientras tanto, puede repasar en la biblioteca." };
  }
  if (s.startableAssignment && (s.measuredSkills < 4 || planExhausted)) {
    return {
      key: "mock",
      title: s.hasResults ? "Mida cuánto ha avanzado" : "Mida su nivel con un simulacro",
      why: s.hasResults ? "Un simulacro nuevo le dirá cuánto le falta ahora en cada prueba." : "Hoy no le queda nada del plan. Un simulacro le dirá cuánto le falta en cada prueba.",
      assignment: s.startableAssignment,
    };
  }
  if (planExhausted) {
    return {
      key: "plan",
      title: "Ha terminado su plan",
      why: s.hasResults ? "Cree el siguiente con lo que ya sabe de sus resultados. Si quiere repetir un simulacro, pídaselo a su profesora." : "Cree el siguiente y pídale a su profesora un simulacro para medir cuánto ha avanzado.",
      label: "Crear mi siguiente plan",
      href: "/estudiante/plan",
    };
  }
  return { key: "done", title: "Por hoy ya ha terminado", why: "Ha completado todo lo previsto. Volver mañana rinde más que hacerlo todo de golpe." };
}

export interface JourneyStep {
  key: string;
  title: string;
  detail: string;
  state: "done" | "current" | "pending";
  href: string;
}

/** El camino completo, para que el estudiante vea dónde está y qué le queda. */
export function journey(s: NextStepInput): JourneyStep[] {
  const practiced = Boolean(s.planDone && s.planDone.total > 0 && s.planDone.done >= s.planDone.total);
  const raw = [
    { key: "goal", title: "Objetivo", detail: s.targetLevel ? `Nivel ${s.targetLevel}` : "Elegir nivel", done: Boolean(s.targetLevel), href: "/estudiante/perfil" },
    { key: "start", title: "Punto de partida", detail: s.hasPlacement || s.hasResults ? "Medido" : "Prueba de nivel", done: s.hasPlacement || s.hasResults, href: "/estudiante/prueba-de-nivel" },
    { key: "plan", title: "Plan", detail: s.hasPlan ? "Creado" : "Crear", done: s.hasPlan, href: "/estudiante/plan" },
    { key: "practice", title: "Práctica", detail: s.planDone ? `${s.planDone.done} de ${s.planDone.total}` : "Actividades", done: practiced, href: "/estudiante/plan" },
    {
      key: "mock",
      title: "Simulacro",
      detail: s.goalReached ? "Objetivo alcanzado" : s.measuredSkills > 0 ? `${s.measuredSkills} de 4 pruebas` : "Comprobar nivel",
      done: s.goalReached,
      href: "/estudiante#simulacros",
    },
  ];
  let current = false;
  return raw.map(({ done, ...step }) => {
    if (done) return { ...step, state: "done" as const };
    if (!current) {
      current = true;
      return { ...step, state: "current" as const };
    }
    return { ...step, state: "pending" as const };
  });
}
