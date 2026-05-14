"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useRequestSignup, useWithdrawSignup } from "@/hooks/useEventSignups";

type Props = {
  eventId: string;
  signedUp: boolean;
  disabled?: boolean;
  withdrawOnly?: boolean;
};

export function SignupButton({ eventId, signedUp, disabled, withdrawOnly }: Props) {
  const router = useRouter();
  const onSuccess = () => router.refresh();

  const request = useRequestSignup(eventId);
  const withdraw = useWithdrawSignup(eventId);
  const busy = request.isPending || withdraw.isPending;

  if (signedUp) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => withdraw.mutate(undefined, { onSuccess })}
      >
        {withdraw.isPending ? "Withdrawing…" : "Withdraw"}
      </Button>
    );
  }

  if (withdrawOnly) return null;

  return (
    <Button
      type="button"
      disabled={busy || disabled}
      onClick={() => request.mutate(undefined, { onSuccess })}
    >
      {request.isPending ? "Requesting…" : "Request to join"}
    </Button>
  );
}
