import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchStatus, Role, SignupStatus } from "@prisma/client";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { courtService } from "@/server/services/courtService";
import { eventService } from "@/server/services/eventService";
import { EventRealtimeRefresher } from "@/components/events/EventRealtimeRefresher";
import { QueuedMatchCard } from "../QueuedMatchCard";
import { WaitingPlayersList } from "../WaitingPlayersList";
import { EventCourtCard } from "./EventCourtCard";

export const dynamic = "force-dynamic";

export default async function EventMatchesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.ADMIN);
  const { id } = await params;

  const [event, courts] = await Promise.all([
    eventService.getById(id),
    courtService.list(),
  ]);
  if (!event) notFound();

  // Group matches by courtId. Queued matches (courtId=null) go to their own
  // section below the court grid.
  const matchesByCourt = new Map<string, typeof event.matches>();
  const queued: typeof event.matches = [];
  for (const m of event.matches) {
    if (!m.courtId) {
      queued.push(m);
      continue;
    }
    const bucket = matchesByCourt.get(m.courtId) ?? [];
    bucket.push(m);
    matchesByCourt.set(m.courtId, bucket);
  }

  // Waiting = confirmed signups not currently in any active or queued match.
  const inMatch = new Set(
    event.matches
      .filter(
        (m) =>
          m.status === MatchStatus.CONFIRMED ||
          (m.status === MatchStatus.OPEN && m.courtId === null),
      )
      .flatMap((m) => m.participants.map((p) => p.userId)),
  );
  const waitingPlayers = event.signups
    .filter((s) => s.status === SignupStatus.CONFIRMED && !inMatch.has(s.userId))
    .map((s) => ({
      id: s.user.id,
      name: s.user.name,
      skillLevel: s.user.skillLevel,
      skillRating: s.user.skillRating,
    }));

  return (
    <div className="space-y-6">
      <EventRealtimeRefresher eventId={event.id} />

      <header className="space-y-2">
        <Link
          href={`/events/${event.id}` as Route}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to event
        </Link>
        <div>
          <h1 className="text-3xl font-bold">{event.name} · Matches</h1>
          <p className="text-sm text-muted-foreground">
            Every court and the matches scheduled on it for this event. Update
            a court&apos;s status inline to mark it unavailable.
          </p>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Courts</h2>
        {courts.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            No courts configured. Add one in Court management.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {courts.map((c) => (
              <EventCourtCard
                key={c.id}
                eventId={event.id}
                court={c}
                matches={matchesByCourt.get(c.id) ?? []}
              />
            ))}
          </div>
        )}
      </section>

      {queued.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">
            Queued{" "}
            <span className="text-muted-foreground">({queued.length})</span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {queued.map((m) => (
              <QueuedMatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {waitingPlayers.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">
            Waiting List {" "}
            <span className="text-muted-foreground">
              ({waitingPlayers.length})
            </span>
          </h2>
          <WaitingPlayersList players={waitingPlayers} />
        </section>
      )}
    </div>
  );
}
