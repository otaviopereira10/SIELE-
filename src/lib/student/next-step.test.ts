import { describe, expect, it } from "vitest";
import { journey, nextStep, type NextStepInput } from "./next-step";

const base: NextStepInput = {
  targetLevel: "B2",
  resubmissionAttemptId: null,
  inProgressAttemptId: null,
  submittedPending: 0,
  hasResults: false,
  measuredSkills: 0,
  goalReached: false,
  hasPlacement: true,
  hasPlan: true,
  planFinished: false,
  planOutdated: null,
  planItem: null,
  planDone: { done: 0, total: 10 },
  startableAssignment: null,
};
const assignment = { id: "a", mode: "formal" as const, label: "Empezar" };
const item = { title: "Ser y estar", moduleKey: "ser-estar", overdue: false, control: false };

describe("nextStep", () => {
  it("lo que pide la profesora va antes que todo", () => {
    expect(nextStep({ ...base, resubmissionAttemptId: "x", inProgressAttemptId: "y", targetLevel: null }).key).toBe("resubmission");
  });

  it("un simulacro empezado va antes que elegir objetivo, y avisa de que el tiempo corre", () => {
    const step = nextStep({ ...base, inProgressAttemptId: "y", targetLevel: null });
    expect(step.key).toBe("continue");
    expect(step.why).toContain("sigue corriendo");
  });

  it("recorre el camino en orden: objetivo, prueba de nivel, plan, práctica", () => {
    expect(nextStep({ ...base, targetLevel: null, hasPlacement: false, hasPlan: false }).key).toBe("goal");
    expect(nextStep({ ...base, hasPlacement: false, hasPlan: false }).key).toBe("placement");
    expect(nextStep({ ...base, hasPlan: false }).key).toBe("plan");
    expect(nextStep({ ...base, planItem: item })).toMatchObject({ key: "practice", title: "Ser y estar", href: "/estudiante/refuerzo/ser-estar" });
  });

  it("los resultados de un simulacro sirven de punto de partida", () => {
    expect(nextStep({ ...base, hasPlacement: false, hasResults: true, hasPlan: false }).key).toBe("plan");
  });

  it("explica que una actividad está atrasada", () => {
    expect(nextStep({ ...base, planItem: { ...item, overdue: true } }).why).toContain("póngase al día");
  });

  it("sin nada pendiente propone medirse con un simulacro", () => {
    expect(nextStep({ ...base, startableAssignment: assignment })).toMatchObject({ key: "mock", assignment });
  });

  it("no propone otro simulacro mientras el anterior se está corrigiendo", () => {
    expect(nextStep({ ...base, submittedPending: 1, startableAssignment: assignment }).key).toBe("waiting");
  });

  it("si un simulacro corrigió solo algunas pruebas, propone completarlo", () => {
    expect(nextStep({ ...base, hasResults: true, measuredSkills: 2, startableAssignment: assignment }).key).toBe("mock");
  });

  it("avisa cuando los últimos resultados alcanzan el objetivo y ofrece confirmarlo", () => {
    const step = nextStep({ ...base, goalReached: true, hasResults: true, measuredSkills: 4, startableAssignment: assignment });
    expect(step).toMatchObject({ key: "ready", href: "/estudiante/guia", assignment });
    expect(step.title).toContain("B2");
    expect(nextStep({ ...base, goalReached: true, inProgressAttemptId: "y" }).key).toBe("continue");
  });

  it("no da el objetivo por alcanzado si hay un simulacro por corregir", () => {
    expect(nextStep({ ...base, goalReached: true, hasResults: true, measuredSkills: 4, submittedPending: 1 }).key).toBe("waiting");
  });

  it("con el plan terminado no pide volver mañana: propone medirse o crear otro", () => {
    const finished = { ...base, hasResults: true, measuredSkills: 4, planFinished: true, planItem: { ...item, overdue: true } };
    expect(nextStep({ ...finished, startableAssignment: assignment })).toMatchObject({ key: "mock", title: "Mida cuánto ha avanzado" });
    expect(nextStep(finished)).toMatchObject({ key: "plan", title: "Ha terminado su plan" });
    const allDone = { ...base, hasResults: true, measuredSkills: 4, planDone: { done: 10, total: 10 } };
    expect(nextStep(allDone)).toMatchObject({ key: "plan", title: "Ha terminado su plan" });
  });

  it("si el objetivo cambió o hay correcciones nuevas, pide actualizar el plan", () => {
    const goal = nextStep({ ...base, planItem: item, planOutdated: { reason: "goal", planLevel: "B1" } });
    expect(goal).toMatchObject({ key: "plan", label: "Actualizar mi plan" });
    expect(goal.title).toContain("B1");
    expect(nextStep({ ...base, planItem: item, planOutdated: { reason: "results" } }).title).toContain("resultados nuevos");
  });

  it("el simulacro de control abre un simulacro, no una lección", () => {
    const control = { title: "Simulacro de control", moduleKey: null, overdue: false, control: true };
    expect(nextStep({ ...base, planItem: control, startableAssignment: assignment })).toMatchObject({ key: "mock", assignment });
    expect(nextStep({ ...base, planItem: control })).toMatchObject({ key: "practice", href: "/estudiante/plan" });
  });

  it("si hoy está todo hecho y el plan sigue en curso, deja descansar", () => {
    expect(nextStep({ ...base, hasResults: true, measuredSkills: 4, planDone: { done: 3, total: 10 } }).key).toBe("done");
  });
});

describe("journey", () => {
  it("marca lo hecho y un único paso actual", () => {
    expect(journey({ ...base, hasPlacement: false, hasPlan: false }).map((s) => s.state)).toEqual(["done", "current", "pending", "pending", "pending"]);
  });

  it("muestra el avance de la práctica", () => {
    expect(journey({ ...base, planDone: { done: 3, total: 10 } }).find((s) => s.key === "practice")).toMatchObject({ detail: "3 de 10", state: "current" });
  });

  it("el camino no se completa hasta alcanzar el objetivo", () => {
    const partial = journey({ ...base, hasResults: true, measuredSkills: 2 }).find((s) => s.key === "mock");
    expect(partial).toMatchObject({ detail: "2 de 4 pruebas" });
    expect(partial?.state).not.toBe("done");
    expect(journey({ ...base, hasResults: true, measuredSkills: 4, planDone: { done: 10, total: 10 } }).find((s) => s.key === "mock")?.state).toBe("current");
    expect(journey({ ...base, hasResults: true, measuredSkills: 4, goalReached: true }).find((s) => s.key === "mock")).toMatchObject({ state: "done", detail: "Objetivo alcanzado" });
  });

  it("da la práctica por hecha solo al completar el plan", () => {
    const steps = journey({ ...base, planDone: { done: 10, total: 10 } });
    expect(steps.find((s) => s.key === "practice")?.state).toBe("done");
    expect(steps.find((s) => s.key === "mock")?.state).toBe("current");
  });
});
