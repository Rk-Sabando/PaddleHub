// TODO: Public player profile — skill badge, rating chart, match history, ratings received.
export default function ProfilePage({ params }: { params: { userId: string } }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Player {params.userId}</h1>
      <p className="text-muted-foreground">Public profile.</p>
    </div>
  );
}
