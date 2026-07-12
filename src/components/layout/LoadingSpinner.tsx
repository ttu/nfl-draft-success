export interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading…' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner" role="status" aria-live="polite">
      <span>{message}</span>
    </div>
  );
}
