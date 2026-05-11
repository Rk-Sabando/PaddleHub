import type { Match as PrismaMatch, User, MatchParticipant } from "@prisma/client";

export type Match = PrismaMatch & {
  host: User;
  participants: (MatchParticipant & { user: User })[];
};

export type SkillTier = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "PRO";
