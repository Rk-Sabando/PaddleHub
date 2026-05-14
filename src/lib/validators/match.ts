import { z } from "zod";

export const matchFormatSchema = z.enum(["SINGLES", "DOUBLES"]);
export const matchStatusSchema = z.enum(["OPEN", "CONFIRMED", "COMPLETED", "CANCELLED"]);

export const createMatchSchema = z
  .object({
    courtId: z.string().min(1, "Court is required"),
    scheduledAt: z.coerce.date().min(new Date(), "Match must be in the future"),
    format: matchFormatSchema,
    skillMin: z.number().min(1).max(5),
    skillMax: z.number().min(1).max(5),
    capacity: z.number().int().min(2).max(8),
    notes: z.string().max(500).optional(),
  })
  .refine((v) => v.skillMax >= v.skillMin, {
    message: "skillMax must be >= skillMin",
    path: ["skillMax"],
  });

export const updateMatchSchema = createMatchSchema.partial();

export const listMatchesQuerySchema = z.object({
  status: matchStatusSchema.optional(),
  format: matchFormatSchema.optional(),
  skillMin: z.coerce.number().optional(),
  skillMax: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type CreateMatchInput = z.infer<typeof createMatchSchema>;
export type ListMatchesQuery = z.infer<typeof listMatchesQuerySchema>;
