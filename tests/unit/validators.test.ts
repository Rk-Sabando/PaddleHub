import { describe, it, expect } from "vitest";
import { createMatchSchema } from "@/lib/validators/match";

describe("createMatchSchema", () => {
  it("rejects past dates", () => {
    const result = createMatchSchema.safeParse({
      scheduledAt: new Date("2000-01-01"),
      format: "DOUBLES",
      skillMin: 2.5,
      skillMax: 3.5,
      capacity: 4,
    });
    expect(result.success).toBe(false);
  });

  it("rejects skillMax < skillMin", () => {
    const result = createMatchSchema.safeParse({
      scheduledAt: new Date(Date.now() + 86_400_000),
      format: "DOUBLES",
      skillMin: 4.0,
      skillMax: 2.0,
      capacity: 4,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid input", () => {
    const result = createMatchSchema.safeParse({
      scheduledAt: new Date(Date.now() + 86_400_000),
      format: "DOUBLES",
      skillMin: 2.5,
      skillMax: 3.5,
      capacity: 4,
    });
    expect(result.success).toBe(true);
  });
});
