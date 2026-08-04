import { useCallback, useState } from 'react';
import type { Action, ApplyResult, ImportAnalysis, SummaryFact } from '@edusyn/types';
import {
  FileDropUpload,
  ImportSummaryCard,
  ValidationReportTable,
  ActionButton,
  SuccessBanner,
  ErrorBanner,
  WarningBanner,
  LoadingView,
  MetricCard,
} from '@edusyn/ui';
import { useAuth } from '../../contexts/AuthContext';
import { academicYearLifecycleApi } from '../../lib/api';
import { analyzeStudents, applyStudents } from '../../lib/onboarding/studentImportApi';

/**
 * StudentsImportPanel — flujo de importación de estudiantes punta a punta (§7).
 *
 * ANALYZE (real, read-only) → resumen + hallazgos → CONFIRMACIÓN → APPLY
 * (real, idempotente) → cuadre → refresh del Estado Canónico.
 *
 * Este componente de módulo es el que gobierna las acciones CON payload
 * (archivo + academicYearId), según la enmienda del contrato punto 8. No
 * calcula nada: canApply, blockedReason, summary, issues y el cuadre llegan
 * decididos del backend (AR2, E2). El archivo se conserva solo para
 * reenviarlo al apply — el backend lo re-parsa (no hay estado derivado).
 */

/** Mensaje de error del servidor tal cual (AR13: el backend ya lo hace humano). */
function serverMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  if (typeof data?.message === 'string') return data.message;
  if (e instanceof Error) return e.message;
  return 'Error inesperado. Inténtalo de nuevo.';
}

const nf = new Intl.NumberFormat('es-CO');

