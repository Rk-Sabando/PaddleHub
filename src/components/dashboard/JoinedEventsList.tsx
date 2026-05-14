"use client";

import type { Route } from "next";
import Link from "next/link";
import type { Event, MatchFormat, SignupStatus } from "@prisma/client";
import { SignupStatus as SS } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Pagination, usePagination } from "@/components/shared/Pagination";

export type JoinedEventRow = {
  id: string;
  status: SignupStatus;
  event: Event & {
    _count: { signups: number };
    format: MatchFormat;
  };
};

type Props = {
  joinedEvents: JoinedEventRow[];
  pageSize?: number;
};

export function JoinedEventsList({ joinedEvents, pageSize = 10 }: Props) {
  const pagination = usePagination(joinedEvents, pageSize);

  if (joinedEvents.length === 0) {
    return (
      <div className="rounded-md border bg-muted/30 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          You haven&apos;t joined any events yet.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href={"/events" as Route}>Browse events</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border">
        {pagination.pageItems.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-4 p-3 hover:bg-muted/30"
          >
            <div className="min-w-0">
              <Link
                href={`/events/${s.event.id}` as Route}
                className="font-medium hover:underline"
              >
                {s.event.name}
              </Link>
              <div className="text-xs text-muted-foreground">
                {s.event.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                {s.event.format} · {s.event._count.signups}/{s.event.capacity} confirmed
              </div>
            </div>
            <SignupStatusBadge status={s.status} />
          </li>
        ))}
      </ul>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}

function SignupStatusBadge({ status }: { status: SignupStatus }) {
  if (status === SS.CONFIRMED) {
    return (
      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        Confirmed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
      Pending
    </span>
  );
}
