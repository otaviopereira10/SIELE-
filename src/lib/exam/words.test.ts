import { describe, expect, it } from "vitest";
import { countWords, wordRangeStatus } from "./words";

describe("countWords", () => {
  it("cuenta palabras con tildes, signos de apertura y puntuación", () => {
    expect(countWords("Hola, Nuria: ¿qué tal? Te escribo desde Granada — la ciudad es preciosa.")).toBe(12);
  });
  it("ignora espacios y saltos de línea múltiples", () => {
    expect(countWords("  uno\n\n dos\t tres   ")).toBe(3);
  });
  it("no cuenta símbolos aislados", () => {
    expect(countWords("— ... ¿ ! 2026")).toBe(1);
  });
  it("texto vacío", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("palabras con ñ, ü y apóstrofos o guiones cuentan como una", () => {
    expect(countWords("El niño bilingüe habla español-portugués")).toBe(5);
  });
});

describe("wordRangeStatus", () => {
  it("clasifica respecto al intervalo recomendado", () => {
    expect(wordRangeStatus(0, 100, 150)).toBe("empty");
    expect(wordRangeStatus(80, 100, 150)).toBe("below");
    expect(wordRangeStatus(120, 100, 150)).toBe("within");
    expect(wordRangeStatus(160, 100, 150)).toBe("above");
  });
});
