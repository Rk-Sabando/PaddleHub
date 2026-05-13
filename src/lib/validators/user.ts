import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(80),
  bio: z.string().max(500).optional(),
  skillRating: z.number().min(1).max(5),
  preferredFormat: z.enum(["SINGLES", "DOUBLES"]),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const onboardingSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  bio: z.string().max(500).optional().or(z.literal("")),
  skillLevel: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "PRO"]),
  skillRating: z.coerce.number().min(1).max(5),
  preferredFormat: z.enum(["SINGLES", "DOUBLES"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
