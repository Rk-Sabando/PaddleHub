"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateMatchInput, ListMatchesQuery } from "@/lib/validators/match";

async function fetchMatches(query: Partial<ListMatchesQuery>) {
  const params = new URLSearchParams(query as Record<string, string>);
  const res = await fetch(`/api/matches?${params}`);
  if (!res.ok) throw new Error("Failed to load matches");
  return res.json();
}

export function useMatches(query: Partial<ListMatchesQuery> = {}) {
  return useQuery({
    queryKey: ["matches", query],
    queryFn: () => fetchMatches(query),
  });
}

export function useCreateMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateMatchInput) => {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create match");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matches"] }),
  });
}

export function useJoinMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (matchId: string) => {
      const res = await fetch(`/api/matches/${matchId}/join`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to join");
      return res.json();
    },
    onSuccess: (_d, matchId) => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["match", matchId] });
    },
  });
}
