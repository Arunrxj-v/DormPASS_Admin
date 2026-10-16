import { isApiError } from '../api/client';

/** Honest loading state — no skeleton shimmer, just a spinner + label. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Renders any thrown value (ApiError envelope, network failure, …) as an
 * honest error panel with the server's message — never a crash.
 */
export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const message = errorMessage(error);
  const code = isApiError(error) ? error.code : null;
  const status = isApiError(error) ? error.status : null;

  return (
    <div className="error-state" role="alert">
      <span className="error-title">
        {title}
        {code ? <span className="muted"> · {code}</span> : null}
        {status ? <span className="muted"> · HTTP {status}</span> : null}
      </span>
      <span className="error-message">{message}</span>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'An unexpected error occurred.';
}

/** Empty result — states plainly that there is nothing to show. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <span>{message}</span>
    </div>
  );
}
