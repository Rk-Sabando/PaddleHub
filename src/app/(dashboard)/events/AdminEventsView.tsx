import { AdminEventsTable, type AdminEventRow } from "@/components/events/AdminEventsTable";
import { EventsFeedRealtimeRefresher } from "@/components/events/EventsFeedRealtimeRefresher";
import { CreateEventDialog } from "./CreateEventDialog";

export function AdminEventsView({ events }: { events: AdminEventRow[] }) {
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

      <AdminEventsTable events={events} />
    </div>
  );
}
