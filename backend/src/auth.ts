import { createHmac, randomBytes } from "node:crypto";
export const newToken = () => randomBytes(32).toString("base64url");
/** Only this HMAC is stored; the raw token lives in the player's browser. */
export const hashToken = (t: string, secret: string) => createHmac("sha256", secret).update(t).digest("hex");
