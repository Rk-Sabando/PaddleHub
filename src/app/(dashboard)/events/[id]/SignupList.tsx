"use client";

import type { EventSignup, User } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { SignupDecisionButtons } from "./SignupDecisionButtons";

export type SignupRow = EventSignup & { user: User };

type Props = {
  eventId: string;
  signups: SignupRow[];
  variant: "pending" | "confirmed" | "declined";
  capacityReached?: boolean;
  pageSize?: number;
  emptyMessage?: string;
};

export function SignupList({
  eventId,
  signups,
  variant,
  capacityReached,
  pageSize = 10,
  emptyMessage,
}: Props) {
  const pagination = usePagination(signups, pageSize);

  if (signups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? "Nothing here yet."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {pagination.pageItems.map((s) => (
          <li key={s.id} className="flex items-center justify-between p-3">
            <div>
              <div className="font-medium">{s.user.name}</div>
              <div className="text-xs text-muted-foreground">
                {variant === "declined" ? (
                  <>
                    Declined{" "}
                    {s.decidedAt ? s.decidedAt.toISOString().slice(0, 10) : ""}
                  </>
                ) : (
                  <>
                    {s.user.skillLevel} · {s.user.skillRating.toFixed(1)}
                    {variant === "pending" && (
                      <> · requested {s.createdAt.toISOString().slice(0, 10)}</>
                    )}
                  </>
                )}
              </div>
            </div>
            {variant !== "declined" && (
              <SignupDecisionButtons
                eventId={eventId}
                signupId={s.id}
                variant={variant}
                capacityReached={variant === "pending" ? capacityReached : undefined}
              />
            )}
          </li>
        ))}
      </ul>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
