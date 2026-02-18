interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      {message}
    </div>
  );
}
