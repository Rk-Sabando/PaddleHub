import type { Route } from "next";
import Link from "next/link";
import { EventStatus, MatchStatus, Role, SignupStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { AdminEventsTable } from "@/components/events/AdminEventsTable";
import { EventsFeedRealtimeRefresher } from "@/components/events/EventsFeedRealtimeRefresher";
import { JoinedEventsList } from "@/components/dashboard/JoinedEventsList";
import { MatchHistoryList } from "@/components/dashboard/MatchHistoryList";
import { PlayersTable } from "@/components/dashboard/PlayersTable";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="space-y-10">
      <EventsFeedRealtimeRefresher />

      <header>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Events you&apos;ve joined and your match history.
        </p>
      </header>

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
