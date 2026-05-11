import type { Match } from "@/types/match";

export function matchFixture(overrides: Partial<Match> = {}): Match {
  const now = new Date();
  return {
    id: "match_1",
    hostId: "user_1",
    scheduledAt: new Date(now.getTime() + 86_400_000),
    format: "DOUBLES",
    skillMin: 2.5,
    skillMax: 3.5,
    capacity: 4,
    notes: null,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
    host: {
      id: "user_1",
      clerkId: "clerk_1",
      email: "alice@example.com",
      name: "Alice",
      avatarUrl: null,
      bio: null,
      skillRating: 3.0,
      skillLevel: "INTERMEDIATE",
      preferredFormat: "DOUBLES",
      createdAt: now,
      updatedAt: now,
    },
    participants: [],
    ...overrides,
  } as Match;
}
