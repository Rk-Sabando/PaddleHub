"use client";

import type { MatchFormat, SkillLevel } from "@prisma/client";
import { Pagination, usePagination } from "@/components/shared/Pagination";

export type PlayerRow = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  skillLevel: SkillLevel;
  skillRating: number;
  preferredFormat: MatchFormat;
  onboardedAt: Date | null;
  createdAt: Date;
};

type Props = {
  players: PlayerRow[];
  pageSize?: number;
};

export function PlayersTable({ players, pageSize = 10 }: Props) {
  const pagination = usePagination(players, pageSize);

  return (
    <div className="space-y-3">
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
            {pagination.pageItems.map((p) => (
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
      <Pagination {...pagination} pageSize={pageSize} />
    </div>
  );
}
