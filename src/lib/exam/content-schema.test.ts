import { describe, expect, it } from "vitest";
import { validateTaskContent } from "./content-schema";

const uuid = "11111111-1111-4111-8111-111111111111";

describe("validateTaskContent", () => {
  it("acepta un texto con huecos coherente con sus preguntas", () => {
    const res = validateTaskContent("dropdown_gap", { passage: "Uno [[1]] dos [[2]]." }, [1, 2]);
    expect(res.ok).toBe(true);
  });

  it("detecta huecos sin pregunta y preguntas sin hueco", () => {
    const res = validateTaskContent("dropdown_gap", { passage: "Uno [[1]] dos [[3]]." }, [1, 2]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const messages = res.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/pregunta 2/);
      expect(messages).toMatch(/\[\[3\]\]/);
    }
  });

  it("exige que las referencias multimedia existan", () => {
    const res = validateTaskContent("single_choice", { audio_key: "main", media: {} });
    expect(res.ok).toBe(false);
    const ok = validateTaskContent("single_choice", { audio_key: "main", media: { main: { asset_id: uuid, kind: "audio" } } });
    expect(ok.ok).toBe(true);
  });

  it("una tarea oral necesita segmentos de grabación", () => {
    const res = validateTaskContent("speaking", { parts: [{ key: "p1", instructions: "Hable." }] });
    expect(res.ok).toBe(false);
    const ok = validateTaskContent("speaking", {
      parts: [{ key: "p1", instructions: "Hable.", segments: [{ key: "s1", record_seconds: 60 }] }],
    });
    expect(ok.ok).toBe(true);
  });

  it("rechaza intervalos de palabras incoherentes", () => {
    const res = validateTaskContent("writing", { word_min: 300, word_max: 250 });
    expect(res.ok).toBe(false);
  });

  it("rechaza claves con caracteres no permitidos", () => {
    const res = validateTaskContent("speaking", {
      parts: [{ key: "Parte 1", instructions: "x", segments: [{ key: "s1", record_seconds: 30 }] }],
    });
    expect(res.ok).toBe(false);
  });
});
