import type {
  Court,
  Event,
  EventSignup,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { SignupStatus } from "@prisma/client";
import { EventStatusControl } from "./EventStatusControl";
import { SignupDecisionButtons } from "./SignupDecisionButtons";

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
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pending.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{s.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.user.skillLevel} · {s.user.skillRating.toFixed(1)} ·{" "}
                    requested {s.createdAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <SignupDecisionButtons
                  eventId={event.id}
                  signupId={s.id}
                  capacityReached={atCapacity}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">
          Confirmed <span className="text-muted-foreground">({confirmed.length}/{event.capacity})</span>
        </h2>
        {confirmed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed players yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {confirmed.map((s) => (
              <li key={s.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="font-medium">{s.user.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.user.skillLevel} · {s.user.skillRating.toFixed(1)}
                  </div>
                </div>
                <SignupDecisionButtons
                  eventId={event.id}
                  signupId={s.id}
                  variant="confirmed"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {declined.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">
            Declined <span className="text-muted-foreground">({declined.length})</span>
          </h2>
          <ul className="divide-y rounded-md border">
            {declined.map((s) => (
              <li key={s.id} className="p-3 text-sm">
                <div className="font-medium">{s.user.name}</div>
                <div className="text-xs text-muted-foreground">
                  Declined {s.decidedAt ? s.decidedAt.toISOString().slice(0, 10) : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Matches</h2>
        {event.matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
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
      </section>
    </div>
  );
}
