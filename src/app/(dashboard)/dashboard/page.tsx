import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Calendar } from "lucide-react";
import { EventStatus, MatchStatus, Role, SignupStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { AdminEventsTable } from "@/components/events/AdminEventsTable";
import { EventsFeedRealtimeRefresher } from "@/components/events/EventsFeedRealtimeRefresher";
import { JoinedEventsList } from "@/components/dashboard/JoinedEventsList";
import { MatchHistoryList } from "@/components/dashboard/MatchHistoryList";
import { PlayersTable } from "@/components/dashboard/PlayersTable";
import { EnablePushBanner } from "@/components/push/EnablePushBanner";
import { Button } from "@/components/ui/button";
import { formatEventStatus } from "@/lib/eventStatus";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  return user.role === Role.ADMIN ? <AdminDashboard /> : <PlayerDashboard userId={user.id} />;
}

async function AdminDashboard() {
  const [players, total, activeEvents] = await Promise.all([
    db.user.findMany({
      where: { role: Role.PLAYER },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        skillLevel: true,
        skillRating: true,
        preferredFormat: true,
        onboardedAt: true,
        createdAt: true,
      },
      take: 100,
    }),
    db.user.count({ where: { role: Role.PLAYER } }),
    db.event.findMany({
      where: {
        status: {
          in: [EventStatus.OPEN, EventStatus.IN_PROGRESS],
        },
      },
      include: {
        host: true,
        _count: { select: { signups: true, matches: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 10,
    }),
  ]);

  return (
    <div className="space-y-10">
      <EventsFeedRealtimeRefresher />
      <section className="space-y-3">
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Upcoming events</h2>
            <p className="text-sm text-muted-foreground">
              Events accepting signups or currently running.
            </p>
          </div>
          <Link
            href={"/events" as Route}
            className="text-sm font-medium hover:underline"
          >
            Manage all events →
          </Link>
        </header>
        <AdminEventsTable
          events={activeEvents}
          emptyMessage="No active events. Create one from the Events page."
        />
      </section>

      <section className="space-y-3">
        <header>
          <h2 className="text-2xl font-semibold">Players</h2>
          <p className="text-sm text-muted-foreground">{total} registered</p>
        </header>

        <PlayersTable players={players} />
      </section>
    </div>
  );
}

async function PlayerDashboard({ userId }: { userId: string }) {
  const [joinedEvents, history] = await Promise.all([
    db.eventSignup.findMany({
      where: {
        userId,
        status: { not: SignupStatus.DECLINED },
        event: { status: { in: [EventStatus.OPEN, EventStatus.IN_PROGRESS] } },
      },
      orderBy: { event: { scheduledAt: "asc" } },
      include: {
        event: {
          include: {
            _count: {
              select: { signups: { where: { status: SignupStatus.CONFIRMED } } },
            },
          },
        },
      },
    }),
    db.matchParticipant.findMany({
      where: {
        userId,
        match: { status: { in: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] } },
      },
      orderBy: { match: { scheduledAt: "desc" } },
      include: { match: { include: { host: true, court: true } } },
      take: 25,
    }),
  ]);

  // "Current" = soonest event the player is on the roster for that hasn't
  // ended. joinedEvents is already filtered to OPEN/IN_PROGRESS and ordered by
  // scheduledAt asc — so the first row is the right one.
  const current = joinedEvents[0]?.event ?? null;
  const currentStatus = current?.status ?? null;

  return (
    <div className="space-y-10">
      <EventsFeedRealtimeRefresher />

      <header>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Events you&apos;ve joined and your match history.
        </p>
      </header>

      <EnablePushBanner />

      {current && (
        <Link
          href={`/events/${current.id}` as Route}
          className="group flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
        >
          <div className="flex min-w-0 items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-base font-semibold">{current.name}</span>
                {currentStatus && (
                  <span
                    className={
                      currentStatus === EventStatus.IN_PROGRESS
                        ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                        : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
                    }
                  >
                    {formatEventStatus(currentStatus)}
                  </span>
                )}
              </div>
              <div className="break-words text-xs text-muted-foreground">
                {currentStatus === EventStatus.IN_PROGRESS
                  ? "Tap to see your court assignment and matchmaking."
                  : `${current.scheduledAt.toISOString().slice(0, 16).replace("T", " ")} · jump straight in`}
              </div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">My events</h2>
          <Button asChild size="sm" variant="outline">
            <Link href={"/events" as Route}>Browse all events</Link>
          </Button>
        </div>

        <JoinedEventsList joinedEvents={joinedEvents} />
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Match history</h2>
        <MatchHistoryList history={history} />
      </section>
    </div>
  );
}
