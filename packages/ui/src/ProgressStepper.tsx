import type { CanonicalStep } from '@edusyn/types';
import { CheckCircle2, Lock, Loader2, Circle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cx } from './cx.js';

/**
 * ProgressStepper — barra de pasos de un proceso con ciclo de vida.
 *
 * Recibe los pasos CON su estado ya calculado por el backend (E1) y los
 * dibuja en el orden en que llegan. Nunca reordena, nunca deduce cuál sigue:
 * `recommendedNext` llega en el estado (E3) y solo se usa para destacar.
 *
 * Responsive: vertical en móvil, horizontal en sm+. El paso recomendado se
 * marca con aria-current="step".
 */

const STATUS_ICON: Record<CanonicalStep['status'], { Icon: LucideIcon; classes: string }> = {
  locked: { Icon: Lock, classes: 'border-hairline bg-surface-2 text-ink-muted' },
  available: { Icon: Circle, classes: 'border-hairline bg-surface-1 text-ink-secondary' },
  in_progress: { Icon: Loader2, classes: 'border-accent bg-surface-1 text-accent' },
  done: { Icon: CheckCircle2, classes: 'border-success-500 bg-success-50 text-success-600' },
  error: { Icon: XCircle, classes: 'border-danger-500 bg-danger-50 text-danger-600' },
};

export interface ProgressStepperProps {
  steps: CanonicalStep[];
  /** Key del paso sugerido por el backend (E3: sugerir, no forzar). */
  recommendedNext?: string;
  /** Permite enfocar un paso para ver su detalle. Opcional. */
  onSelectStep?: (stepKey: string) => void;
  selectedStep?: string;
  className?: string;
}

export function ProgressStepper({ steps, recommendedNext, onSelectStep, selectedStep, className }: ProgressStepperProps) {
  return (
    <ol className={cx('flex flex-col gap-1 sm:flex-row sm:gap-0', className)} aria-label="Progreso del proceso">
      {steps.map((step, i) => {
        const meta = STATUS_ICON[step.status];
        const recommended = step.key === recommendedNext;
        const selected = step.key === selectedStep;
        const content = (
          <>
            <span
              className={cx(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                meta.classes,
                recommended && 'ring-2 ring-accent/30 ring-offset-2 ring-offset-surface-1',
              )}
            >
              <meta.Icon
                aria-hidden
                className={cx('h-4.5 w-4.5', step.status === 'in_progress' && 'motion-safe:animate-spin')}
              />
            </span>
            <span className="min-w-0">
              <span className={cx('block truncate text-body-sm font-medium', selected ? 'text-ink-primary' : 'text-ink-secondary')}>
                {i + 1}. {step.label}
              </span>
              {step.status === 'locked' && step.blockedBy.length > 0 && (
                <span className="block text-badge text-ink-muted">{step.blockedBy[0].message}</span>
              )}
              {recommended && step.status !== 'done' && (
                <span className="block text-badge font-medium text-accent">Siguiente sugerido</span>
              )}
            </span>
          </>
        );

        return (
          <li key={step.key} className="relative flex-1">
            {/* Conector */}
            {i < steps.length - 1 && (
              <span
                aria-hidden
                className={cx(
                  'absolute bg-hairline',
                  'left-[1.1rem] top-9 h-[calc(100%-2rem)] w-0.5 sm:left-auto sm:right-0 sm:top-1/2 sm:h-0.5 sm:w-[calc(100%-2.5rem)] sm:-translate-y-1/2',
                )}
              />
            )}
            {onSelectStep ? (
              <button
                type="button"
                onClick={() => onSelectStep(step.key)}
                aria-current={recommended ? 'step' : undefined}
                className={cx(
                  'relative z-10 flex w-full items-center gap-3 rounded-card p-2 text-left transition-colors',
                  'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  'min-h-row',
                )}
              >
                {content}
              </button>
            ) : (
              <div aria-current={recommended ? 'step' : undefined} className="relative z-10 flex items-center gap-3 p-2">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
