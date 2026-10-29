import { describe, expect, it } from "vitest";
import { generateInvitationCode, hashInvitationCode, normalizeInvitationCode } from "./code-format";

describe("códigos de invitación", () => {
  it("tienen el formato XXXX-XXXX-XXXX sin caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInvitationCode();
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(code).not.toMatch(/[01OIL]/);
    }
  });

  it("el hash no depende de mayúsculas, espacios ni guiones", () => {
    expect(hashInvitationCode("abcd-efgh-jkmn")).toBe(hashInvitationCode(" ABCD EFGH JKMN "));
    expect(normalizeInvitationCode("ab cd-ef")).toBe("ABCDEF");
    expect(hashInvitationCode("ABCD-EFGH-JKMN")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no repite códigos en una muestra amplia", () => {
    const set = new Set(Array.from({ length: 2000 }, () => generateInvitationCode()));
    expect(set.size).toBe(2000);
  });
});
