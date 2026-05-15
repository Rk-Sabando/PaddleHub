"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import type { Court } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useCreateCourt, useUpdateCourt } from "@/hooks/useCourts";
import { createCourtSchema, type CreateCourtInput } from "@/lib/validators/court";

type Props =
  | { mode: "create"; court?: undefined }
  | { mode: "edit"; court: Court };

export function CourtFormDialog(props: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const isEdit = props.mode === "edit";

  const create = useCreateCourt();
  const update = useUpdateCourt();
  const submitting = create.isPending || update.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateCourtInput>({
    resolver: zodResolver(createCourtSchema),
    defaultValues: isEdit
      ? {
          name: props.court.name,
          location: props.court.location,
          surface: props.court.surface,
          status: props.court.status,
        }
      : { status: "AVAILABLE" },
  });
  // Single-field watch is cheaper than wiring a <Controller> just for status.
  const status = watch("status");

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && !isEdit) reset();
  };

  const onSubmit = (values: CreateCourtInput) => {
    const successToast = isEdit ? "Court updated" : "Court created";
    const after = () => {
      toast({ title: successToast });
      setOpen(false);
      if (!isEdit) reset();
      router.refresh();
    };
    if (isEdit) {
      update.mutate({ id: props.court.id, input: values }, { onSuccess: after });
    } else {
      create.mutate(values, { onSuccess: after });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="sm" variant="outline">
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add court
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit court" : "Add a court"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the court's name, location, surface, or status."
              : "Courts here become assignable during matchmaking."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Court A" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" placeholder="North Pavilion" {...register("location")} />
            {errors.location && (
              <p className="text-xs text-destructive">{errors.location.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="surface">Surface</Label>
            <Input id="surface" placeholder="Hardcourt" {...register("surface")} />
            {errors.surface && (
              <p className="text-xs text-destructive">{errors.surface.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={status ?? "AVAILABLE"}
              onValueChange={(v) =>
                setValue("status", v as CreateCourtInput["status"], {
                  shouldDirty: true,
                })
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Pick a status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
                <SelectItem value="RENTED">Rented</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Create court"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
