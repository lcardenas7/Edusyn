import type { ReactNode } from 'react';
import type { CanonicalStep } from '@edusyn/types';
import { ProgressStepper } from './ProgressStepper.js';
import { cx } from './cx.js';

/**
 * WizardShell — marco de procesos multi-paso.
 *
 * Compone el ProgressStepper (estado ya calculado por el backend) con el
 * contenido del paso actual. El shell NO decide el orden ni la elegibilidad
 * de los pasos: solo los pinta (AR2, E1–E3).
 */
export interface WizardShellProps {
  title: string;
  description?: string;
  steps: CanonicalStep[];
  recommendedNext?: string;
  selectedStep?: string;
  onSelectStep?: (stepKey: string) => void;
  /** Contenido del paso activo. */
  children: ReactNode;
  /** Acciones de pie (botones), si las hay. */
  footer?: ReactNode;
  className?: string;
}

export function WizardShell({
  title,
  description,
  steps,
  recommendedNext,
  selectedStep,
  onSelectStep,
  children,
  footer,
  className,
}: WizardShellProps) {
  return (
    <div className={cx('mx-auto w-full max-w-workspace px-4 py-6 sm:px-6', className)}>
      <header className="mb-6">
        <h1 className="text-h1-lg font-bold text-ink-primary">{title}</h1>
        {description && <p className="mt-1 text-body-base text-ink-secondary">{description}</p>}
      </header>

      <nav aria-label="Pasos del proceso" className="mb-6 rounded-card border border-hairline bg-surface-1 p-3 sm:p-4">
        <ProgressStepper
          steps={steps}
          recommendedNext={recommendedNext}
          selectedStep={selectedStep}
          onSelectStep={onSelectStep}
        />
      </nav>

      <main>{children}</main>

      {footer && (
        <footer className="mt-6 flex flex-col gap-2 border-t border-hairline pt-4 sm:flex-row sm:justify-end">
          {footer}
        </footer>
      )}
    </div>
  );
}
