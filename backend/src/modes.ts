/** Room modes accepted by the socket server. frontend/src/games.ts must only reference these ids (checked by test). */
export const ROOM_MODES = ["daily", "trivia", "emoji", "riddle", "pattern", "memory", "community", "caption", "math", "oddone", "scramble"] as const;
/** Quiz modes that can be played solo or against bots through /api/practice. */
export const SOLO_MODES = ["trivia", "emoji", "riddle", "pattern", "memory", "math", "oddone", "scramble"] as const;
