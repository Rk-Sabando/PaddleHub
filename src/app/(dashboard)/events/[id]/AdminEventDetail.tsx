import type {
  Court,
  Event,
  EventSignup,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { EventStatus, MatchStatus, SignupStatus } from "@prisma/client";
import type { Route } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventRealtimeRefresher } from "@/components/events/EventRealtimeRefresher";
import { EditEventDialog } from "../EditEventDialog";
import { CourtMatchCard } from "./CourtMatchCard";
import { EventStatusControl } from "./EventStatusControl";
import { QueuedMatchCard } from "./QueuedMatchCard";
import { SignupList } from "./SignupList";
import { StartMatchmakingButton } from "./StartMatchmakingButton";
import { WaitingPlayersList } from "./WaitingPlayersList";

type DetailEvent = Event & {
  host: User;
  _count: { matches: number; signups: number };
  signups: (EventSignup & { user: User })[];
  matches: (Match & {
    // courtId is nullable now (queued matches have no court yet).
    court: Court | null;
    participants: (MatchParticipant & { user: User })[];
  })[];
};

type DetailMatch = DetailEvent["matches"][number];

export function AdminEventDetail({ event }: { event: DetailEvent }) {
  const pending = event.signups.filter((s) => s.status === SignupStatus.PENDING);
  const confirmed = event.signups.filter((s) => s.status === SignupStatus.CONFIRMED);
  const declined = event.signups.filter((s) => s.status === SignupStatus.DECLINED);
  const atCapacity = confirmed.length >= event.capacity;

  // Active = CONFIRMED on a court (timer running, End button visible).
  // Queued = pre-formed but waiting for a court to free up (no timer).
  // Anything else (COMPLETED, CANCELLED) we hide from the cards view; the
  // count is visible via the player roster history elsewhere.
  const activeMatches = event.matches.filter(
    (m): m is DetailMatch & { court: Court } =>
      m.status === MatchStatus.CONFIRMED && m.court !== null,
  );
  const queuedMatches = event.matches.filter(
    (m) => m.status === MatchStatus.OPEN && m.court === null,
  );

  // Waiting players = confirmed signups not currently in an active or queued
  // match. They'll roll into the queue as queued matches get promoted onto
  // courts (the server tops up the queue automatically).
  const inMatch = new Set(
    [...activeMatches, ...queuedMatches].flatMap((m) =>
      m.participants.map((p) => p.userId),
    ),
  );
  const waitingPlayers = confirmed
    .filter((s) => !inMatch.has(s.userId))
    .map((s) => ({
      id: s.user.id,
      name: s.user.name,
      skillLevel: s.user.skillLevel,
      skillRating: s.user.skillRating,
    }));

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
        <div className="flex flex-col items-end gap-2">
          {event.status === EventStatus.OPEN && (
            <EditEventDialog
              event={event}
              triggerLabel={
                <>
                  <Pencil className="mr-1 h-4 w-4" />
                  Edit event
                </>
              }
            />
          )}
          <EventStatusControl
            eventId={event.id}
            status={event.status}
            confirmedCount={confirmed.length}
          />
        </div>
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
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">
            On courts{" "}
            <span className="text-muted-foreground">({activeMatches.length})</span>
          </h2>
          <div className="flex items-center gap-2">
            {event.matches.length === 0 &&
              event.status === EventStatus.IN_PROGRESS && (
                <StartMatchmakingButton
                  eventId={event.id}
                  confirmedCount={confirmed.length}
                />
              )}
            <Button asChild size="sm" variant="outline">
              <Link href={`/events/${event.id}/matches` as Route}>
                View matches
              </Link>
            </Button>
          </div>
        </div>
        {activeMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {event.matches.length === 0
              ? "No matches scheduled yet."
              : "No matches are running right now."}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeMatches.map((m) => (
              <CourtMatchCard key={m.id} match={m} />
            ))}
          </div>
        )}
      </section>

      {queuedMatches.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">
            Up next{" "}
            <span className="text-muted-foreground">
              ({queuedMatches.length})
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {queuedMatches.map((m) => (
              <QueuedMatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {waitingPlayers.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg font-medium">
            Waiting List{" "}
            <span className="text-muted-foreground">({waitingPlayers.length})</span>
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Confirmed players who aren&apos;t in an active or queued match yet.
            They&apos;ll roll into the queue automatically as games end.
          </p>
          <WaitingPlayersList players={waitingPlayers} />
        </section>
      )}
    </div>
  );
}
