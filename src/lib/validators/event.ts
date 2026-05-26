import { z } from "zod";

export const createEventSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(120),
    description: z.string().max(1000).optional().or(z.literal("")),
    scheduledAt: z.coerce.date(),
    endsAt: z.coerce.date().optional().nullable(),
    format: z.enum(["SINGLES", "DOUBLES"]),
    capacity: z.coerce.number().int().min(2).max(256),
    skillMin: z.coerce.number().min(1).max(5).default(1),
    skillMax: z.coerce.number().min(1).max(5).default(5),
  })
  .refine((v) => !v.endsAt || v.endsAt > v.scheduledAt, {
    message: "End time must be after start time",
    path: ["endsAt"],
  })
  .refine((v) => v.skillMax >= v.skillMin, {
    message: "Max skill must be ≥ min skill",
    path: ["skillMax"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

// Edits use the same shape as create. Status is excluded — it has its own
// transition logic on the existing PATCH path.
export const updateEventSchema = createEventSchema;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
