import type { Route } from "next";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ensureUserFromClerk } from "@/lib/auth";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in" as Route);

  const user = await ensureUserFromClerk(userId);
  if (user.onboardedAt) redirect("/dashboard");

  const clerkUser = await currentUser();
  const defaults = {
    name: user.name || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") || "",
    avatarUrl: user.avatarUrl ?? clerkUser?.imageUrl ?? null,
    email: user.email,
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6 rounded-lg border bg-card p-6 shadow-sm">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">Welcome to PaddleHub</h1>
          <p className="text-sm text-muted-foreground">
            Tell us about your game so we can match you with the right players.
          </p>
        </header>
        <OnboardingForm defaults={defaults} />
      </div>
    </div>
  );
}
