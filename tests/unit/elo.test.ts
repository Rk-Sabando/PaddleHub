import { describe, it, expect } from "vitest";
import { computeNewRating } from "@/server/jobs/elo";

describe("computeNewRating", () => {
  it("raises rating after a win against equal opponent", () => {
    const newRating = computeNewRating(1500, 1500, 1);
    expect(newRating).toBeGreaterThan(1500);
  });

  it("lowers rating after a loss against equal opponent", () => {
    const newRating = computeNewRating(1500, 1500, 0);
    expect(newRating).toBeLessThan(1500);
  });
});
