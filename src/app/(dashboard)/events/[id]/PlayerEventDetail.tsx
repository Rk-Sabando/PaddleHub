import type {
  Court,
  Event,
  EventSignup,
  Match,
  MatchParticipant,
  User,
} from "@prisma/client";
import { EventStatus, MatchStatus, SignupStatus } from "@prisma/client";
import { CheckCircle2, Hourglass, Trophy } from "lucide-react";
import { EventRealtimeRefresher } from "@/components/events/EventRealtimeRefresher";
import { PlayerAssignmentNotifier } from "@/components/events/PlayerAssignmentNotifier";
import { EndGameButton } from "@/components/matches/EndGameButton";
import { formatEventStatus } from "@/lib/eventStatus";
import { cn } from "@/lib/utils";
import { SignupButton } from "../SignupButton";
import { OptOutToggle } from "./OptOutToggle";

type DetailEvent = Event & {
  host: User;
  _count: { matches: number; signups: number };
  signups: (EventSignup & { user: User })[];
  matches: (Match & {
    court: Court | null;
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
  // Player can only be in one non-completed match per event at a time; pick the
  // active one first, fall back to a queued one for the "Your match" hero card.
  const ownActive = ownMatches.find(
    (m): m is (typeof ownMatches)[number] & { court: Court } =>
      m.status === MatchStatus.CONFIRMED && m.court !== null,
  );
  // Queue order matches the matchmaking service: oldest-queued promoted first
  // (createdAt asc). We compute the player's position against this same
  // ordering so the hero card can say "2 of 5 in queue".
  const queuedInOrder = event.matches
    .filter((m) => m.status === MatchStatus.OPEN && m.court === null)
    .slice()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const ownQueuedIndex = !ownActive
    ? queuedInOrder.findIndex((m) =>
      m.participants.some((p) => p.user.id === viewerId),
    )
    : -1;
  const ownQueued = ownQueuedIndex >= 0 ? queuedInOrder[ownQueuedIndex] : undefined;
  const ownQueuePosition = ownQueuedIndex >= 0 ? ownQueuedIndex + 1 : null;
  const queueLength = queuedInOrder.length;
  const ownHistory = ownMatches
    .filter((m) => m.status === MatchStatus.COMPLETED)
    .slice()
    .sort((a, b) => b.scheduledAt.getTime() - a.scheduledAt.getTime());

  const activeMatches = event.matches.filter(
    (m): m is (typeof event.matches)[number] & { court: Court } =>
      m.status === MatchStatus.CONFIRMED && m.court !== null,
  ).sort((a, b) => a.court.name.localeCompare(b.court.name));
  const queuedMatches = event.matches.filter(
    (m) => m.status === MatchStatus.OPEN && m.court === null,
  );

  const signedUp = !!own && own.status !== SignupStatus.DECLINED;
  // Players can still join after the event has started — only COMPLETED /
  // CANCELLED block new requests.
  const acceptingSignups =
    event.status === EventStatus.OPEN || event.status === EventStatus.IN_PROGRESS;

  const showBanner = own?.status === SignupStatus.CONFIRMED && event.status === EventStatus.OPEN;

  // "Sit out remaining matches" is available throughout a live event — once
  // it's IN_PROGRESS, the player can pause matchmaking at any point (whether
  // or not they've played a match yet).
  const canOptOut =
    !!own &&
    own.status === SignupStatus.CONFIRMED &&
    event.status === EventStatus.IN_PROGRESS;
  const optedOut = own?.optedOut ?? false;



  return (
    <div className="space-y-6">
      <EventRealtimeRefresher eventId={event.id} />
      <PlayerAssignmentNotifier userId={viewerId} eventId={event.id} />
      <header>
        <h1 className="text-3xl font-bold">{event.name}</h1>
        <p className="text-sm text-muted-foreground">
          {event.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
          {event.format} · {confirmedCount}/{event.capacity} confirmed · {formatEventStatus(event.status)}
        </p>
        {event.description && <p className="mt-2 max-w-prose text-sm">{event.description}</p>}
      </header>

      {showBanner && (
        <div
          className={`rounded-md border p-3 text-sm ${statusBanner[own.status].tone}`}
        >
          {statusBanner[own.status].label}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SignupButton
          eventId={event.id}
          signedUp={signedUp}
          disabled={!signedUp && !acceptingSignups}
          hideWithdraw={event.status === EventStatus.IN_PROGRESS}
        />
        {canOptOut && <OptOutToggle eventId={event.id} optedOut={optedOut} />}
        {!signedUp && !acceptingSignups && (
          <span className="text-xs text-muted-foreground">
            This event has ended.
          </span>
        )}
      </div>

      <YourMatchHero
        active={ownActive}
        queued={ownQueued}
        queuePosition={ownQueuePosition}
        queueLength={queueLength}
        viewerId={viewerId}
        signedUp={signedUp}
        optedOut={optedOut}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">
          On courts <span className="text-muted-foreground">({activeMatches.length})</span>
        </h2>
        {activeMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches are running right now.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeMatches.map((m) => (
              <div key={m.id} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{m.court.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.court.location}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                    Live
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5" />
                  {m.format}
                </div>
                <ul className="space-y-1 text-sm">
                  {m.participants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded bg-muted/40 px-2 py-1"
                    >
                      <span className="truncate font-medium">{p.user.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.user.skillRating.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {queuedMatches.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            Up next <span className="text-muted-foreground">({queuedMatches.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {queuedMatches.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-lg border border-dashed bg-muted/20 p-4"
              >
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-medium leading-tight">
                      <Hourglass className="h-4 w-4 text-muted-foreground" />
                      Waiting for a court
                    </div>
                    <div className="text-xs text-muted-foreground">{m.format}</div>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                    Up next
                  </span>
                </header>
                <ul className="space-y-1 text-sm">
                  {m.participants.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded bg-background/60 px-2 py-1"
                    >
                      <span className="truncate font-medium">{p.user.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {p.user.skillRating.toFixed(1)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {ownHistory.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">
            Your matches{" "}
            <span className="text-muted-foreground">({ownHistory.length})</span>
          </h2>
          <ul className="divide-y rounded-md border">
            {ownHistory.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {m.court?.name ?? "Match"}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} ·{" "}
                    {m.participants
                      .filter((p) => p.userId !== viewerId)
                      .map((p) => p.user.name)
                      .join(", ")}
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                  Completed
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type HeroMatch = (PlayerEventDetailProps["event"]["matches"][number]);

function YourMatchHero({
  active,
  queued,
  queuePosition,
  queueLength,
  viewerId,
  signedUp,
  optedOut,
}: {
  active: (HeroMatch & { court: Court }) | undefined;
  queued: HeroMatch | undefined;
  queuePosition: number | null;
  queueLength: number;
  viewerId: string;
  signedUp: boolean;
  optedOut: boolean;
}) {
  // Hide entirely until the player is in the event — nothing actionable to say.
  if (!signedUp) return null;

  // Player is sitting out AND has nothing currently scheduled — surface that
  // matchmaking is paused so they don't wonder why no court appears.
  if (optedOut && !active && !queued) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-zinc-900">Sitting out</h2>
          <span className="ml-auto rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">
            Matchmaking paused
          </span>
        </div>
        <p className="mt-1 text-sm text-zinc-700">
          You won&apos;t be paired into new matches. Tap{" "}
          <span className="font-medium">Resume matchmaking</span> above when you&apos;re ready.
        </p>
      </section>
    );
  }

  if (active) {
    const others = active.participants.filter((p) => p.userId !== viewerId);
    return (
      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-700" />
          <h2 className="text-lg font-semibold text-emerald-900">
            You&apos;re up — {active.court.name}
          </h2>
          <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            Now playing
          </span>
        </div>
        <p className="mt-1 text-sm text-emerald-900/80">
          {active.court.location} · {active.format}
        </p>
        <ParticipantList participants={others} accent="emerald" />
        <div className="mt-3 flex justify-end">
          <EndGameButton
            matchId={active.id}
            title="End your match?"
            description="Mark this match completed and let the next group take the court. Everyone in the match can end it — make sure your group agrees first."
          />
        </div>
      </section>
    );
  }

  if (queued) {
    const others = queued.participants.filter((p) => p.userId !== viewerId);
    const aheadOfYou = queuePosition ? queuePosition - 1 : 0;
    const headline =
      queuePosition === 1
        ? "You're next up — first court that frees up is yours."
        : aheadOfYou === 1
          ? "1 match ahead of yours before you go on."
          : `${aheadOfYou} matches ahead of yours before you go on.`;
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-amber-700" />
          <h2 className="text-lg font-semibold text-amber-900">Up next — waiting for a court</h2>
        </div>
        <p className="mt-1 text-sm text-amber-900/80">{headline}</p>
        <ParticipantList participants={others} accent="amber" />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-dashed bg-card p-4">
      <h2 className="text-lg font-medium">Your match</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        You haven&apos;t been paired up yet. Your court will appear here as soon as the admin
        assigns one.
      </p>
    </section>
  );
}

function ParticipantList({
  participants,
  accent,
}: {
  participants: (MatchParticipant & { user: User })[];
  accent: "emerald" | "amber";
}) {
  if (participants.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1 text-sm">
      {participants.map((p) => (
        <li
          key={p.id}
          className={cn(
            "flex items-center justify-between rounded px-2 py-1",
            accent === "emerald" ? "bg-emerald-100/60" : "bg-amber-100/60",
          )}
        >
          <span className="truncate font-medium">{p.user.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {p.user.skillRating.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}

type PlayerEventDetailProps = { event: DetailEvent; viewerId: string };
