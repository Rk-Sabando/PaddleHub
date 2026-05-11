export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-md border border-dashed p-12 text-center">
      <h3 className="text-lg font-medium">{title}</h3>
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
