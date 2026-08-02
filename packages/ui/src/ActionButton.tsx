import { useState } from 'react';
import type { Action, ActionIntent } from '@edusyn/types';
import { cx } from './cx.js';
import { ConfirmationDialog } from './ConfirmationDialog.js';

/**
 * ActionButton — el botón gobernado por el contrato (E2).
 *
 * Renderiza UNA Action tal como la envía el backend:
 *  - `enabled: false` → botón deshabilitado + `reason` visible (UX5:
 *    nunca bloquear sin explicar).
 *  - `variant` → estilo (primary/secondary/destructive).
 *  - `requiresConfirmation: true` → abre ConfirmationDialog antes de
 *    ejecutar (I4, UX9).
 *  - `intent` → se entrega a `onIntent` sin interpretarlo (G3): la pantalla
 *    decide cómo ejecutarlo (router, fetch…); el botón no conoce endpoints.
 */
export interface ActionButtonProps {
  action: Action;
  onIntent: (intent: ActionIntent) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<Action['variant'], string> = {
  primary: 'bg-ink-primary text-white hover:bg-ink-primary/90',
  secondary: 'bg-surface-1 text-ink-primary border border-hairline hover:bg-surface-2',
  destructive: 'bg-danger-600 text-white hover:bg-danger-700',
};

export function ActionButton({ action, onIntent, size = 'md', fullWidth, className }: ActionButtonProps) {
  const [confirming, setConfirming] = useState(false);

  const execute = () => onIntent(action.intent);

  const handleClick = () => {
    if (action.requiresConfirmation) setConfirming(true);
    else execute();
  };

  return (
    <div className={cx(fullWidth && 'w-full', className)}>
      <button
        type="button"
        disabled={!action.enabled}
        onClick={handleClick}
        aria-disabled={!action.enabled}
        aria-describedby={!action.enabled && action.reason ? undefined : undefined}
        title={!action.enabled ? action.reason : undefined}
        className={cx(
          'inline-flex items-center justify-center rounded-card font-medium transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          size === 'sm' ? 'min-h-9 px-3 text-body-sm' : 'min-h-btn px-4 text-body-base',
          fullWidth && 'w-full',
          action.enabled
            ? VARIANT_CLASSES[action.variant]
            : 'cursor-not-allowed bg-surface-3 text-ink-muted',
        )}
      >
        {action.label}
      </button>

      {/* UX5: un control bloqueado siempre explica por qué */}
      {!action.enabled && action.reason && (
        <p className="mt-1.5 text-body-sm text-ink-muted">{action.reason}</p>
      )}

      <ConfirmationDialog
        open={confirming}
        action={action}
        onConfirm={() => {
          setConfirming(false);
          execute();
        }}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
