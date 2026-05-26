import type { Route } from "next";
import Link from "next/link";
import { EventStatus } from "@prisma/client";
import { Calendar } from "lucide-react";
import { AdminEventsTable, type AdminEventRow } from "@/components/events/AdminEventsTable";
import { EventsFeedRealtimeRefresher } from "@/components/events/EventsFeedRealtimeRefresher";
import { formatEventStatus } from "@/lib/eventStatus";
import { CreateEventDialog } from "./CreateEventDialog";

const UPCOMING_LIMIT = 3;

export function AdminEventsView({ events }: { events: AdminEventRow[] }) {
  // Events arrive ordered by scheduledAt asc. "Upcoming" here is OPEN events
  // only — IN_PROGRESS already lives on the matches board, COMPLETED/CANCELLED
  // are history.
  const upcoming = events
    .filter((e) => e.status === EventStatus.OPEN)
    .slice(0, UPCOMING_LIMIT);

  return (
    <div className="space-y-6">
      <EventsFeedRealtimeRefresher />
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Create open-play events and watch signups roll in.
          </p>
        </div>
        <CreateEventDialog />
      </header>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            Upcoming <span className="text-muted-foreground">({upcoming.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <Link
                key={e.id}
                href={`/events/${e.id}` as Route}
                className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
              >
                <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{e.name}</span>
                    <span className="ml-auto shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                      {formatEventStatus(e.status)}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {e.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} · {e.format} ·{" "}
                    {e._count.signups}/{e.capacity} signed up
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <AdminEventsTable events={events} />
    </div>
  );
}
