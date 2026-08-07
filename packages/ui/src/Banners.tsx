import type { Action, ActionIntent, Issue, Severity } from '@edusyn/types';
import { Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx.js';
import { ActionButton } from './ActionButton.js';

/**
 * Banners — avisos contextuales del sistema.
 *
 * Solo presentan información recibida: título, mensaje, cómo corregir y una
 * posible acción (que el backend envía ya decidida, E2). Nunca infieren la
 * severidad ni el texto: eso viaja en el contrato (C4, UX2).
 */

const VARIANT_META: Record<Severity | 'success', { Icon: LucideIcon; classes: string; iconClasses: string }> = {
  blocking: { Icon: XCircle, classes: 'bg-danger-50 border-danger-100', iconClasses: 'text-danger-600' },
  warning: { Icon: AlertTriangle, classes: 'bg-warning-50 border-warning-100', iconClasses: 'text-warning-600' },
  info: { Icon: Info, classes: 'bg-surface-2 border-hairline', iconClasses: 'text-ink-secondary' },
  success: { Icon: CheckCircle2, classes: 'bg-success-50 border-success-100', iconClasses: 'text-success-600' },
};

export interface BannerProps {
  title: string;
  message?: string;
  /** Cómo corregir / qué sigue. Llega localizado desde el backend. */
  howToFix?: string;
  /** Acción disponible (reintentar, continuar…). Ya decidida por el backend. */
  action?: Action;
  onIntent?: (intent: ActionIntent) => void;
  className?: string;
}

function BannerBase({
  variant,
  live,
  title,
  message,
  howToFix,
  action,
  onIntent,
  className,
}: BannerProps & { variant: Severity | 'success'; live: 'polite' | 'assertive' }) {
  const meta = VARIANT_META[variant];
  return (
    <div
      role={live === 'assertive' ? 'alert' : 'status'}
      aria-live={live}
      className={cx('flex gap-3 rounded-card border p-4', meta.classes, className)}
    >
      <meta.Icon aria-hidden className={cx('mt-0.5 h-5 w-5 shrink-0', meta.iconClasses)} />
      <div className="min-w-0 flex-1">
        <p className="text-body-base font-semibold text-ink-primary">{title}</p>
        {message && <p className="mt-1 text-body-sm text-ink-secondary">{message}</p>}
        {howToFix && (
          <p className="mt-2 text-body-sm text-ink-secondary">
            <span className="font-medium text-ink-primary">Cómo continuar: </span>
            {howToFix}
          </p>
        )}
        {action && onIntent && (
          <div className="mt-3">
            <ActionButton action={action} onIntent={onIntent} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export function InfoBanner(props: BannerProps) {
  return <BannerBase variant="info" live="polite" {...props} />;
}

export function SuccessBanner(props: BannerProps) {
  return <BannerBase variant="success" live="polite" {...props} />;
}

export function WarningBanner(props: BannerProps) {
  return <BannerBase variant="warning" live="polite" {...props} />;
}

export function ErrorBanner(props: BannerProps) {
  return <BannerBase variant="blocking" live="assertive" {...props} />;
}

/**
 * IssueBanner — banner alimentado directamente por un Issue del contrato
 * (severidad → variante visual es mapeo presentacional 1:1).
 */
export function IssueBanner({ issue, onIntent, className }: { issue: Issue; action?: Action; onIntent?: (intent: ActionIntent) => void; className?: string }) {
  const location = issue.location?.row
    ? `Fila ${issue.location.row}${issue.location.field ? ` · ${issue.location.field}` : ''}`
    : issue.location?.field;
  return (
    <BannerBase
      variant={issue.severity}
      live={issue.severity === 'blocking' ? 'assertive' : 'polite'}
      title={location ? `${location} — ${issue.message}` : issue.message}
      howToFix={issue.howToFix}
      onIntent={onIntent}
      className={className}
    />
  );
}
