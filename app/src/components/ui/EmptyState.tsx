interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