export function StudentsImportPanel({
  uploadAction,
  onApplied,
}: {
  /** Acción de upload del paso, tal como la decidió el backend (path, enabled, reason). */
  uploadAction: Action;
  /** Tras un apply exitoso: la pantalla vuelve a pedir el Estado Canónico. */
  onApplied: () => void;
}) {
  const { institution } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  /** ANALYZE real. FileDropUpload muestra su propio estado cargando/error. */
  const handleUpload = useCallback(async (f: File, _path: string) => {
    setFile(f);
    setAnalysis(null);
    setApplyResult(null);
    setApplyError(null);
    setAnalyzeError(null);
    try {
      return await analyzeStudents(f);
    } catch (e) {
      setAnalyzeError(serverMessage(e));
      throw e; // FileDropUpload también refleja el fallo en la zona de carga
    }
  }, []);

  const handleAnalyzed = useCallback((result: unknown) => {
    // La guardia de contrato ya validó la forma en studentImportApi.
    setAnalysis(result as ImportAnalysis);
  }, []);

  /** APPLY real: mismo archivo + academicYearId del año destino (DRAFT). */
  const handleApply = useCallback(async () => {
    if (!file) return;
    setApplying(true);
    setApplyError(null);
    try {
      if (!institution?.id) throw new Error('No se encontró la institución de la sesión.');
      const year = (await academicYearLifecycleApi.getCurrent(institution.id)).data;
      if (!year?.id) throw new Error('No hay un año lectivo destino. Crea el año lectivo primero.');
      const result = await applyStudents(file, year.id);
      setApplyResult(result);
      setAnalysis(null);
      onApplied(); // refresh del Estado Canónico: stepper y progreso se actualizan solos
    } catch (e) {
      setApplyError(serverMessage(e));
    } finally {
      setApplying(false);
    }
  }, [file, institution?.id, onApplied]);

  const reset = useCallback(() => {
    setFile(null);
    setAnalysis(null);
    setApplyResult(null);
    setApplyError(null);
    setAnalyzeError(null);
  }, []);

  if (uploadAction.intent.kind !== 'upload') return null;

  // Acción de apply construida 1:1 desde campos del contrato (canApply /
  // blockedReason llegan decididos; el panel no los deduce de los issues).
  const applyAction: Action | null = analysis
    ? {
        type: 'apply',
        label: 'Aplicar importación',
        enabled: analysis.canApply,
        reason: analysis.blockedReason,
        variant: 'primary',
        requiresConfirmation: true,
        intent: { kind: 'submit', method: 'POST', path: '/onboarding/students/apply' },
      }
    : null;

  const cuadreFacts: SummaryFact[] = applyResult
    ? [
        { key: 'created', label: 'Creados', value: nf.format(applyResult.created) },
        { key: 'updated', label: 'Ya existían', value: nf.format(applyResult.updated) },
        { key: 'skipped', label: 'Omitidos', value: nf.format(applyResult.skipped) },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* 1. Zona de carga → ANALYZE */}
      <FileDropUpload
        path={uploadAction.intent.path}
        onUpload={handleUpload}
        onComplete={handleAnalyzed}
        disabled={!uploadAction.enabled || applying}
        disabledReason={uploadAction.reason}
        helperText="Plantilla oficial .xlsx — el análisis no modifica datos"
      />

      {analyzeError && (
        <ErrorBanner
          title="No pudimos analizar el archivo"
          message={analyzeError}
          howToFix="Revisa el archivo y súbelo de nuevo desde la zona de carga."
        />
      )}

      {/* 2. RESUMEN + VALIDACIÓN (lo que el servidor detectó e inferirá) */}
      {analysis && (
        <>
          <ImportSummaryCard title="Lo que el sistema detectó e inferirá" summary={analysis.summary} />
          {analysis.issues.length > 0 && (
            <section aria-label="Hallazgos de la validación">
              <h3 className="mb-2 text-h3 font-semibold text-ink-primary">Hallazgos de la validación</h3>
              <ValidationReportTable issues={analysis.issues} />
            </section>
          )}
          {!analysis.canApply && analysis.blockedReason && (
            <WarningBanner title="No se puede aplicar todavía" message={analysis.blockedReason} />
          )}
        </>
      )}

      {/* 3. CONFIRMACIÓN → APPLY */}
      {applyAction && !applyResult && (
        <div className="max-w-xs">
          {applying ? (
            <LoadingView label="Aplicando la importación en el servidor…" />
          ) : (
            <ActionButton action={applyAction} onIntent={() => void handleApply()} fullWidth />
          )}
        </div>
      )}

      {applyError && (
        <ErrorBanner
          title="La importación no se completó"
          message={applyError}
          howToFix="Puedes reintentar: la operación es idempotente, no se duplicarán datos."
          action={{
            type: 'retry',
            label: 'Reintentar',
            enabled: !applying,
            variant: 'secondary',
            requiresConfirmation: false,
            intent: { kind: 'submit', method: 'POST', path: '/onboarding/students/apply' },
          }}
          onIntent={() => void handleApply()}
        />
      )}

      {/* 4. RESULTADO: cuadre estándar (I6 — nada se aplica en silencio) */}
      {applyResult && (
        <>
          <SuccessBanner
            title="Importación aplicada"
            message="El servidor terminó de escribir. El avance del paso se actualizó automáticamente."
          />
          <div className="grid grid-cols-3 gap-3">
            {cuadreFacts.map((f) => (
              <MetricCard key={f.key} fact={f} />
            ))}
          </div>
          {applyResult.summary.length > 0 && (
            <ImportSummaryCard title="Detalle de lo aplicado" summary={applyResult.summary} />
          )}
          {(applyResult.errors.length > 0 || applyResult.warnings.length > 0) && (
            <ValidationReportTable issues={[...applyResult.errors, ...applyResult.warnings]} />
          )}
          <ActionButton
            action={{
              type: 'another',
              label: 'Importar otro archivo',
              enabled: true,
              variant: 'secondary',
              requiresConfirmation: false,
              intent: { kind: 'navigate', path: '#' },
            }}
            onIntent={reset}
          />
        </>
      )}
    </div>
  );
}
