import type { Route } from "next";
import Link from "next/link";
import type { Court, Event, Match, MatchParticipant, User } from "@prisma/client";
import { SignupStatus } from "@prisma/client";
import { EventsFeedRealtimeRefresher } from "@/components/events/EventsFeedRealtimeRefresher";
import { BrowseableEventsList, type BrowseableEventRow } from "./BrowseableEventsList";
import { SignupButton } from "./SignupButton";

type CurrentEvent = Event & {
  host: User;
  _count: { signups: number; matches: number };
  signups: { id: string; status: SignupStatus }[];
  matches: (Match & {
    court: Court;
    participants: (MatchParticipant & { user: User })[];
  })[];
};

type Props = {
  current: CurrentEvent | null;
  browseable: BrowseableEventRow[];
};

export function PlayerEventsView({ current, browseable }: Props) {
  return (
    <div className="space-y-8">
      <EventsFeedRealtimeRefresher />
      <header>
        <h1 className="text-3xl font-bold">Event</h1>
        <p className="text-sm text-muted-foreground">
          {current
            ? "Your current event."
            : "You're not signed up for an event yet — request to join one below."}
        </p>
      </header>

      {current ? <CurrentEventCard event={current} /> : null}

      <section>
        <h2 className="mb-3 text-lg font-medium">
          {current ? "Other open events" : "Open events"}
        </h2>
        <BrowseableEventsList
          events={browseable.filter((e) => e.id !== current?.id)}
        />
      </section>
    </div>
  );
}

function CurrentEventCard({ event }: { event: CurrentEvent }) {
  const own = event.signups[0];
  return (
    <section className="rounded-md border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href={`/events/${event.id}` as Route}
            className="text-xl font-semibold hover:underline"
          >
            {event.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {event.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} · {event.format}
          </p>
          {event.description && <p className="mt-2 text-sm">{event.description}</p>}
        </div>
        <div className="text-right text-sm">
          <div className="font-medium">{event.status}</div>
          <div className="text-xs text-muted-foreground">
            {event._count.signups}/{event.capacity} confirmed
          </div>
          {own?.status === SignupStatus.PENDING && (
            <div className="mt-1 text-xs text-amber-600">Your request is pending</div>
          )}
          {own?.status === SignupStatus.CONFIRMED && (
            <div className="mt-1 text-xs text-green-600">You're confirmed</div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-medium">Your matches</h3>
        {event.matches.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {event.status === "OPEN"
              ? "No matches assigned yet — admin will pair you up shortly."
              : "No matches assigned to you yet."}
          </p>
        ) : (
          <ul className="divide-y rounded border">
            {event.matches.map((m) => (
              <li key={m.id} className="p-3 text-sm">
                <div className="font-medium">{m.court.name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.scheduledAt.toISOString().slice(11, 16)} ·{" "}
                  {m.participants.map((p) => p.user.name).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <SignupButton eventId={event.id} signedUp withdrawOnly />
      </div>
    </section>
  );
}
