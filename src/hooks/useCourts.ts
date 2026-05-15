"use client";

import { useQueryClient } from "@tanstack/react-query";
import type { Court } from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import type {
  CreateCourtInput,
  UpdateCourtInput,
} from "@/lib/validators/court";

export const courtsKey = ["courts"] as const;
export const courtKey = (id: string) => ["courts", id] as const;

type CourtResponse = { court: Court };

export function useCreateCourt() {
  const qc = useQueryClient();
  return useApiMutation<CourtResponse, Error, CreateCourtInput>({
    mutationFn: (input) =>
      apiFetch<CourtResponse>("/api/courts", { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: courtsKey }),
  });
}

type UpdateArgs = { id: string; input: UpdateCourtInput };

export function useUpdateCourt() {
  const qc = useQueryClient();
  return useApiMutation<CourtResponse, Error, UpdateArgs>({
    mutationFn: ({ id, input }) =>
      apiFetch<CourtResponse>(`/api/courts/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: courtsKey });
      qc.invalidateQueries({ queryKey: courtKey(vars.id) });
    },
  });
}

export function useDeleteCourt() {
  const qc = useQueryClient();
  return useApiMutation<{ ok: boolean }, Error, string>({
    mutationFn: (id) =>
      apiFetch<{ ok: boolean }>(`/api/courts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: courtsKey }),
  });
}
