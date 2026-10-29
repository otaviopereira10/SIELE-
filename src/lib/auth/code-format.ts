import { createHash, randomBytes } from "node:crypto";

/**
 * Formato de los códigos de invitación, compartido por la aplicación y por los scripts de
 * consola (sin dependencias de Next.js). El código en claro nunca se guarda: solo su SHA-256.
 */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I/L

export function normalizeInvitationCode(code: string): string {
  return code.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function hashInvitationCode(code: string): string {
  return createHash("sha256").update(normalizeInvitationCode(code)).digest("hex");
}

/** 12 caracteres en grupos de cuatro, con muestreo por rechazo para no sesgar el alfabeto. */
export function generateInvitationCode(): string {
  const out: string[] = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < 12) {
    for (const b of randomBytes(16)) {
      if (b < limit && out.length < 12) out.push(ALPHABET[b % ALPHABET.length]);
    }
  }
  const raw = out.join("");
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}
