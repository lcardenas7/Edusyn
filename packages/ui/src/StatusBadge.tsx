import type { StepStatus, Severity } from '@edusyn/types';
import { CheckCircle2, Lock, Loader2, Circle, XCircle, AlertTriangle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx.js';

/**
 * StatusBadge — pastilla de estado.
 *
 * Renderiza un StepStatus o una Severity del contrato. El mapeo enum →
 * etiqueta/color es PURAMENTE presentacional (un enum cerrado de UI): el
 * componente nunca decide el estado, solo lo traduce a píxeles (AR2).
 * El dato (status/severity) siempre lo calcula el backend (E1).
 */

const STEP_STATUS_META: Record<StepStatus, { label: string; Icon: LucideIcon; classes: string }> = {
  locked: { label: 'Bloqueado', Icon: Lock, classes: 'bg-surface-2 text-ink-muted border-hairline' },
  available: { label: 'Disponible', Icon: Circle, classes: 'bg-surface-1 text-ink-secondary border-hairline' },
  in_progress: { label: 'En curso', Icon: Loader2, classes: 'bg-surface-2 text-ink-primary border-hairline' },
  done: { label: 'Completado', Icon: CheckCircle2, classes: 'bg-success-50 text-success-700 border-success-100' },
  error: { label: 'Error', Icon: XCircle, classes: 'bg-danger-50 text-danger-700 border-danger-100' },
};

const SEVERITY_META: Record<Severity, { label: string; Icon: LucideIcon; classes: string }> = {
  blocking: { label: 'Bloqueante', Icon: XCircle, classes: 'bg-danger-50 text-danger-700 border-danger-100' },
  warning: { label: 'Advertencia', Icon: AlertTriangle, classes: 'bg-warning-50 text-warning-700 border-warning-100' },
  info: { label: 'Sugerencia', Icon: Info, classes: 'bg-surface-2 text-ink-secondary border-hairline' },
};

export type StatusBadgeProps =
  | { status: StepStatus; severity?: never }
  | { severity: Severity; status?: never };

export function StatusBadge(props: StatusBadgeProps) {
  const meta = props.status ? STEP_STATUS_META[props.status] : SEVERITY_META[props.severity];
  const spin = props.status === 'in_progress';
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-badge font-medium',
        meta.classes,
      )}
    >
      <meta.Icon aria-hidden className={cx('h-3.5 w-3.5', spin && 'motion-safe:animate-spin')} />
      {meta.label}
    </span>
  );
}
