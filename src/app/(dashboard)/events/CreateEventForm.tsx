"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCreateEvent } from "@/hooks/useEvents";
import { createEventSchema, type CreateEventInput } from "@/lib/validators/event";

type Props = {
  // Called after a successful create, before router.refresh(). Use this to
  // close a containing dialog, etc.
  onSuccess?: () => void;
};

export function CreateEventForm({ onSuccess }: Props = {}) {
  const router = useRouter();
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      format: "DOUBLES",
      capacity: 16,
      skillMin: 1,
      skillMax: 5,
    },
  });

  const onSubmit = (values: CreateEventInput) =>
    createEvent.mutate(values, {
      onSuccess: () => {
        reset();
        toast({ title: "Event created" });
        onSuccess?.();
        router.refresh();
      },
    });

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
        <Controller
          control={control}
          name="scheduledAt"
          render={({ field }) => (
            <DateTimePicker
              id="scheduledAt"
              value={field.value ?? null}
              onChange={(d) => field.onChange(d ?? undefined)}
              minDate={new Date()}
            />
          )}
        />
        {errors.scheduledAt && (
          <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="endsAt">Ends at (optional)</Label>
        <Controller
          control={control}
          name="endsAt"
          render={({ field }) => (
            <DateTimePicker
              id="endsAt"
              value={field.value ?? null}
              onChange={(d) => field.onChange(d ?? undefined)}
              minDate={new Date()}
            />
          )}
        />
        {errors.endsAt && <p className="text-xs text-destructive">{errors.endsAt.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="format">Format</Label>
        <Controller
          control={control}
          name="format"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="format">
                <SelectValue placeholder="Pick a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DOUBLES">Doubles</SelectItem>
                <SelectItem value="SINGLES">Singles</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
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

      <div className="md:col-span-2">
        <Button type="submit" disabled={createEvent.isPending}>
          {createEvent.isPending ? "Creating…" : "Create event"}
        </Button>
      </div>
    </form>
  );
}
