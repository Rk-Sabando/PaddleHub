// TODO: Match detail — participants, join/leave button, real-time chat, score entry post-match.
export default function MatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Match {params.id}</h1>
      <p className="text-muted-foreground">Details, participants, and chat panel.</p>
    </div>
  );
}
