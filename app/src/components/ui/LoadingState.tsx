interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "Loading X-ray database...",
}: LoadingStateProps) {
  return (
    <div
      className="flex items-center gap-2 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {message}
    </div>
  );
}
