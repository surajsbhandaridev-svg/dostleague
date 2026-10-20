import { describe, it, expect } from "vitest"; import { readFileSync } from "node:fs"; import { ROOM_MODES, SOLO_MODES } from "../src/modes.js";
describe("frontend game catalogue agrees with backend modes", () => {
  const src = readFileSync("../frontend/src/games.ts", "utf8");
  it("every friends mode is a backend room mode", () => { for (const m of src.matchAll(/friends: "\/battle\?mode=([a-z]+)"/g)) expect(ROOM_MODES as readonly string[]).toContain(m[1]); });
  it("every solo/bots practice route uses a backend solo mode", () => { for (const m of src.matchAll(/(?:solo|bots): "\/practice\/([a-z]+)/g)) expect(SOLO_MODES as readonly string[]).toContain(m[1]); });
});
