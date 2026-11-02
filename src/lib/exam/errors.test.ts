import { describe, expect, it } from "vitest";
import { classifySaveError, errorMessage } from "./errors";

describe("classifySaveError", () => {
  it("conserva los cambios ante cortes, sesiones caducadas y fallos temporales", () => {
    expect(classifySaveError({ message: "TypeError: Failed to fetch" })).toBe("network");
    expect(classifySaveError({ message: "JWT expired", code: "PGRST303" })).toBe("session");
    expect(classifySaveError({ message: "not_authenticated", code: "P0001" })).toBe("session");
    expect(classifySaveError({ message: "canceling statement due to statement timeout", code: "57014" })).toBe("retry");
    expect(classifySaveError({ message: "Bad gateway", code: "" })).toBe("retry");
  });

  it("descarta lo que ya no se puede guardar", () => {
    expect(classifySaveError({ message: "time_expired", code: "P0001" })).toBe("closed");
    expect(classifySaveError({ message: "attempt_closed", code: "P0001" })).toBe("closed");
    expect(classifySaveError({ message: "too_many_selections", code: "P0001" })).toBe("rejected");
    expect(classifySaveError({ message: "invalid_payload", code: "P0001" })).toBe("rejected");
  });
});

describe("errorMessage", () => {
  it("explica los errores de grabación y de sesión", () => {
    expect(errorMessage({ message: "recording_empty" })).toMatch(/no contiene sonido/);
    expect(errorMessage({ message: "JWT expired" })).toMatch(/sesión/);
    expect(errorMessage({ message: "new row violates row-level security policy" })).toMatch(/no ha aceptado/);
    expect(errorMessage({ message: "algo inesperado" })).toMatch(/Inténtelo de nuevo/);
  });
});
