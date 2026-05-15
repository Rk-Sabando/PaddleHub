import { z } from "zod";

export const courtStatusSchema = z.enum([
  "AVAILABLE",
  "MAINTENANCE",
  "CLOSED",
  "RENTED",
]);

export const createCourtSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  location: z.string().min(1, "Location is required").max(120),
  surface: z.string().min(1, "Surface is required").max(40),
  status: courtStatusSchema.default("AVAILABLE"),
});

export const updateCourtSchema = createCourtSchema.partial();

export type CreateCourtInput = z.infer<typeof createCourtSchema>;
export type UpdateCourtInput = z.infer<typeof updateCourtSchema>;
