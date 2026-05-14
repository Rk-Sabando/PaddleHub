"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { EventSignup, SignupStatus } from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import { eventKey, eventsKey } from "./useEvents";

type SignupResponse = { signup: EventSignup };

// Player: POST request to join.
export function useRequestSignup(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<SignupResponse, Error, void>({
    mutationFn: () =>
      apiFetch<SignupResponse>(`/api/events/${eventId}/signup`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      qc.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

// Player: DELETE withdraws their row entirely.
export function useWithdrawSignup(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<{ ok: boolean }, Error, void>({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>(`/api/events/${eventId}/signup`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      qc.invalidateQueries({ queryKey: eventsKey });
    },
  });
}

// Admin: PATCH a specific signup to CONFIRMED or DECLINED. We keep status in
// the variables so call sites can distinguish which button is mid-flight via
// `mutation.variables`.
type DecideArgs = { signupId: string; status: SignupStatus };

export function useDecideSignup(eventId: string) {
  const qc = useQueryClient();
  return useApiMutation<SignupResponse, Error, DecideArgs>({
    mutationFn: ({ signupId, status }) =>
      apiFetch<SignupResponse>(`/api/events/${eventId}/signups/${signupId}`, {
        method: "PATCH",
        body: { status },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: eventKey(eventId) });
      qc.invalidateQueries({ queryKey: eventsKey });
    },
  });
}
