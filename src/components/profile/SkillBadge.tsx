// TODO: Color-coded badge for skill rating (e.g., 2.5 = beginner green, 4.5 = advanced red).
export function SkillBadge({ rating }: { rating: number }) {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {rating.toFixed(1)}
    </span>
  );
}
