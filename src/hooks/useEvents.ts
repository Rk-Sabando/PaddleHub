"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Event, EventStatus } from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import type { CreateEventInput, UpdateEventInput } from "@/lib/validators/event";

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

type UpdateEventResponse = { event: Event };

export function useUpdateEvent(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<UpdateEventResponse, Error, UpdateEventInput>({
    mutationFn: (input) =>
      apiFetch<UpdateEventResponse>(`/api/events/${eventId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
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

type ToggleMatchmakingResponse = { event: Event };

export function useToggleMatchmakingDisabled(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<ToggleMatchmakingResponse, Error, boolean>({
    mutationFn: (matchmakingDisabled) =>
      apiFetch<ToggleMatchmakingResponse>(`/api/events/${eventId}/matchmaking-disabled`, {
        method: "PATCH",
        body: { matchmakingDisabled },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventsKey });
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
    },
  });
}

type MatchmakeResponse = {
  ok: boolean;
  created: number;
  matchObjects: {
    teamA: { userId: string; name: string; skillRating: number; gamesPlayed: number }[];
    teamB: { userId: string; name: string; skillRating: number; gamesPlayed: number }[];
  }[];
  leftover: { userId: string; name: string }[];
  validation: {
    oddPlayersInQueue: boolean;
    playersWithoutSkillMatch: { userId: string; name: string; skillRating: number }[];
    starvationPrevented: { userId: string; name: string; rotations: number }[];
  };
  perMatch: number;
  courtsUsed: number;
};

export function useStartMatchmaking(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<MatchmakeResponse, Error, void>({
    mutationFn: () =>
      apiFetch<MatchmakeResponse>(`/api/events/${eventId}/matchmake`, {
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
    },
  });
}

type AssignResponse =
  | { ok: true; assigned: true; matchId: string; participants: { userId: string; name: string }[] }
  | { ok: true; assigned: false; message: string };

// Puts a match onto a court that's currently idle. Used by the "Assign next
// match" button on EventCourtCard when an admin re-opens a court.
export function useAssignMatchToCourt(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<AssignResponse, Error, string>({
    mutationFn: (courtId) =>
      apiFetch<AssignResponse>(
        `/api/events/${eventId}/courts/${courtId}/assign`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
    },
  });
}
