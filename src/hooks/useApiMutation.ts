"use client";

import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/apiClient";

// Thin wrapper around useMutation that turns ApiError (and unexpected errors)
// into a toast unless the caller explicitly opts out by handling onError. The
// caller can still pass onError; we run after theirs.
type Options<TData, TError, TVariables, TContext> = UseMutationOptions<
  TData,
  TError,
  TVariables,
  TContext
> & {
  // When set, suppresses the default error toast — caller takes full control.
  silenceErrorToast?: boolean;
  // Toast title for the auto-error toast. Defaults to "Something went wrong".
  errorTitle?: string;
};

export function useApiMutation<
  TData = unknown,
  TError = ApiError,
  TVariables = void,
  TContext = unknown,
>(
  options: Options<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { toast } = useToast();
  const { onError, silenceErrorToast, errorTitle, ...rest } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    onError: (error, variables, context, mutation) => {
      onError?.(error, variables, context, mutation);
      if (silenceErrorToast) return;
      const message =
        error instanceof Error ? error.message : "Please try again.";
      toast({
        title: errorTitle ?? "Something went wrong",
        description: message,
        variant: "destructive",
      });
    },
  });
}
