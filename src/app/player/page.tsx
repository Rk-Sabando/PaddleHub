import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { MatchStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlayer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PlayerPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const player = await requirePlayer();

  const history = await db.matchParticipant.findMany({
    where: {
      userId: player.id,
      match: { status: { in: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] } },
    },
    orderBy: { match: { scheduledAt: "desc" } },
    include: { match: { include: { host: true, court: true } } },
    take: 25,
  });

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Welcome, {player.name}</h1>
        <p className="text-sm text-muted-foreground">
          Your match history and profile.
        </p>
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
