"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  value: Date | null | undefined;
  onChange: (value: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  // Minimum selectable date (and indirectly time-of-day on that date).
  minDate?: Date;
  // Quarter-hour increments by default. Pass 5/10/15/30/60 for other steps.
  minuteStep?: number;
  className?: string;
  id?: string;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Pick a date and time",
  disabled,
  minDate,
  minuteStep = 15,
  className,
  id,
}: Props) {
  const [open, setOpen] = React.useState(false);

  const minutes = React.useMemo(
    () => Array.from({ length: Math.floor(60 / minuteStep) }, (_, i) => i * minuteStep),
    [minuteStep],
  );

  const date = value ?? null;
  const hasValue = date !== null;
  const hour = date?.getHours() ?? 0;
  const minute = date?.getMinutes() ?? 0;
  // If `value`'s minute doesn't fall on a step boundary, surface the nearest
  // step in the select so the dropdown isn't blank.
  const minuteSelected = minutes.includes(minute)
    ? minute
    : minutes.reduce((a, b) => (Math.abs(b - minute) < Math.abs(a - minute) ? b : a));

  // Calendar onSelect gives us a Date at 00:00 local time. Preserve the
  // existing time-of-day so changing the date doesn't reset the time.
  const handleDate = (next: Date | undefined) => {
    if (!next) {
      onChange(null);
      return;
    }
    const merged = new Date(next);
    if (hasValue) {
      merged.setHours(hour, minute, 0, 0);
    } else {
      // First time setting a date — pick a sensible default time (now,
      // rounded forward to the next step) so the user isn't forced to also
      // change the time.
      const now = new Date();
      const stepMins = Math.ceil(now.getMinutes() / minuteStep) * minuteStep;
      merged.setHours(now.getHours(), stepMins % 60, 0, 0);
      if (stepMins >= 60) merged.setHours(merged.getHours() + 1);
    }
    onChange(merged);
  };

  const setTime = (h: number, m: number) => {
    if (!date) return;
    const next = new Date(date);
    next.setHours(h, m, 0, 0);
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "MMM d, yyyy 'at' h:mm a") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white" align="start">
        <Calendar
          mode="single"
          selected={date ?? undefined}
          onSelect={handleDate}
          disabled={minDate ? { before: minDate } : undefined}
          autoFocus
        />
        <div className="flex items-center gap-2 border-t p-3">
          <span className="text-sm font-medium">Time</span>
          <Select
            value={pad(hour)}
            onValueChange={(v) => setTime(Number(v), minuteSelected)}
            disabled={!hasValue}
          >
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {HOURS.map((h) => (
                <SelectItem key={h} value={pad(h)}>
                  {pad(h)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select
            value={pad(minuteSelected)}
            onValueChange={(v) => setTime(hour, Number(v))}
            disabled={!hasValue}
          >
            <SelectTrigger className="h-8 bg-white w-[72px]">
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {minutes.map((m) => (
                <SelectItem key={m} value={pad(m)}>
                  {pad(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              // Hidden (but still occupies layout space) before a date is
              // picked so the popover width doesn't change once Clear shows.
              className={cn(!hasValue && "invisible pointer-events-none")}
              aria-hidden={!hasValue}
              tabIndex={!hasValue ? -1 : undefined}
            >
              Clear
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
