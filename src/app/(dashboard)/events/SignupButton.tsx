"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  eventId: string;
  signedUp: boolean;
  disabled?: boolean;
  withdrawOnly?: boolean;
};

export function SignupButton({ eventId, signedUp, disabled, withdrawOnly }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (method: "POST" | "DELETE") => {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/events/${eventId}/signup`, { method });
    setPending(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Could not update signup.");
      return;
    }
    router.refresh();
  };

  if (signedUp) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => act("DELETE")}
        >
          {pending ? "Withdrawing…" : "Withdraw"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (withdrawOnly) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" disabled={pending || disabled} onClick={() => act("POST")}>
        {pending ? "Requesting…" : "Request to join"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
