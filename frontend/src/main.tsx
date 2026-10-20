import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
import { CalendarDays, ChevronRight, Crown, Gamepad2, Medal, Play, Sparkles, Swords, Trophy, Users, Zap, Flame, Star, ArrowRight, CircleHelp, Brain, Smile, Puzzle, MessageSquare, Lightbulb } from "lucide-react";
import "./index.css"; import "./arcade.css"; import { ArcadeShell, Home } from "./Arcade";
import Daily from "./Daily";
import { Battle, RoomView } from "./Room";
import { Info, Footer, Guides } from "./Public"; import { Article, ArticlesIndex } from "./Articles"; import { AdsPreview } from "./AdsPreview"; import { NotFound } from "./NotFound";
import { Community } from "./Community";
import { Account } from "./Account";
import { Profile } from "./Profile";
import { Admin } from "./Admin";
import { Leaderboard, History, ChallengePage } from "./Pages";
import { api, getToken } from "./api";
import { GAMES } from "./games"; import { GameLibrary } from "./GameLibrary"; import Saboteur from "./Saboteur"; import { useParams, useSearchParams } from "react-router-dom";
function PracticeGame() { const { mode } = useParams(); const [sp] = useSearchParams(); const bots = Number(sp.get("bots") ?? 0); const diff = sp.get("difficulty") ?? "medium"; return <Daily key={`${mode}-${bots}-${diff}`} practice mode={mode} bots={bots} difficulty={diff} />; }

function App() {
  return <BrowserRouter><ArcadeShell><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/daily" element={<Daily />} />
    <Route path="/practice" element={<Daily practice />} /><Route path="/practice/:mode" element={<PracticeGame />} /><Route path="/saboteur" element={<Saboteur />} />
    <Route path="/how-to-play" element={<Info page="how" />} />
    <Route path="/guides/pattern-puzzles" element={<Info page="guide" />} />
    <Route path="/about" element={<Info page="about" />} />
    <Route path="/contact" element={<Info page="contact" />} />
    <Route path="/privacy" element={<Info page="privacy" />} />
    <Route path="/terms" element={<Info page="terms" />} />
    <Route path="/community-rules" element={<Info page="rules" />} />
    <Route path="/guides" element={<Guides />} />
    <Route path="/guides/riddle-solving" element={<Info page="riddle" />} />
    <Route path="/guides/memory-sequences" element={<Info page="memory" />} />
    <Route path="/guides/daily-challenge-strategy" element={<Info page="strategy" />} />
    <Route path="/cookies" element={<Info page="cookies" />} />
    <Route path="/disclaimer" element={<Info page="disclaimer" />} />
    <Route path="/community" element={<Community />} />
    <Route path="/profile" element={<Profile />} /><Route path="/account" element={<Account />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="/leaderboard" element={<Leaderboard />} />
    <Route path="/history" element={<History />} />
    <Route path="/challenge/:code" element={<ChallengePage />} />
    <Route path="/articles" element={<ArticlesIndex />} /><Route path="/articles/live-trivia-battles" element={<Article slug="live-trivia-battles" />} /><Route path="/articles/scoring-and-speed-bonus" element={<Article slug="scoring-and-speed-bonus" />} /><Route path="/articles/puzzle-types-guide" element={<Article slug="puzzle-types-guide" />} /><Route path="/ads-preview" element={<AdsPreview />} /><Route path="/battle" element={<Battle />} />
    <Route path="/room/:code" element={<RoomView />} /><Route path="*" element={<NotFound />} />
  </Routes></ArcadeShell></BrowserRouter>;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
