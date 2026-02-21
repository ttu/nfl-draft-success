export interface LoadingSpinnerProps {
  /** Accessible loading message. Default: "Loading…" */
  message?: string;
}

export function LoadingSpinner({ message = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span className="app-loading__spinner" aria-hidden />
      <span className="app-loading__text">{message}</span>
    </div>
  );
}
