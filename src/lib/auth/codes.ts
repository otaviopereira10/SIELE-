import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** El código en claro nunca se guarda: la base de datos solo conoce su SHA-256. */
export function hashInvitationCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase().replace(/[\s-]/g, "")).digest("hex");
}

export function generateInvitationCode(): string {
  // 12 caracteres sin ambigüedades (sin 0/O, 1/I/L), en grupos de cuatro
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  const raw = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

