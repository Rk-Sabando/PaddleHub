import type {
  Court,
  Event,
  EventSignup,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { SignupStatus } from "@prisma/client";
import { EventRealtimeRefresher } from "@/components/events/EventRealtimeRefresher";
import { EventMatchesList } from "./EventMatchesList";
import { EventStatusControl } from "./EventStatusControl";
import { SignupList } from "./SignupList";

type DetailEvent = Event & {
  host: User;
  _count: { matches: number; signups: number };
  signups: (EventSignup & { user: User })[];
  matches: (Match & {
    court: Court;
    participants: (MatchParticipant & { user: User })[];
  })[];
};

export function AdminEventDetail({ event }: { event: DetailEvent }) {
  const pending = event.signups.filter((s) => s.status === SignupStatus.PENDING);
  const confirmed = event.signups.filter((s) => s.status === SignupStatus.CONFIRMED);
  const declined = event.signups.filter((s) => s.status === SignupStatus.DECLINED);
  const atCapacity = confirmed.length >= event.capacity;

  return (
    <div className="space-y-8">
      <EventRealtimeRefresher eventId={event.id} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{event.name}</h1>
          <p className="text-sm text-muted-foreground">
            {event.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
            {event.format} · {confirmed.length}/{event.capacity} confirmed
          </p>
          {event.description && <p className="mt-2 max-w-prose text-sm">{event.description}</p>}
        </div>
        <EventStatusControl eventId={event.id} status={event.status} />
      </header>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Pending requests <span className="text-muted-foreground">({pending.length})</span>
        </h2>
        <SignupList
          eventId={event.id}
          signups={pending}
          variant="pending"
          capacityReached={atCapacity}
          emptyMessage="No pending requests."
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Confirmed{" "}
          <span className="text-muted-foreground">
            ({confirmed.length}/{event.capacity})
          </span>
        </h2>
        <SignupList
          eventId={event.id}
          signups={confirmed}
          variant="confirmed"
          emptyMessage="No confirmed players yet."
        />
      </section>

      {declined.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">
            Declined <span className="text-muted-foreground">({declined.length})</span>
          </h2>
          <SignupList eventId={event.id} signups={declined} variant="declined" />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Matches</h2>
        <EventMatchesList matches={event.matches} />
      </section>
    </div>
  );
}
