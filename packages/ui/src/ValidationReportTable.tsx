import type { ActionIntent, Issue, Severity } from '@edusyn/types';
import { StatusBadge } from './StatusBadge.js';
import { ActionButton } from './ActionButton.js';
import { cx } from './cx.js';

/**
 * ValidationReportTable — reporte de hallazgos de validación (§7 I2, CH8).
 *
 * Data-driven por diseño (CO3): renderiza una lista ARBITRARIA de Issues.
 * Agregar un tipo de hallazgo nuevo en el backend NO requiere tocar este
 * componente. El orden lo fija el componente solo por severidad
 * (presentación: bloqueantes primero); nunca filtra ni interpreta motivos.
 *
 * Responsive: tabla en md+, tarjetas apiladas en móvil.
 */

const SEVERITY_ORDER: Record<Severity, number> = { blocking: 0, warning: 1, info: 2 };

function formatLocation(issue: Issue): string {
  const { row, field } = issue.location ?? {};
  if (row && field) return `Fila ${row} · ${field}`;
  if (row) return `Fila ${row}`;
  if (field) return field;
  return 'General';
}

export interface ValidationReportTableProps {
  issues: Issue[];
  /** Acción contextual opcional (ej. reintentar análisis). Ya decidida por el backend. */
  action?: import('@edusyn/types').Action;
  onIntent?: (intent: ActionIntent) => void;
  className?: string;
}

export function ValidationReportTable({ issues, action, onIntent, className }: ValidationReportTableProps) {
  const sorted = [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  if (sorted.length === 0) {
    return (
      <div className={cx('rounded-card border border-hairline bg-surface-1 p-6 text-center', className)}>
        <p className="text-body-base text-ink-secondary">Sin hallazgos. Todo validado correctamente.</p>
      </div>
    );
  }

  return (
    <div className={cx('overflow-hidden rounded-card border border-hairline bg-surface-1', className)}>
      {/* Móvil: tarjetas */}
      <ul className="divide-y divide-hairline md:hidden">
        {sorted.map((issue, i) => (
          <li key={i} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge severity={issue.severity} />
              <span className="text-badge text-ink-muted">{formatLocation(issue)}</span>
            </div>
            <p className="text-body-sm text-ink-primary">{issue.message}</p>
            {issue.howToFix && <p className="text-body-sm text-ink-secondary">{issue.howToFix}</p>}
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <table className="hidden w-full text-left md:table">
        <thead>
          <tr className="border-b border-hairline bg-surface-2 text-badge font-semibold uppercase tracking-wide text-ink-muted">
            <th scope="col" className="px-4 py-3">Severidad</th>
            <th scope="col" className="px-4 py-3">Ubicación</th>
            <th scope="col" className="px-4 py-3">Qué pasó</th>
            <th scope="col" className="px-4 py-3">Cómo corregir</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {sorted.map((issue, i) => (
            <tr key={i} className="align-top">
              <td className="px-4 py-3"><StatusBadge severity={issue.severity} /></td>
              <td className="px-4 py-3 text-body-sm text-ink-secondary">{formatLocation(issue)}</td>
              <td className="px-4 py-3 text-body-sm text-ink-primary">{issue.message}</td>
              <td className="px-4 py-3 text-body-sm text-ink-secondary">{issue.howToFix ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {action && onIntent && (
        <div className="border-t border-hairline bg-surface-2 p-3">
          <ActionButton action={action} onIntent={onIntent} size="sm" />
        </div>
      )}
    </div>
  );
}
