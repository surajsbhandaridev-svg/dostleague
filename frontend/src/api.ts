const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:10000";
const K = "dostleague.guestToken"; // guest credential only; clearing browser data loses this guest profile
export const getToken = () => localStorage.getItem(K);
const notifyAuthChange = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("dostleague:auth-change")); };
export const setToken = (token: string) => { localStorage.setItem(K, token); notifyAuthChange(); };
export const clearGuestToken = () => { try { localStorage.removeItem(K); } catch { /* ignore unavailable storage */ } notifyAuthChange(); };
export class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
export async function api<T>(path: string, body?: unknown, extra: Record<string, string> = {}): Promise<T> {
  const t = getToken();
  const res = await fetch(BASE + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, j.error ?? "error");
  return j as T;
}
export function guestErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "invalid_input") return "Choose a name with 2–24 characters. Use letters, numbers, spaces, dots, underscores or hyphens.";
    if (error.code === "email_already_exists") return "An account already uses this email. Sign in instead.";
    if (error.code === "invalid_credentials") return "Email or password is incorrect.";
    if (error.code === "account_already_linked") return "This player profile already has an account linked.";
    if (error.code === "rate_limited" || error.status === 429) return "Too many attempts. Please wait a little and try again.";
    if (error.status >= 500) return "The server could not save your name. Check the backend terminal and make sure the database is configured and migrations have run.";
    if (error.status === 401) return "Your guest session is not valid. Refresh the page and try again.";
    return `Could not continue (${error.code}). Please try again.`;
  }
  if (error instanceof TypeError) return "Cannot reach the game server. Make sure the backend is running at http://localhost:10000 and check its terminal for errors.";
  if (error instanceof Error && error.message === "invalid_name") return "Choose a name with 2–24 characters. Use letters, numbers, spaces, dots, underscores or hyphens.";
  return "Could not create your player profile. Check the server and database, then try again.";
}
export async function ensureGuest(name: string) {
  const displayName = name.trim();
  if (displayName.length < 2 || displayName.length > 24 || !/^[\p{L}\p{N} _.-]+$/u.test(displayName)) throw new Error("invalid_name");
  const r = await api<{ token: string }>("/api/guest", { displayName, avatar: "a1" });
  if (!r.token) throw new Error("missing_guest_token");
  setToken(r.token);
}
/** Pings /health, retrying while a sleeping free-tier backend wakes up. */
export async function waitForServer(onWaiting: () => void): Promise<void> {
  for (let i = 0; i < 12; i++) { try { await api("/health"); return; } catch { onWaiting(); await new Promise((r) => setTimeout(r, 5000)); } }
  throw new Error("offline");
}
