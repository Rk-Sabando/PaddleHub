"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SignupStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";

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
  const [pending, setPending] = useState<SignupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (status: SignupStatus) => {
    setPending(status);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/signups/${signupId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setPending(null);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not update signup.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {variant === "pending" && (
          <>
            <Button
              size="sm"
              disabled={pending !== null || capacityReached}
              onClick={() => decide(SignupStatus.CONFIRMED)}
              title={capacityReached ? "Event is at capacity" : undefined}
            >
              {pending === SignupStatus.CONFIRMED ? "Confirming…" : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => decide(SignupStatus.DECLINED)}
            >
              {pending === SignupStatus.DECLINED ? "Declining…" : "Decline"}
            </Button>
          </>
        )}
        {variant === "confirmed" && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => decide(SignupStatus.DECLINED)}
          >
            {pending === SignupStatus.DECLINED ? "Removing…" : "Remove"}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
