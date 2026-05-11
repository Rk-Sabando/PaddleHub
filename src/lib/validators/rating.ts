import { z } from "zod";

export const createRatingSchema = z.object({
  matchId: z.string().cuid(),
  toId: z.string().cuid(),
  sportsmanship: z.number().int().min(1).max(5),
  punctuality: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
