import type { User } from "@prisma/client";

export type WaitingPlayer = Pick<User, "id" | "name" | "skillLevel" | "skillRating">;

type Props = {
  players: WaitingPlayer[];
  emptyMessage?: string;
};

// Confirmed players who aren't currently in an active or queued match.
// They'll be folded into the queue automatically as queued matches are
// promoted onto courts.
export function WaitingPlayersList({
  players,
  emptyMessage = "Everyone's been paired.",
}: Props) {
  if (players.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {players.map((p) => (
        <li
          key={p.id}
          className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm"
        >
          <span className="truncate font-medium">{p.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {p.skillLevel.slice(0, 3)} · {p.skillRating.toFixed(1)}
          </span>
        </li>
      ))}
    </ul>
  );
}
