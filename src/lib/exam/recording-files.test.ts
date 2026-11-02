import { describe, expect, it } from "vitest";
import { replacedRecordingFiles } from "./recording-files";

const current = "p1-q1-1793587900000.webm";

describe("replacedRecordingFiles", () => {
  it("elige las versiones anteriores del mismo segmento", () => {
    const files = ["p1-q1-1793587853813.webm", "p1-q1-1793587860000.ogg", current];
    expect(replacedRecordingFiles(files, "p1", "q1", current, new Set([current]))).toEqual(["p1-q1-1793587853813.webm", "p1-q1-1793587860000.ogg"]);
  });

  it("no toca la grabación vigente ni las de otros segmentos o partes", () => {
    const files = [current, "p1-q10-1793587853813.webm", "p1-q2-1793587853813.webm", "p2-q1-1793587853813.webm"];
    expect(replacedRecordingFiles(files, "p1", "q1", current, new Set([current]))).toEqual([]);
  });

  it("respeta una subida más reciente que aún no se ha registrado", () => {
    expect(replacedRecordingFiles([current, "p1-q1-1793587999999.webm"], "p1", "q1", current, new Set([current]))).toEqual([]);
  });

  it("nunca elige un archivo que otra grabación tenga registrado", () => {
    const shared = "a-b-1-1793587853813.webm";
    expect(replacedRecordingFiles([shared], "a", "b-1", "a-b-1-1793587900000.webm", new Set([shared]))).toEqual([]);
  });

  it("borra un archivo sin marca de tiempo solo si la vigente es posterior", () => {
    expect(replacedRecordingFiles(["p1-q1.webm", current], "p1", "q1", current, new Set([current]))).toEqual(["p1-q1.webm"]);
    expect(replacedRecordingFiles(["p1-q1-1793587853813.webm", "p1-q1.webm"], "p1", "q1", "p1-q1.webm", new Set(["p1-q1.webm"]))).toEqual([]);
  });
});
