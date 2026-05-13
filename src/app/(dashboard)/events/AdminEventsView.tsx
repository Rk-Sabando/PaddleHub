import type { Route } from "next";
import Link from "next/link";
import type { Event, User } from "@prisma/client";
import { CreateEventForm } from "./CreateEventForm";

type AdminEvent = Event & {
  host: User;
  _count: { signups: number; matches: number };
};

export function AdminEventsView({ events }: { events: AdminEvent[] }) {
  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">
            Create open-play events and watch signups roll in.
          </p>
        </div>
      </header>

      <section className="rounded-md border p-4">
        <h2 className="mb-3 text-lg font-medium">New event</h2>
        <CreateEventForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">All events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
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
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/events/${e.id}` as Route}
                        className="font-medium hover:underline"
                      >
                        {e.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Host: {e.host.name}
                      </div>
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
        )}
      </section>
    </div>
  );
}
