export const ACHIEVEMENTS = [
  { code: "first_dangal", title: "First Dangal", description: "Complete your first ranked Daily Dangal" },
  { code: "streak_3", title: "On a Roll", description: "Play the daily challenge 3 days in a row" },
  { code: "streak_7", title: "Week Warrior", description: "Play the daily challenge 7 days in a row" },
  { code: "high_scorer", title: "High Scorer", description: "Score 500 or more in a daily challenge" },
  { code: "first_battle", title: "First Battle", description: "Finish a live friend battle" },
  { code: "first_win", title: "Victory", description: "Win a live friend battle" },
  { code: "contributor", title: "Contributor", description: "Have a community challenge approved" },
];
export interface PlayerStats { dailyCount: number; bestScore: number; dates: string[]; matchesPlayed: number; matchesWon: number; approvedSubmissions: number }
/** Consecutive IST days with a ranked attempt, ending today (or yesterday if today isn't played yet). */
export function streak(dates: string[], today: string): number {
  const set = new Set(dates); const f = (t: number) => new Date(t).toISOString().slice(0, 10); let t = Date.parse(`${today}T00:00:00Z`);
  if (!set.has(f(t))) t -= 86400_000; let n = 0; while (set.has(f(t))) { n++; t -= 86400_000; } return n;
}
export function earnedCodes(s: PlayerStats, st: number): string[] {
  const c: string[] = []; if (s.dailyCount >= 1) c.push("first_dangal"); if (st >= 3) c.push("streak_3"); if (st >= 7) c.push("streak_7"); if (s.bestScore >= 500) c.push("high_scorer");
  if (s.matchesPlayed >= 1) c.push("first_battle"); if (s.matchesWon >= 1) c.push("first_win"); if (s.approvedSubmissions >= 1) c.push("contributor"); return c;
}
