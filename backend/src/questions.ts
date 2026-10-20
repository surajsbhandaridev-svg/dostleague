import { istDateKey } from "@dostleague/shared";
export interface Q { type: string; category: string; difficulty: 1 | 2 | 3; prompt: string; options: string[]; correct: number; explanation: string }
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function mix(options: string[], answer: string, r: () => number) { const a = [...options]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return { options: a, correct: a.indexOf(answer) }; }
function numOpts(ans: number, r: () => number) { const s = new Set([ans]); while (s.size < 4) { const v = ans + Math.floor(r() * 9) - 4; if (v > 0) s.add(v); } return [...s].map(String); }

const hand: [string, string[], number, string, string, string][] = [
  ["Which planet has the shortest day in our solar system?", ["Earth", "Jupiter", "Mars", "Venus"], 1, "Jupiter rotates in about 10 hours.", "trivia", "Science"],
  ["Which is the longest river flowing mainly within India?", ["Ganga", "Godavari", "Yamuna", "Narmada"], 0, "The Ganga is the longest river flowing mainly within India.", "trivia", "Geography"],
  ["How many days in a week plus months in a year?", ["17", "19", "21", "12"], 1, "7 + 12 = 19.", "logic", "Logic"],
  ["🌧️ + 🌈 = ?", ["Monsoon", "Rainbow after rain", "Thunder", "Fog"], 1, "Rain plus rainbow suggests a rainbow after rain.", "emoji", "Emoji"],
  ["I have keys but no locks and a space but no room. What am I?", ["Piano", "Keyboard", "Map", "Safe"], 1, "A keyboard has keys and a space bar.", "riddle", "Riddles"],
  ["Which gas do plants absorb for photosynthesis?", ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], 2, "Plants take in CO2 and release oxygen.", "trivia", "Science"],
  ["🐝 + 🍯 + 🏠 = ?", ["Beehive", "Farm", "Garden", "Bakery"], 0, "Bee, honey and house make a beehive.", "emoji", "Emoji"],
  ["The more you take, the more you leave behind. What am I?", ["Footsteps", "Time", "Money", "Breath"], 0, "Each step leaves a footstep.", "riddle", "Riddles"],
  ["How many sides does a hexagon have?", ["5", "6", "7", "8"], 1, "Hex means six.", "trivia", "Maths"],
  ["In which direction does the sun rise?", ["West", "North", "East", "South"], 2, "The sun rises in the east.", "trivia", "Geography"],
  ["Which ocean is the largest?", ["Atlantic", "Indian", "Pacific", "Arctic"], 2, "The Pacific covers about a third of Earth's surface.", "trivia", "Geography"],
  ["What is the chemical symbol for gold?", ["Go", "Au", "Ag", "Gd"], 1, "Au comes from the Latin word aurum.", "trivia", "Science"],
  ["How many minutes are in three hours?", ["120", "150", "180", "240"], 2, "3 × 60 = 180.", "logic", "Maths"],
  ["🌞 + 🏖️ + 🌊 = ?", ["Winter hike", "Beach day", "City tour", "Snowfall"], 1, "Sun, beach and waves point to a beach day.", "emoji", "Emoji"],
  ["What has hands but cannot clap?", ["Clock", "Statue", "Glove", "Tree"], 0, "A clock has hour and minute hands.", "riddle", "Riddles"],
  ["Which part of a plant usually absorbs water from the soil?", ["Leaves", "Roots", "Petals", "Fruit"], 1, "Roots take up water and minerals.", "trivia", "Science"],
  ["Which is the smallest prime number?", ["0", "1", "2", "3"], 2, "2 is the smallest prime; 1 is not prime.", "trivia", "Maths"],
  ["Which Indian city is known as the Pink City?", ["Jodhpur", "Jaipur", "Udaipur", "Jaisalmer"], 1, "Jaipur's old town is painted pink.", "trivia", "Geography"],
  ["A train leaves at 9:15 and the trip takes 2 hours 50 minutes. When does it arrive?", ["11:55", "12:05", "12:15", "11:45"], 1, "9:15 + 2:50 = 12:05.", "logic", "Logic"],
  ["📚 + 🔍 + 🏛️ = ?", ["Library", "Bakery", "Stadium", "Airport"], 0, "Books, searching and a building suggest a library.", "emoji", "Emoji"],
  ["What gets wetter the more it dries?", ["Sponge", "Towel", "Rain", "Soap"], 1, "A towel soaks up water as it dries things.", "riddle", "Riddles"],
  ["Which instrument has black and white keys?", ["Flute", "Piano", "Drum", "Violin"], 1, "A piano keyboard has black and white keys.", "trivia", "Music"],
  ["How many continents are there in the common seven-continent model?", ["5", "6", "7", "8"], 2, "Africa, Antarctica, Asia, Australia, Europe, North America and South America.", "trivia", "Geography"],
  ["If today is Wednesday, what day will it be in 10 days?", ["Friday", "Saturday", "Sunday", "Monday"], 1, "10 days is one week plus 3 days.", "logic", "Logic"],
  ["Which planet is known as the Red Planet?", ["Venus", "Mars", "Mercury", "Saturn"], 1, "Iron oxide gives Mars its red colour.", "trivia", "Science"],
  ["🐢 + 🐇 + 🏁 = ?", ["Slow and steady wins", "Quick feast", "Winter sleep", "Ocean race"], 0, "The tortoise, hare and finish line recall the old fable.", "emoji", "Emoji"],
  ["I am tall when I'm young and short when I'm old. What am I?", ["Candle", "Tree", "River", "Shadow"], 0, "A candle burns down as it ages.", "riddle", "Riddles"],
  ["What is 15% of 200?", ["20", "25", "30", "35"], 2, "0.15 × 200 = 30.", "logic", "Maths"],
  ["Which organ pumps blood around the human body?", ["Liver", "Lungs", "Heart", "Kidney"], 2, "The heart pumps blood.", "trivia", "Science"],
  ["Which month has the fewest days?", ["January", "February", "April", "June"], 1, "February has 28 days, or 29 in a leap year.", "trivia", "General"],
  // --- reserved for practice mode only (never used in daily packs) ---
  ["Which is the largest planet in our solar system?", ["Saturn", "Jupiter", "Neptune", "Earth"], 1, "Jupiter is the largest planet.", "trivia", "Science"],
  ["How many legs does a spider have?", ["6", "8", "10", "12"], 1, "Spiders are arachnids with eight legs.", "trivia", "Science"],
  ["What is 9 × 8?", ["64", "72", "81", "78"], 1, "9 × 8 = 72.", "logic", "Maths"],
  ["☔ + 🧥 + 👢 = ?", ["Rainy day outfit", "Beach party", "Desert trek", "Summer picnic"], 0, "Umbrella, coat and boots suit rain.", "emoji", "Emoji"],
  ["What can you catch but not throw?", ["Cold", "Wall", "Moon", "Echo"], 0, "You can catch a cold.", "riddle", "Riddles"],
  ["Which gas makes up most of Earth's atmosphere?", ["Oxygen", "Nitrogen", "Argon", "Hydrogen"], 1, "About 78% of the air is nitrogen.", "trivia", "Science"],
  ["Which direction is opposite to north?", ["East", "West", "South", "Northeast"], 2, "South is opposite north.", "trivia", "Geography"],
  ["A shirt costs 400 after a 20% discount. What was the original price?", ["480", "500", "520", "450"], 1, "400 is 80% of the original, so the original is 500.", "logic", "Maths"],
  ["🎂 + 🕯️ + 🎈 = ?", ["Birthday party", "Wedding", "Exam", "Picnic"], 0, "Cake, candle and balloon point to a birthday.", "emoji", "Emoji"],
  ["Which animal is known as the ship of the desert?", ["Horse", "Camel", "Elephant", "Donkey"], 1, "Camels carry people and goods across deserts.", "trivia", "General"],
];

