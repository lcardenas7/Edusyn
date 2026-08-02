/**
 * @edusyn/ui — Kit de componentes data-driven de Edusyn.
 *
 * REGLA DEL PAQUETE (AR2): estos componentes SOLO renderizan props del
 * contrato @edusyn/types. Nunca calculan estado, elegibilidad, progreso,
 * permisos ni validaciones. Si un componente necesita un dato que no llega
 * por props, falta un campo en el contrato — no se deduce aquí.
 *
 * A diferencia de @edusyn/types, este paquete SÍ emite runtime (React) y
 * solo lo consume apps/web (resolución bundler, Vite transpila la fuente).
 * Las clases Tailwind se generan en apps/web (su tailwind.config incluye
 * ../../packages/ui/src en `content`).
 */

export { cx } from './cx.js';
export { StatusBadge } from './StatusBadge.js';
export type { StatusBadgeProps } from './StatusBadge.js';

export { InfoBanner, SuccessBanner, WarningBanner, ErrorBanner, IssueBanner } from './Banners.js';
export type { BannerProps } from './Banners.js';

export { ConfirmationDialog } from './ConfirmationDialog.js';
export type { ConfirmationDialogProps } from './ConfirmationDialog.js';

export { ActionButton } from './ActionButton.js';
export type { ActionButtonProps } from './ActionButton.js';

export { ProgressStepper } from './ProgressStepper.js';
export type { ProgressStepperProps } from './ProgressStepper.js';

export { ValidationReportTable } from './ValidationReportTable.js';
export type { ValidationReportTableProps } from './ValidationReportTable.js';

export { MetricCard, ProgressCard, ImportSummaryCard, ActionCard, QuickAction } from './cards.js';

export { FileDropUpload } from './FileDropUpload.js';
export type { FileDropUploadProps } from './FileDropUpload.js';

export { WizardShell } from './WizardShell.js';
export type { WizardShellProps } from './WizardShell.js';

export { LoadingView, EmptyView, ErrorView } from './ViewStates.js';
