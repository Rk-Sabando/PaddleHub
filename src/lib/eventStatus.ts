import { EventStatus } from "@prisma/client";

// UI labels for the EventStatus enum. Single source of truth so admin and
// player surfaces don't drift apart (and so we never show raw "IN_PROGRESS").
export const eventStatusLabels: Record<EventStatus, string> = {
  [EventStatus.OPEN]: "Upcoming",
  [EventStatus.IN_PROGRESS]: "In progress",
  [EventStatus.COMPLETED]: "Completed",
  [EventStatus.CANCELLED]: "Cancelled",
};

export function formatEventStatus(status: EventStatus): string {
  return eventStatusLabels[status];
}
