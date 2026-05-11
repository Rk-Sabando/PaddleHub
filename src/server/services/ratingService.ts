import { db } from "@/lib/db";
import type { CreateRatingInput } from "@/lib/validators/rating";

export const ratingService = {
  async submit(fromId: string, input: CreateRatingInput) {
    // TODO: verify match is COMPLETED and both users participated.
    return db.rating.create({
      data: {
        matchId: input.matchId,
        fromId,
        toId: input.toId,
        sportsmanship: input.sportsmanship,
        punctuality: input.punctuality,
        comment: input.comment,
      },
    });
  },
};
