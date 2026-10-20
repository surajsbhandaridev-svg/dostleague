export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 20;

/** Server-side scoring: 100 if correct, plus up to 20 for speed (linear over the time limit). Wrong/late = 0. */
export function scoreAnswer(correct: boolean, elapsedMs: number, limitMs: number): number {
  if (!correct || elapsedMs < 0 || elapsedMs > limitMs) return 0;
  return BASE_POINTS + Math.round(MAX_SPEED_BONUS * (1 - elapsedMs / limitMs));
}

/** Daily challenge date key (YYYY-MM-DD) using the Asia/Kolkata day boundary. */
export function istDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

/** Leaderboard order: higher score, then fewer total ms, then earlier submission. */
export const RANKING_RULE = "score DESC, total_ms ASC, created_at ASC";

export type QuestionType = "trivia" | "logic" | "emoji" | "memory" | "pattern" | "riddle";
export interface PublicQuestion { id: string; type: QuestionType; category: string; difficulty: 1 | 2 | 3; prompt: string; options: string[] }
