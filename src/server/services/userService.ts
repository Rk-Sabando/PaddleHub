import { db } from "@/lib/db";
import type { UpdateProfileInput } from "@/lib/validators/user";

export const userService = {
  async getPublicProfile(id: string) {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        skillRating: true,
        skillLevel: true,
        preferredFormat: true,
      },
    });
  },

  async updateProfile(id: string, input: UpdateProfileInput) {
    return db.user.update({ where: { id }, data: input });
  },
};
