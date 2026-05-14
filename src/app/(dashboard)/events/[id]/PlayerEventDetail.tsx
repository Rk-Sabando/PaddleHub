import type {
  Court,
  Event,
  EventSignup,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { EventStatus, SignupStatus } from "@prisma/client";
import { EventRealtimeRefresher } from "@/components/events/EventRealtimeRefresher";
import { SignupButton } from "../SignupButton";

type DetailEvent = Event & {
  host: User;
  _count: { matches: number; signups: number };
  signups: (EventSignup & { user: User })[];
  matches: (Match & {
    court: Court;
    participants: (MatchParticipant & { user: User })[];
  })[];
};

const statusBanner: Record<SignupStatus, { label: string; tone: string }> = {
  [SignupStatus.PENDING]: {
    label: "Your join request is awaiting confirmation by an organizer.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  [SignupStatus.CONFIRMED]: {
    label: "You're confirmed for this event.",
    tone: "border-green-200 bg-green-50 text-green-900",
  },
  [SignupStatus.DECLINED]: {
    label: "Your request was declined. You can request again.",
    tone: "border-red-200 bg-red-50 text-red-900",
  },
};

export function PlayerEventDetail({
  event,
  viewerId,
}: {
  event: DetailEvent;
  viewerId: string;
}) {
  const own = event.signups.find((s) => s.userId === viewerId);
  const confirmedCount = event.signups.filter((s) => s.status === SignupStatus.CONFIRMED).length;
  const ownMatches = event.matches.filter((m) =>
    m.participants.some((p) => p.user.id === viewerId),
  );

  const signedUp = !!own && own.status !== SignupStatus.DECLINED;
  // Players can still join after the event has started — only COMPLETED /
  // CANCELLED block new requests.
  const acceptingSignups =
    event.status === EventStatus.OPEN || event.status === EventStatus.IN_PROGRESS;

  return (
    <div className="space-y-6">
      <EventRealtimeRefresher eventId={event.id} />
      <header>
        <h1 className="text-3xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {event.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
          {event.format} · {confirmedCount}/{event.capacity} confirmed · {event.status}
        </p>
        {event.description && <p className="mt-2 max-w-prose text-sm">{event.description}</p>}
      </header>

      {own && (
        <div
          className={`rounded-md border p-3 text-sm ${statusBanner[own.status].tone}`}
        >
          {statusBanner[own.status].label}
        </div>
      )}

      <div className="flex items-center gap-3">
        <SignupButton
          eventId={event.id}
          signedUp={signedUp}
          disabled={!signedUp && !acceptingSignups}
        />
        {!signedUp && !acceptingSignups && (
          <span className="text-xs text-muted-foreground">
            This event has ended.
          </span>
        )}
      </div>

      {ownMatches.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Your matches</h2>
          <ul className="divide-y rounded-md border">
            {ownMatches.map((m) => (
              <li key={m.id} className="p-3 text-sm">
                <div className="font-medium">{m.court.name}</div>
                <div className="text-xs text-muted-foreground">
                  {m.scheduledAt.toISOString().slice(11, 16)} ·{" "}
                  {m.participants.map((p) => p.user.name).join(", ")}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
