"use client";

import { useAuth } from "@clerk/nextjs";
import type { User } from "@prisma/client";
import { apiFetch } from "@/lib/apiClient";
import { useApiMutation } from "./useApiMutation";
import type { OnboardingInput } from "@/lib/validators/user";

type ProfileResponse = { user: User };

// Profile self-edit (player only). Server components are re-fetched via
// router.refresh() in the caller's onSuccess.
export function useUpdateProfile() {
  return useApiMutation<ProfileResponse, Error, OnboardingInput>({
    mutationFn: (input) =>
      apiFetch<ProfileResponse>("/api/profile", { method: "PATCH", body: input }),
  });
}

type OnboardingResponse = {
  ok: boolean;
  user: User;
  clerkPublicMetadata?: Record<string, unknown>;
};

// Onboarding has special post-success choreography: the API mutates Clerk
// publicMetadata, but the client's session JWT still has the old claims. We
// force a token refresh here so the next request through middleware carries
// the new `onboarded: true` claim. Caller is responsible for navigating after
// the mutation resolves (usually a hard navigate to /dashboard).
export function useCompleteOnboarding() {
  const { getToken } = useAuth();

  return useApiMutation<OnboardingResponse, Error, OnboardingInput>({
    mutationFn: async (input) => {
      const data = await apiFetch<OnboardingResponse>("/api/onboarding", {
        method: "POST",
        body: input,
      });
      try {
        await getToken({ skipCache: true });
      } catch (err) {
        console.error("Token refresh failed after onboarding update", err);
        // Fall through — the caller's hard navigation will pick up a fresh
        // token on its own.
      }
      return data;
    },
  });
}
