import { Loader2, Inbox, WifiOff } from 'lucide-react';
import { cx } from './cx.js';

/**
 * ViewStates — los cuatro estados obligatorios de toda vista (UX7, CH18):
 * cargando, vacío, error (con reintento) y éxito (éste lo pinta la pantalla).
 */

export function LoadingView({ label = 'Cargando…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cx('flex min-h-40 flex-col items-center justify-center gap-3', className)}>
      <Loader2 aria-hidden className="h-7 w-7 text-ink-muted motion-safe:animate-spin" />
      <p className="text-body-sm text-ink-secondary">{label}</p>
    </div>
  );
}

export function EmptyView({
  title,
  message,
  action,
  className,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex min-h-40 flex-col items-center justify-center gap-2 rounded-card border border-dashed border-hairline bg-surface-1 p-8 text-center', className)}>
      <Inbox aria-hidden className="h-8 w-8 text-ink-muted" />
      <p className="text-body-base font-medium text-ink-primary">{title}</p>
      {message && <p className="max-w-md text-body-sm text-ink-secondary">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorView({
  title = 'No pudimos cargar la información',
  message,
  onRetry,
  retryLabel = 'Reintentar',
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cx('flex min-h-40 flex-col items-center justify-center gap-2 rounded-card border border-danger-100 bg-danger-50 p-8 text-center', className)}>
      <WifiOff aria-hidden className="h-8 w-8 text-danger-600" />
      <p className="text-body-base font-semibold text-ink-primary">{title}</p>
      {message && <p className="max-w-md text-body-sm text-ink-secondary">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-btn rounded-card bg-ink-primary px-4 text-body-base font-medium text-white hover:bg-ink-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
