"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Event, EventStatus } from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import type { CreateEventInput } from "@/lib/validators/event";

// Used by react-query for any future client queries; mutations invalidate this
// key so a switch to client-side fetching later is a no-op.
export const eventsKey = ["events"] as const;
export const eventKey = (id: string) => ["events", id] as const;

type CreateEventResponse = { event: Event };
type UpdateStatusResponse = { event: Event };

export function useCreateEvent() {
  const qc = useQueryClient();
  return useApiMutation<CreateEventResponse, Error, CreateEventInput>({
    mutationFn: (input) =>
      apiFetch<CreateEventResponse>("/api/events", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

export function useUpdateEventStatus(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<UpdateStatusResponse, Error, EventStatus>({
    mutationFn: (status) =>
      apiFetch<UpdateStatusResponse>(`/api/events/${eventId}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
    },
  });
}
