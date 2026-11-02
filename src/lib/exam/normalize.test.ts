import { describe, expect, it } from "vitest";
import { normalizeTaskContent } from "./normalize";

describe("normalizeTaskContent", () => {
  it("completa las viñetas de las opciones orales guardadas sin ellas (Tarea 4 del simulacro)", () => {
    const out = normalizeTaskContent("speaking", {
      parts: [{ key: "p1", instructions: "x", choice: { seconds: 30, options: [{ key: "a", title: "A", segments: [{ key: "q1", record_seconds: 60 }] }, { key: "b", title: "B" }] } }],
    }) as { parts: { read_seconds: number; prep_seconds: number; notes: boolean; choice: { options: { bullets: string[]; segments?: { wait_seconds: number }[] }[] } }[]; media: object };
    const part = out.parts[0];
    expect(part.choice.options.map((o) => o.bullets)).toEqual([[], []]);
    expect(part.choice.options[0].segments?.[0].wait_seconds).toBe(10);
    expect([part.read_seconds, part.prep_seconds, part.notes]).toEqual([0, 0, false]);
    expect(out.media).toEqual({});
  });

  it("respeta los valores guardados", () => {
    const out = normalizeTaskContent("speaking", {
      parts: [{ key: "p1", read_seconds: 30, choice: { seconds: 30, options: [{ key: "a", bullets: ["uno"] }] }, segments: [{ key: "r", wait_seconds: 0, record_seconds: 90 }] }],
    }) as { parts: { read_seconds: number; segments: { wait_seconds: number }[]; choice: { options: { bullets: string[] }[] } }[] };
    expect(out.parts[0].read_seconds).toBe(30);
    expect(out.parts[0].segments[0].wait_seconds).toBe(0);
    expect(out.parts[0].choice.options[0].bullets).toEqual(["uno"]);
  });

  it("completa las tareas escritas y tolera contenido vacío", () => {
    const out = normalizeTaskContent("writing", { options: [{ key: "a", title: "A" }] }) as { bullets: string[]; keyboard: boolean; options: { bullets: string[] }[] };
    expect(out.bullets).toEqual([]);
    expect(out.keyboard).toBe(true);
    expect(out.options[0].bullets).toEqual([]);
    expect(normalizeTaskContent("speaking", null)).toEqual({ media: {}, parts: [] });
  });
});
