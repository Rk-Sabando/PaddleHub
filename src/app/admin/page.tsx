import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Throws ForbiddenError if the signed-in user is not an admin; the nearest
  // error boundary renders that as a 403.
  const admin = await requireAdmin();

  const [userCount, openMatches, courts] = await Promise.all([
    db.user.count({ where: { role: Role.PLAYER } }),
    db.match.findMany({
      where: { status: "OPEN" },
      orderBy: { scheduledAt: "asc" },
      include: { host: true, court: true, participants: true },
      take: 10,
    }),
    db.court.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Admin · {admin.name}</h1>
        <p className="text-sm text-muted-foreground">
          Match-making, user management, and court assignment.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-medium">Player roster ({userCount})</h2>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Match-making queue</h2>
        <ul className="divide-y rounded border">
          {openMatches.map((m) => (
            <li key={m.id} className="flex justify-between p-3">
              <div>
                <div className="font-medium">{m.host.name}'s match</div>
                <div className="text-xs text-muted-foreground">
                  {m.scheduledAt.toISOString()} · {m.participants.length}/{m.capacity}
                </div>
              </div>
              <div className="text-sm">{m.court?.name ?? "Unassigned"}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Courts</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {courts.map((c) => (
            <li key={c.id} className="rounded border p-3">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground">{c.location}</div>
              <div className="mt-1 text-xs">{c.status}</div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
