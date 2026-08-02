import { useEffect, useRef } from 'react';
import type { Action } from '@edusyn/types';
import { cx } from './cx.js';

/**
 * ConfirmationDialog — confirmación explícita de acciones delicadas.
 *
 * Se muestra SOLO cuando la Action del backend trae
 * `requiresConfirmation: true` (I4, UX9). El componente no decide qué es
 * destructivo: eso llega en `action.variant` / `requiresConfirmation`.
 *
 * Accesibilidad: role="dialog" aria-modal, foco inicial en Cancelar (la
 * opción segura), Escape cierra, retorna el foco al invocador al cerrar.
 */
export interface ConfirmationDialogProps {
  open: boolean;
  action: Action;
  /** Texto adicional de contexto (opcional, llega del contrato/pantalla). */
  detail?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({ open, action, detail, onConfirm, onCancel }: ConfirmationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const invokerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    invokerRef.current = document.activeElement;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      (invokerRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const destructive = action.variant === 'destructive';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-primary/40 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-modal bg-surface-1 p-6 shadow-xl motion-safe:animate-[dialog-in_150ms_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dialog-title" className="text-h2 font-semibold text-ink-primary">
          {action.label}
        </h2>
        <p className="mt-2 text-body-sm text-ink-secondary">
          {detail ?? (destructive ? 'Esta acción no se puede deshacer.' : 'Confirma para continuar.')}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-btn rounded-card border border-hairline bg-surface-1 px-4 text-body-base font-medium text-ink-primary transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cx(
              'min-h-btn rounded-card px-4 text-body-base font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              destructive ? 'bg-danger-600 hover:bg-danger-700' : 'bg-ink-primary hover:bg-ink-primary/90',
            )}
          >
            {action.label}
          </button>
        </div>
      </div>
    </div>
  );
}