export function generatePack(day: number): Q[] {
  const r = rng(day * 7919 + 13);
  const a = 2 + Math.floor(r() * 8), d = 2 + Math.floor(r() * 7), nxt = a + 5 * d;
  const g = 2 + Math.floor(r() * 2), g0 = 1 + Math.floor(r() * 3), gn = g0 * g ** 4;
  const x = 3 + Math.floor(r() * 9), y = 2 + Math.floor(r() * 6), tot = x * (y + 1);
  const syms = ["🔷", "🟢", "🟡", "🔺", "⭐", "🌙"]; const mem = [0, 1, 2, 3].map(() => syms[Math.floor(r() * 6)]); const pos = 1 + Math.floor(r() * 4); const pick = mem[pos - 1];
  const memOpts = [pick, ...syms.filter((s) => s !== pick).slice(0, 3)];
  const h = hand.slice(0, 30)[day % 30];
  return [
    { type: "pattern", category: "Patterns", difficulty: 1, prompt: `What comes next? ${[0, 1, 2, 3, 4].map((i) => a + i * d).join(", ")}, ?`, ...mix(numOpts(nxt, r), String(nxt), r), explanation: `Each term adds ${d}.` },
    { type: "pattern", category: "Patterns", difficulty: 2, prompt: `What comes next? ${[0, 1, 2, 3].map((i) => g0 * g ** i).join(", ")}, ?`, ...mix(numOpts(gn, r), String(gn), r), explanation: `Each term is multiplied by ${g}.` },
    { type: "logic", category: "Logic", difficulty: 2, prompt: `A box holds ${x} pens. You buy ${y} boxes and get one extra box free. How many pens in total?`, ...mix(numOpts(tot, r), String(tot), r), explanation: `${y} + 1 boxes of ${x} pens = ${tot}.` },
    { type: "memory", category: "Memory", difficulty: 2, prompt: `Memorise: ${mem.join(" ")} (hidden after 4s). Which symbol was in position ${pos}?`, ...mix(memOpts, pick, r), explanation: `Position ${pos} was ${pick}.` },
    { type: h[4], category: h[5], difficulty: 1, prompt: h[0], options: h[1], correct: h[2], explanation: h[3] },
  ];
}
/** Practice pack: 4 generated questions with a random seed + 1 reserved handwritten question. Never overlaps ranked packs (seeds >= 1,000,000; hand questions 30-39). */
export function generatePractice(seed: number): Q[] {
  const g = generatePack(seed).slice(0, 4); const h = hand[30 + (seed % 10)];
  return [...g, { type: h[4], category: h[5], difficulty: 1, prompt: h[0], options: h[1], correct: h[2], explanation: h[3] }];
}
export type Mode = "daily" | "trivia" | "emoji" | "riddle" | "pattern" | "memory" | "math" | "oddone" | "scramble";
function pick<T>(a: T[], n: number, r: () => number): T[] { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x.slice(0, n); }
export const GROUPS: Record<string, string[]> = { fruits: ["Mango", "Apple", "Banana", "Grape", "Orange", "Papaya", "Guava"], animals: ["Tiger", "Camel", "Dolphin", "Eagle", "Rabbit", "Panda", "Zebra"], vehicles: ["Bus", "Train", "Bicycle", "Scooter", "Truck", "Tram"], instruments: ["Piano", "Violin", "Flute", "Drum", "Guitar", "Sitar"], planets: ["Mars", "Venus", "Saturn", "Jupiter", "Mercury", "Neptune"], sports: ["Cricket", "Hockey", "Tennis", "Badminton", "Kabaddi", "Football"] };
export const WORDS = ["PLANET", "GARDEN", "SCHOOL", "MONSOON", "CRICKET", "MARKET", "RIVER", "BRIDGE", "FRIEND", "WINTER", "JUNGLE", "ISLAND", "DESERT", "SUMMER", "FOREST"];
/** Questions for a live-room mode. Rooms are unranked, so the whole handwritten pool may be used. */
export function generateMode(mode: Exclude<Mode, "daily">, seed: number): Q[] {
  if (mode === "pattern") return [0, 1, 2, 3, 4].map((i) => generatePack(seed + i)[i % 2]);
  if (mode === "memory") return [0, 1, 2, 3, 4].map((i) => generatePack(seed + i)[3]);
  if (mode === "math") { // Math Rush: quick mental arithmetic, difficulty rises each question
    const r = rng(seed); const ops = ["+", "×", "-", "+", "×"];
    return ops.map((op, i) => { const a = 11 + Math.floor(r() * (25 + i * 10)), b = 3 + Math.floor(r() * (10 + i * 2));
      const [x, y] = op === "-" ? [Math.max(a, b) + b, b] : op === "×" ? [3 + Math.floor(r() * (8 + i)), 3 + Math.floor(r() * 9)] : [a, b]; const ans = op === "+" ? x + y : op === "-" ? x - y : x * y;
      return { type: "math", category: "Maths", difficulty: (i < 2 ? 1 : i < 4 ? 2 : 3) as 1 | 2 | 3, prompt: `${x} ${op} ${y} = ?`, ...mix(numOpts(ans, r), String(ans), r), explanation: `${x} ${op} ${y} = ${ans}.` }; });
  }
  if (mode === "oddone") { // Odd One Out: three items share a group, one comes from another
    const r = rng(seed); const names = Object.keys(GROUPS);
    return [0, 1, 2, 3, 4].map(() => { const [g, o] = pick(names, 2, r); const same = pick(GROUPS[g], 3, r); const odd = pick(GROUPS[o], 1, r)[0];
      return { type: "oddone", category: "Odd One Out", difficulty: 1 as const, prompt: "Which one does not belong?", ...mix([...same, odd], odd, r), explanation: `${odd} belongs with the ${o}; the others are ${g}.` }; });
  }
  if (mode === "scramble") { // Word Scramble: unscramble the letters, pick the right word
    const r = rng(seed);
    return pick(WORDS, 5, r).map((w) => { let s = w; for (let t = 0; t < 12 && s === w; t++) s = pick(w.split(""), w.length, r).join(""); if (s === w) s = w.slice(1) + w[0];
      return { type: "scramble", category: "Words", difficulty: 2 as const, prompt: `Unscramble: ${s}`, ...mix([w, ...pick(WORDS.filter((x) => x !== w), 3, r)], w, r), explanation: `${s} unscrambles to ${w}.` }; });
  }
  const r = rng(seed); const pool = hand.filter((h) => h[4] === mode).map((h) => ({ type: h[4], category: h[5], difficulty: 1 as const, prompt: h[0], options: h[1], correct: h[2], explanation: h[3] }));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 5);
}
export const DAYS = 365;
export function dateForDay(start: string, i: number) { const d = new Date(`${start}T12:00:00+05:30`); d.setDate(d.getDate() + i); return istDateKey(d); }
/** Local knowledge table used by trivia-style bots: question text -> answer text (a curated table, not the live answer key of a running match). */
export const KNOWLEDGE: Record<string, string> = Object.fromEntries(hand.map((h) => [h[0], h[1][h[2]]]));
