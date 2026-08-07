import type { Action, ActionIntent, SummaryFact } from '@edusyn/types';
import { ArrowRight } from 'lucide-react';
import { cx } from './cx.js';
import { ActionButton } from './ActionButton.js';

/**
 * Cards — tarjetas de métricas, progreso, resumen y acciones.
 *
 * Todas renderizan datos YA resueltos por el backend (SummaryFact llega con
 * el valor formateado, progress llega ponderado, actions llegan decididas).
 * Ninguna calcula nada (AR2, E1).
 */

/** MetricCard — un hecho resuelto: "1.500 · Estudiantes". */
export function MetricCard({ fact, className }: { fact: SummaryFact; className?: string }) {
  return (
    <div className={cx('rounded-card border border-hairline bg-surface-1 p-4', className)}>
      <p className="text-metrics-lg font-semibold text-ink-primary">{fact.value}</p>
      <p className="mt-1 text-body-sm text-ink-secondary">{fact.label}</p>
    </div>
  );
}

/**
 * ProgressCard — avance del proceso.
 * `progress` (0..100 ponderado) y `progressDetail` (conteo de filas) llegan
 * del backend; el componente solo los dibuja (UX4).
 */
export function ProgressCard({
  title,
  progress,
  progressDetail,
  className,
}: {
  title: string;
  progress: number;
  progressDetail?: { processed: number; total: number };
  className?: string;
}) {
  const pct = Math.round(progress); // solo redondeo de presentación, no cálculo de progreso
  return (
    <div className={cx('rounded-card border border-hairline bg-surface-1 p-4', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-body-base font-medium text-ink-primary">{title}</p>
        <p className="text-body-sm text-ink-secondary" aria-hidden>
          {progressDetail ? `${progressDetail.processed.toLocaleString('es-CO')} / ${progressDetail.total.toLocaleString('es-CO')}` : `${pct}%`}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={title}
        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** ImportSummaryCard — "qué detecté e inferiré" antes de escribir (I3). */
export function ImportSummaryCard({
  title = 'Resumen de lo detectado',
  summary,
  action,
  onIntent,
  className,
}: {
  title?: string;
  summary: SummaryFact[];
  action?: Action;
  onIntent?: (intent: ActionIntent) => void;
  className?: string;
}) {
  return (
    <section aria-label={title} className={cx('rounded-card border border-hairline bg-surface-1 p-4', className)}>
      <h3 className="text-h3 font-semibold text-ink-primary">{title}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {summary.map((fact) => (
          <div key={fact.key} className="rounded-card bg-surface-2 p-3">
            <dt className="text-badge text-ink-muted">{fact.label}</dt>
            <dd className="mt-0.5 text-h2 font-semibold text-ink-primary">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {action && onIntent && (
        <div className="mt-4">
          <ActionButton action={action} onIntent={onIntent} />
        </div>
      )}
    </section>
  );
}

/** ActionCard — acción principal con contexto (la "siguiente cosa que hacer"). */
export function ActionCard({
  title,
  description,
  action,
  onIntent,
  className,
}: {
  title: string;
  description?: string;
  action: Action;
  onIntent: (intent: ActionIntent) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex flex-col gap-3 rounded-card border border-hairline bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <p className="text-body-base font-semibold text-ink-primary">{title}</p>
        {description && <p className="mt-1 text-body-sm text-ink-secondary">{description}</p>}
      </div>
      <ActionButton action={action} onIntent={onIntent} className="shrink-0" />
    </div>
  );
}

/** QuickAction — atajo compacto de una acción disponible. */
export function QuickAction({
  action,
  onIntent,
  className,
}: {
  action: Action;
  onIntent: (intent: ActionIntent) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={!action.enabled}
      title={!action.enabled ? action.reason : undefined}
      onClick={() => action.enabled && onIntent(action.intent)}
      className={cx(
        'group flex min-h-card w-full items-center justify-between gap-2 rounded-card border border-hairline bg-surface-1 px-4 py-3 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        action.enabled ? 'hover:bg-surface-2' : 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="text-body-sm font-medium text-ink-primary">{action.label}</span>
      <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
    </button>
  );
}
