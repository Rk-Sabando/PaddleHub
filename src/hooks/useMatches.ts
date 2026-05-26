"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Court,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import type { CreateMatchInput, ListMatchesQuery } from "@/lib/validators/match";

export const matchesKey = (query: Partial<ListMatchesQuery> = {}) =>
  ["matches", query] as const;

export const matchKey = (id: string) => ["match", id] as const;

type MatchWithRelations = Match & {
  host: User;
  participants: (MatchParticipant & { user: User })[];
  court?: Court | null;
};

type ListResponse = { matches: MatchWithRelations[] };
type SingleResponse = { match: MatchWithRelations };
type JoinResponse = { participant: MatchParticipant; waitlist: boolean };

function listMatches(query: Partial<ListMatchesQuery>) {
  const params = new URLSearchParams(
    Object.entries(query).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== undefined && v !== null) acc[k] = String(v);
      return acc;
    }, {}),
  );
  return apiFetch<ListResponse>(`/api/matches?${params}`);
}

export function useMatches(query: Partial<ListMatchesQuery> = {}) {
  return useQuery({
    queryKey: matchesKey(query),
    queryFn: () => listMatches(query),
  });
}

export function useMatch(id: string | undefined) {
  return useQuery({
    queryKey: matchKey(id ?? "missing"),
    queryFn: () => apiFetch<SingleResponse>(`/api/matches/${id}`),
    enabled: !!id,
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useApiMutation<SingleResponse, Error, CreateMatchInput>({
    mutationFn: (input) =>
      apiFetch<SingleResponse>("/api/matches", { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

export function useJoinMatch() {
  const qc = useQueryClient();
  return useApiMutation<JoinResponse, Error, string>({
    mutationFn: (matchId) =>
      apiFetch<JoinResponse>(`/api/matches/${matchId}/join`, { method: "POST" }),
    onSuccess: (_data, matchId) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: matchKey(matchId) });
    },
  });
}

export function useLeaveMatch() {
  const qc = useQueryClient();
  return useApiMutation<{ ok: boolean }, Error, string>({
    mutationFn: (matchId) =>
      apiFetch<{ ok: boolean }>(`/api/matches/${matchId}/leave`, { method: "POST" }),
    onSuccess: (_data, matchId) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: matchKey(matchId) });
    },
  });
}

type EndAndAdvanceResponse = {
  ok: boolean;
  endedMatchId: string;
  nextMatchId: string | null;
  nextParticipants: { userId: string; name: string }[];
};

// Ends the active match on a court and promotes the next queued match if one
// is waiting. If not, the court remains idle. Used by the courts board.
export function useEndAndAdvanceMatch() {
  const qc = useQueryClient();
  return useApiMutation<EndAndAdvanceResponse, Error, string>({
    mutationFn: (matchId) =>
      apiFetch<EndAndAdvanceResponse>(`/api/matches/${matchId}/end`, {
        method: "POST",
      }),
    onSuccess: (_data, matchId) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: matchKey(matchId) });
    },
  });
}
