import { describe, expect, it } from "vitest";
import { addDays, dayLabel, daysBetween, firstPending, fitPlanToDate, isControlItem, itemDate, itemsOn, planPosition, weeksUntil } from "./schedule";
import { formatDate, todayISO } from "@/lib/utils";

describe("calendario del plan", () => {
  it("cuenta los días sin depender de la zona horaria", () => {
    expect(daysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(itemDate("2026-11-02", 2, 3)).toBe("2026-11-11");
  });

  it("sitúa el día de hoy dentro del plan", () => {
    expect(planPosition("2026-11-02", "2026-11-02", 4)).toEqual({ state: "active", week: 1, day: 1, rest: false });
    expect(planPosition("2026-11-02", "2026-11-08", 4)).toEqual({ state: "active", week: 1, day: 7, rest: true });
    expect(planPosition("2026-11-02", "2026-11-09", 4)).toEqual({ state: "active", week: 2, day: 1, rest: false });
    expect(planPosition("2026-11-02", "2026-11-01", 4).state).toBe("upcoming");
    expect(planPosition("2026-11-02", "2026-11-30", 4).state).toBe("finished");
  });

  it("nombra los días con su fecha real", () => {
    expect(dayLabel("2026-11-02", "2026-11-02")).toBe("Hoy");
    expect(dayLabel("2026-11-03", "2026-11-02")).toBe("Mañana");
    expect(dayLabel("2026-11-01", "2026-11-02")).toBe("Ayer");
    expect(dayLabel("2026-11-05", "2026-11-02")).toBe("Jueves 5 nov");
  });

  it("ajusta la duración a la fecha objetivo", () => {
    expect(weeksUntil("2026-11-02", "2026-11-30")).toBe(4);
    expect(weeksUntil("2026-11-02", "2026-11-03")).toBe(1);
    expect(weeksUntil("2026-11-02", "2028-01-01")).toBe(12);
    expect(weeksUntil("2026-11-02", null, 6)).toBe(6);
    expect(weeksUntil("2026-11-02", "2026-10-01", 6)).toBe(6);
  });
});

describe("actividades del plan", () => {
  const item = (id: string, week_no: number, day_no: number, position = 1, completed_at: string | null = null) => ({ id, week_no, day_no, position, completed_at });
  const items = [item("a", 1, 1), item("b", 1, 1, 2), item("c", 1, 2), item("d", 1, 3)];

  it("devuelve las actividades de un día, en orden", () => {
    expect(itemsOn([...items].reverse(), "2026-11-02", "2026-11-02").map((i) => i.id)).toEqual(["a", "b"]);
    expect(itemsOn(items, "2026-11-02", "2026-11-20")).toEqual([]);
  });

  it("propone primero lo que quedó atrás", () => {
    expect(firstPending(items, "2026-11-02", "2026-11-04")).toMatchObject({ item: { id: "a" }, overdue: true });
    expect(firstPending(items, "2026-11-02", "2026-11-02")).toMatchObject({ item: { id: "a" }, overdue: false });
  });

  it("no adelanta actividades de días futuros", () => {
    const done = [item("a", 1, 1, 1, "x"), item("b", 1, 1, 2, "x"), item("c", 1, 2)];
    expect(firstPending(done, "2026-11-02", "2026-11-02")).toBeNull();
    expect(firstPending(items, "2026-11-02", "2026-11-01")).toBeNull();
  });
});

describe("ajustar el plan a la fecha del examen", () => {
  const week = (week_no: number) =>
    [1, 2, 3, 4, 5, 6].map((day_no) => ({ week_no, day_no, position: 1, completed_at: null, minutes: 15, activity: "grammar", module_key: `m${week_no}-${day_no}` as string | null }));
  const control = { week_no: 2, day_no: 6, position: 1, completed_at: null, minutes: 15, activity: "timed_mock", module_key: null as string | null };
  const plan = [...week(1), ...week(2).slice(0, 5), control];

  it("no programa nada el día del examen ni después", () => {
    const fitted = fitPlanToDate(plan, "2026-11-02", "2026-11-10");
    for (const i of fitted) expect(itemDate("2026-11-02", i.week_no, i.day_no) < "2026-11-10").toBe(true);
  });

  it("adelanta el simulacro de control para dejar margen antes del examen", () => {
    const fitted = fitPlanToDate(plan, "2026-11-02", "2026-11-10");
    const moved = fitted.filter(isControlItem);
    expect(moved).toHaveLength(1);
    expect(itemDate("2026-11-02", moved[0].week_no, moved[0].day_no)).toBe("2026-11-07");
  });

  it("deja el plan como está si cabe entero", () => {
    expect(fitPlanToDate(plan, "2026-11-02", "2026-12-30")).toEqual(plan);
  });

  it("con el examen muy cerca conserva solo lo que da tiempo a hacer", () => {
    const fitted = fitPlanToDate(week(1), "2026-11-02", "2026-11-03");
    expect(fitted.map((i) => i.day_no)).toEqual([1]);
    expect(fitPlanToDate(week(1), "2026-11-02", "2026-11-02")).toEqual([]);
  });
});

describe("fechas de calendario", () => {
  it("no adelanta ni atrasa un día sin hora", () => {
    expect(formatDate("2026-11-15")).toContain("15");
  });

  it("calcula el día de hoy en la zona horaria de la aplicación", () => {
    // 01:00 UTC del día 2 sigue siendo el día 1 en São Paulo
    expect(todayISO(Date.parse("2026-11-02T01:00:00Z"))).toBe("2026-11-01");
    expect(todayISO(Date.parse("2026-11-02T12:00:00Z"))).toBe("2026-11-02");
  });
});
