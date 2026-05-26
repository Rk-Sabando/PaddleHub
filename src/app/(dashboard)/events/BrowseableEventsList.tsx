"use client";

import type { Route } from "next";
import Link from "next/link";
import type { Event, User } from "@prisma/client";
import { SignupStatus } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";
import { SignupButton } from "./SignupButton";

export type BrowseableEventRow = Event & {
  host: User;
  _count: { signups: number; matches: number };
  signups: { id: string; status: SignupStatus }[];
};

type Props = {
  events: BrowseableEventRow[];
  pageSize?: number;
  emptyMessage?: string;
};

export function BrowseableEventsList({
  events,
  pageSize = 8,
  emptyMessage = "No events open for signups right now.",
}: Props) {
  const pagination = usePagination(events, pageSize);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {pagination.pageItems.map((e) => {
          const own = e.signups[0];
          const signedUp = !!own && own.status !== SignupStatus.DECLINED;
          return (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/events/${e.id}` as Route}
                  className="break-words font-medium hover:underline"
                >
                  {e.name}
                </Link>
                <div className="break-words text-xs text-muted-foreground">
                  {e.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                  {e.format} · {e._count.signups}/{e.capacity} confirmed
                </div>
                {own?.status === SignupStatus.PENDING && (
                  <div className="mt-1 text-xs text-amber-600">Request pending</div>
                )}
                {own?.status === SignupStatus.CONFIRMED && (
                  <div className="mt-1 text-xs text-green-600">Confirmed</div>
                )}
              </div>
              <SignupButton
                eventId={e.id}
                signedUp={signedUp}
                // listForPlayer already filters out ended events, so any row
                // reaching this list is accepting signups.
                disabled={false}
              />
            </li>
          );
        })}
      </ul>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
