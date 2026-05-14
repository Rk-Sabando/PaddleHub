"use client";

import type { Route } from "next";
import Link from "next/link";
import type { Event, User } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";

export type AdminEventRow = Event & {
  host: User;
  _count: { signups: number; matches: number };
};

type Props = {
  events: AdminEventRow[];
  emptyMessage?: string;
  pageSize?: number;
};

export function AdminEventsTable({
  events,
  emptyMessage = "No events yet.",
  pageSize = 10,
}: Props) {
  const pagination = usePagination(events, pageSize);

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 font-medium">Scheduled</th>
              <th className="px-3 py-2 font-medium">Format</th>
              <th className="px-3 py-2 font-medium">Signups</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pagination.pageItems.map((e) => (
              <tr key={e.id} className="hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Link
                    href={`/events/${e.id}` as Route}
                    className="font-medium hover:underline"
                  >
                    {e.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">Host: {e.host.name}</div>
                </td>
                <td className="px-3 py-2">
                  {e.scheduledAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3 py-2">{e.format}</td>
                <td className="px-3 py-2">
                  {e._count.signups}/{e.capacity}
                </td>
                <td className="px-3 py-2">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
