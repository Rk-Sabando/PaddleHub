"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEventSchema, type CreateEventInput } from "@/lib/validators/event";

export function CreateEventForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      format: "DOUBLES",
      capacity: 16,
      skillMin: 1,
      skillMax: 5,
    },
  });

  const onSubmit = async (values: CreateEventInput) => {
    setSubmitError(null);
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setSubmitError(body?.error ?? "Could not create event.");
      return;
    }
    reset();
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" placeholder="Sunday open play" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5 md:col-span-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          rows={2}
          {...register("description")}
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="scheduledAt">Starts at</Label>
        <Input id="scheduledAt" type="datetime-local" {...register("scheduledAt")} />
        {errors.scheduledAt && (
          <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Ends at (optional)</Label>
        <Input id="endsAt" type="datetime-local" {...register("endsAt")} />
        {errors.endsAt && <p className="text-xs text-destructive">{errors.endsAt.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="format">Format</Label>
        <select
          id="format"
          {...register("format")}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="DOUBLES">Doubles</option>
          <option value="SINGLES">Singles</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          type="number"
          min={2}
          max={256}
          {...register("capacity", { valueAsNumber: true })}
        />
        {errors.capacity && <p className="text-xs text-destructive">{errors.capacity.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skillMin">Min skill</Label>
        <Input
          id="skillMin"
          type="number"
          step="0.1"
          min={1}
          max={5}
          {...register("skillMin", { valueAsNumber: true })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="skillMax">Max skill</Label>
        <Input
          id="skillMax"
          type="number"
          step="0.1"
          min={1}
          max={5}
          {...register("skillMax", { valueAsNumber: true })}
        />
        {errors.skillMax && <p className="text-xs text-destructive">{errors.skillMax.message}</p>}
      </div>

      {submitError && (
        <p className="text-sm text-destructive md:col-span-2">{submitError}</p>
      )}

      <div className="md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
