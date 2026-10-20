import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_BYTES = 64;
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_BYTES);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export function verifyPassword(password: string, encoded: string): boolean {
  try {
    const [scheme, saltHex, keyHex, extra] = encoded.split("$");
    if (scheme !== "scrypt" || !saltHex || !keyHex || extra !== undefined) return false;
    const salt = Buffer.from(saltHex, "hex"); const expected = Buffer.from(keyHex, "hex");
    if (salt.length !== 16 || expected.length !== KEY_BYTES) return false;
    const actual = scryptSync(password, salt, KEY_BYTES);
    return timingSafeEqual(actual, expected);
  } catch { return false; }
}
