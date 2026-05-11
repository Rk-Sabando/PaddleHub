// TODO: Single-stat tile (matches played, win rate, etc).
export function StatsTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
