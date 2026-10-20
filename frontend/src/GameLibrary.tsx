import { useEffect, useRef, useState } from "react"; import { Link } from "react-router-dom"; import { ChevronRight, X, User, Bot, Users } from "lucide-react";
import { GAMES, FILTERS, MODE_LABEL, type Game } from "./games";
export function GameCard({ game, onOpen, lazy = true }: { game: Game; onOpen: (g: Game) => void; lazy?: boolean }) {
  const [bad, setBad] = useState(false);
  return (<button type="button" className="game-card" onClick={() => onOpen(game)} aria-label={`${game.title}, ${game.categoryLabel}. Modes: ${game.modes.map((m) => MODE_LABEL[m]).join(", ")}. Open play options`}>
    <span className="game-cover">{bad ? <span className="cover-fallback" data-testid="cover-fallback" style={{ background: `linear-gradient(135deg, ${game.colors[0]}, ${game.colors[1]})` }}><span aria-hidden="true">{game.glyph}</span></span> : <img src={game.image} alt={game.alt} width={640} height={360} loading={lazy ? "lazy" : "eager"} onError={() => setBad(true)} />}</span>
    <span className="game-body"><span className="game-cat">{game.categoryLabel}{game.ranked ? " · Ranked" : ""}</span><strong className="game-title">{game.title}</strong>
      <span className="game-badges">{game.modes.map((m) => <span key={m} className="mode-badge">{MODE_LABEL[m]}</span>)}</span><span className="play-affordance"><span className="ar-sr">Play</span><ChevronRight size={16} aria-hidden="true" /></span></span></button>);
}
export function GameChooser({ game, onClose }: { game: Game; onClose: () => void }) {
  const [diff, setDiff] = useState("medium"); const first = useRef<HTMLAnchorElement>(null);
  useEffect(() => { first.current?.focus(); const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const botsTo = game.routes.bots ? `${game.routes.bots}${game.id === "saboteur" ? "?" : "?bots=3&"}difficulty=${diff}` : "";
  const Tile = ({ to, icon, title, text, refFirst }: { to: string; icon: React.ReactNode; title: string; text: string; refFirst?: boolean }) => <Link ref={refFirst ? first : undefined} to={to} className="mode-tile" onClick={onClose}><span className="mode-tile-icon" aria-hidden="true">{icon}</span><strong>{title}</strong><small>{text}</small><span className="play-affordance">Start <ChevronRight size={15} aria-hidden="true" /></span></Link>;
  return (<div className="chooser-backdrop" onClick={onClose}><div className="chooser" role="dialog" aria-modal="true" aria-label={`Play ${game.title}`} onClick={(e) => e.stopPropagation()}>
    <button type="button" className="chooser-close" onClick={onClose} aria-label="Close"><X size={18} /></button><h2>{game.title}</h2><p>{game.blurb}</p>
    {game.routes.bots && <div className="diff-row" role="group" aria-label="Bot difficulty">{["easy", "medium", "hard"].map((d) => <button key={d} type="button" aria-pressed={diff === d} className={`chip${diff === d ? " chip-on" : ""}`} onClick={() => setDiff(d)}>{d}</button>)}</div>}
    <div className="mode-tiles">
      {game.routes.solo && <Tile refFirst to={game.routes.solo} icon={<User size={22} />} title={game.id === "daily" ? "Play today’s Dangal" : "Play Solo"} text={game.ranked ? "Ranked. One attempt per day." : "Unranked. Repeat as often as you like."} />}
      {game.routes.bots && <Tile refFirst={!game.routes.solo} to={botsTo} icon={<Bot size={22} />} title="Play vs Bots" text={game.id === "saboteur" ? "You plus computer players. No friends needed." : "3 computer opponents. Unranked."} />}
      {game.routes.friends && <Tile refFirst={!game.routes.solo && !game.routes.bots} to={game.routes.friends} icon={<Users size={22} />} title="Play with Friends" text={`Private live room, ${game.players[0] > 1 ? game.players[0] : 2}–${game.players[1]} players.`} />}
    </div>
    {game.id === "daily" && <p className="chooser-note">Want to practise first? <Link to="/practice" onClick={onClose}>Open Practice</Link>. It never uses your ranked attempt.</p>}
    {game.id === "saboteur" && <p className="chooser-note">Friend rooms for Signal Saboteur are not available yet.</p>}</div></div>);
}
export function GameLibrary({ initialOpenId }: { initialOpenId?: string | null }) {
  const [filter, setFilter] = useState("all"); const [open, setOpen] = useState<Game | null>(() => GAMES.find((x) => x.id === initialOpenId) ?? null); useEffect(() => { const x = GAMES.find((y) => y.id === initialOpenId); if (x) setOpen(x); }, [initialOpenId]); const f = FILTERS.find((x) => x.id === filter)!; const list = GAMES.filter(f.test);
  return (<section className="section-block" id="games"><div className="section-heading"><div><span className="section-kicker">{GAMES.length} GAMES</span><h2>What are we playing today?</h2><p>Pick a cover, then choose to play solo, against bots, or with friends.</p></div></div>
    <div className="filter-row" role="group" aria-label="Filter games">{FILTERS.map((x) => <button key={x.id} type="button" aria-pressed={filter === x.id} className={`chip${filter === x.id ? " chip-on" : ""}`} onClick={() => setFilter(x.id)}>{x.label}</button>)}</div>
    <p className="filter-count" role="status">{list.length} {list.length === 1 ? "game" : "games"}</p>
    <div className="game-grid">{list.map((x, i) => <GameCard key={x.id} game={x} lazy={i > 3} onOpen={setOpen} />)}</div>{open && <GameChooser game={open} onClose={() => setOpen(null)} />}</section>);
}
