"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { MatchFormat, SkillLevel } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { onboardingSchema, type OnboardingInput } from "@/lib/validators/user";

type Props = {
  defaults: {
    name: string;
    bio: string;
    skillLevel: SkillLevel;
    skillRating: number;
    preferredFormat: MatchFormat;
    email: string;
    avatarUrl: string | null;
  };
};

export function SettingsForm({ defaults }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "error"; message?: string }>({
    kind: "idle",
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      name: defaults.name,
      bio: defaults.bio,
      skillLevel: defaults.skillLevel,
      skillRating: defaults.skillRating,
      preferredFormat: defaults.preferredFormat,
    },
  });

  const onSubmit = async (values: OnboardingInput) => {
    setStatus({ kind: "idle" });
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setStatus({ kind: "error", message: body?.error ?? "Could not update profile." });
      return;
    }
    setStatus({ kind: "ok", message: "Saved." });
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
        {defaults.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={defaults.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-muted" />
        )}
        <div className="text-sm">
          <div className="font-medium">Signed in as</div>
          <div className="text-muted-foreground">{defaults.email}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input id="name" autoComplete="name" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio">Short bio (optional)</Label>
        <textarea
          id="bio"
          rows={3}
          maxLength={500}
          {...register("bio")}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="skillLevel">Skill level</Label>
          <select
            id="skillLevel"
            {...register("skillLevel")}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="PRO">Pro</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="skillRating">Self-rated (1.0–5.0)</Label>
          <Input
            id="skillRating"
            type="number"
            step="0.1"
            min={1}
            max={5}
            {...register("skillRating", { valueAsNumber: true })}
          />
          {errors.skillRating && (
            <p className="text-xs text-destructive">{errors.skillRating.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="preferredFormat">Preferred format</Label>
        <select
          id="preferredFormat"
          {...register("preferredFormat")}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="DOUBLES">Doubles</option>
          <option value="SINGLES">Singles</option>
        </select>
      </div>

      {status.kind === "error" && (
        <p className="text-sm text-destructive">{status.message}</p>
      )}
      {status.kind === "ok" && (
        <p className="text-sm text-green-600">{status.message}</p>
      )}

      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
