import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80),
  bio: z.string().max(500).optional(),
  skillRating: z.number().min(1).max(5),
  preferredFormat: z.enum(["SINGLES", "DOUBLES"]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
