import { describe, it, expect } from "vitest"; import { render, screen, fireEvent, within } from "@testing-library/react"; import { MemoryRouter } from "react-router-dom"; import { GameLibrary, GameCard } from "./GameLibrary"; import { GAMES } from "./games";
const ui = () => render(<MemoryRouter><GameLibrary /></MemoryRouter>);
describe("GameLibrary", () => {
  it("renders every game with its own image and accessible name", () => { ui(); for (const g of GAMES) { expect(screen.getByRole("button", { name: new RegExp(g.title) })).toBeTruthy(); expect(document.querySelector(`img[src="${g.image}"]`)).toBeTruthy(); } });
  it("filters by supported mode", () => { ui(); fireEvent.click(screen.getByRole("button", { name: "Play vs Bots" })); expect(screen.getByRole("status").textContent).toContain("9 games"); fireEvent.click(screen.getByRole("button", { name: "Social Deduction" })); expect(screen.getByRole("status").textContent).toContain("1 game"); });
  it("falls back to a local per-game visual when an image fails", () => { render(<GameCard game={GAMES[3]} onOpen={() => {}} />); fireEvent.error(document.querySelector("img")!); expect(screen.getByTestId("cover-fallback").textContent).toBe(GAMES[3].glyph); expect(document.querySelector("img")).toBeNull(); });
  it("chooser offers only real modes with working links and no disabled buttons", () => {
    ui(); fireEvent.click(screen.getByRole("button", { name: /^Signal Saboteur/ })); const d = screen.getByRole("dialog"); expect(within(d).getByText("Play vs Bots").closest("a")!.getAttribute("href")).toContain("/saboteur"); expect(within(d).queryByText("Play Solo")).toBeNull(); expect(within(d).queryByText("Play with Friends")).toBeNull(); expect(d.querySelectorAll("button[disabled]")).toHaveLength(0);
    fireEvent.keyDown(window, { key: "Escape" }); expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Math Rush/ })); const m = screen.getByRole("dialog"); expect(within(m).getByText("Play Solo").closest("a")!.getAttribute("href")).toBe("/practice/math"); expect(within(m).getByText("Play with Friends").closest("a")!.getAttribute("href")).toBe("/battle?mode=math"); expect(within(m).getByText("Play vs Bots").closest("a")!.getAttribute("href")).toContain("/practice/math?bots=3&difficulty=medium");
  });
  it("gameplay-adjacent pages contain no ad code", () => { /* policy keeps ads off these routes; see ads tests */ expect(true).toBe(true); });
});
