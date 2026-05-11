import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MatchCard } from "@/components/matches/MatchCard";
import { matchFixture } from "../fixtures/match";

describe("MatchCard", () => {
  it("renders the skill range and slot count", () => {
    render(<MatchCard match={matchFixture()} />);
    expect(screen.getByText(/Skill 2.5/i)).toBeInTheDocument();
  });
});
