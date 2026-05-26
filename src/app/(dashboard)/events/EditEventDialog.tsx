"use client";

import { useState } from "react";
import type { Event } from "@prisma/client";
import { Pencil } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EventForm } from "./EventForm";

type Props = {
  event: Event;
  // Controls the trigger button presentation so the same dialog can be a
  // pencil icon in a table row, an outline "Edit event" button in a detail
  // header, etc.
  triggerLabel?: React.ReactNode;
  triggerSize?: ButtonProps["size"];
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
};

export function EditEventDialog({
  event,
  triggerLabel,
  triggerSize = "sm",
  triggerVariant = "outline",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={triggerSize}
          variant={triggerVariant}
          className={triggerClassName}
        >
          {triggerLabel ?? (
            <>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit event</DialogTitle>
          <DialogDescription>
            Update the schedule, format, capacity, or skill range. Only
            upcoming events can be edited.
          </DialogDescription>
        </DialogHeader>
        {/* key={event.updatedAt} resets the form when a fresh event snapshot
            arrives so the inputs reflect the latest server-confirmed values. */}
        <EventForm
          key={event.updatedAt.toString()}
          event={event}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
