import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAuth();
  if (user.role === Role.ADMIN) redirect("/dashboard");

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Update the profile other players see when you sign up for events.
        </p>
      </header>

      <div className="rounded-md border bg-card p-6">
        <SettingsForm
          defaults={{
            name: user.name,
            bio: user.bio ?? "",
            skillLevel: user.skillLevel,
            skillRating: user.skillRating,
            preferredFormat: user.preferredFormat,
            email: user.email,
            avatarUrl: user.avatarUrl,
          }}
        />
      </div>
    </div>
  );
}
