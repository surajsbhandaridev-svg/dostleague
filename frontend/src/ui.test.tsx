import { describe, it, expect } from "vitest"; import { render, screen } from "@testing-library/react"; import { MemoryRouter } from "react-router-dom";
import { ResultActions } from "./Share"; import { Info } from "./Public";
describe("ui", () => {
  it("result screen shows score and a personal best only when improved", () => {
    const { rerender } = render(<ResultActions result={{ score: 520, correct: 5, total: 5, accuracy: 100, totalMs: 21000, previousBest: 400 }} />); expect(screen.getByText("520 pts")).toBeTruthy(); expect(screen.getByText(/New personal best/)).toBeTruthy();
    rerender(<ResultActions result={{ score: 300, correct: 3, total: 5, accuracy: 60, totalMs: 30000, previousBest: 400 }} />); expect(screen.queryByText(/New personal best/)).toBeNull();
  });
  it("public pages render with footer links and set the title", () => { render(<MemoryRouter><Info page="privacy" /></MemoryRouter>); expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeTruthy(); expect(screen.getAllByText("Community Rules").length).toBeGreaterThan(0); expect(document.title).toContain("Privacy Policy"); });
});
