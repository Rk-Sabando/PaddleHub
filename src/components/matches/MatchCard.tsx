// TODO: Display match summary — host, time, skill range, slots filled, status badge.
import type { Match } from "@/types/match";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MatchCard({ match }: { match: Match }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {match.format} — {new Date(match.scheduledAt).toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Skill {match.skillMin.toFixed(1)}–{match.skillMax.toFixed(1)} · {match.participants.length}/
          {match.capacity} players
        </p>
      </CardContent>
    </Card>
  );
}
