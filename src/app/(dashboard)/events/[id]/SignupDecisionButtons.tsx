"use client";

import { useRouter } from "next/navigation";
import { SignupStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { useDecideSignup } from "@/hooks/useEventSignups";

type Props = {
  eventId: string;
  signupId: string;
  capacityReached?: boolean;
  variant?: "pending" | "confirmed";
};

export function SignupDecisionButtons({
  eventId,
  signupId,
  capacityReached,
  variant = "pending",
}: Props) {
  const router = useRouter();
  const decide = useDecideSignup(eventId);

  // `decide.variables?.status` tells us which button started the in-flight
  // request, so the spinner sits on the right control.
  const inFlight = decide.isPending ? decide.variables?.status : undefined;

  const run = (status: SignupStatus) =>
    decide.mutate({ signupId, status }, { onSuccess: () => router.refresh() });

  return (
    <div className="flex gap-2">
      {variant === "pending" && (
        <>
          <Button
            size="sm"
            disabled={decide.isPending || capacityReached}
            onClick={() => run(SignupStatus.CONFIRMED)}
            title={capacityReached ? "Event is at capacity" : undefined}
          >
            {inFlight === SignupStatus.CONFIRMED ? "Confirming…" : "Confirm"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={decide.isPending}
            onClick={() => run(SignupStatus.DECLINED)}
          >
            {inFlight === SignupStatus.DECLINED ? "Declining…" : "Decline"}
          </Button>
        </>
      )}
      {variant === "confirmed" && (
        <Button
          size="sm"
          variant="outline"
          disabled={decide.isPending}
          onClick={() => run(SignupStatus.DECLINED)}
        >
          {inFlight === SignupStatus.DECLINED ? "Removing…" : "Remove"}
        </Button>
      )}
    </div>
  );
}
