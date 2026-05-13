import { MatchStatus, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  return user.role === Role.ADMIN ? <AdminDashboard /> : <PlayerDashboard userId={user.id} />;
}

async function AdminDashboard() {
  const [players, total] = await Promise.all([
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
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Players</h1>
        <p className="text-sm text-muted-foreground">{total} registered</p>
      </header>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Player</th>
              <th className="px-3 py-2 font-medium">Skill</th>
              <th className="px-3 py-2 font-medium">Format</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {players.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.email}</div>
                </td>
                <td className="px-3 py-2">
                  {p.skillLevel} · {p.skillRating.toFixed(1)}
                </td>
                <td className="px-3 py-2">{p.preferredFormat}</td>
                <td className="px-3 py-2">
                  {p.onboardedAt ? (
                    <span className="text-green-600">Onboarded</span>
                  ) : (
                    <span className="text-amber-600">Pending</span>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.createdAt.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
            {players.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                  No players yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function PlayerDashboard({ userId }: { userId: string }) {
  const history = await db.matchParticipant.findMany({
    where: {
      userId,
      match: { status: { in: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] } },
    },
    orderBy: { match: { scheduledAt: "desc" } },
    include: { match: { include: { host: true, court: true } } },
    take: 25,
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Your recent matches.</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-medium">Match history</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed matches yet.</p>
        ) : (
          <ul className="divide-y rounded border">
            {history.map((p) => (
              <li key={p.id} className="flex justify-between p-3">
                <div>
                  <div className="font-medium">vs {p.match.host.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.match.scheduledAt.toISOString().slice(0, 10)} ·{" "}
                    {p.match.court?.name ?? "TBD"}
                  </div>
                </div>
                <div className="text-sm">{p.match.status}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
