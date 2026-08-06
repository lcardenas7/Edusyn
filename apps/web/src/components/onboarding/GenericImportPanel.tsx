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
import api from '../../lib/api';

function serverMessage(e: unknown): string {
  const data = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  if (typeof data?.message === 'string') return data.message;
  if (e instanceof Error) return e.message;
  return 'Error inesperado. Inténtalo de nuevo.';
}

function isImportAnalysis(data: unknown): data is ImportAnalysis {
  const d = data as Partial<ImportAnalysis> | null;
  return !!d && Array.isArray(d.summary) && Array.isArray(d.issues) && typeof d.canApply === 'boolean';
}

function isApplyResult(data: unknown): data is ApplyResult {
  const d = data as Partial<ApplyResult> | null;
  return !!d && Array.isArray(d.summary) && typeof d.created === 'number' && Array.isArray(d.errors);
}

const MULTIPART = { headers: { 'Content-Type': undefined as unknown as string } };
const nf = new Intl.NumberFormat('es-CO');

export function GenericImportPanel({
  uploadAction,
  applyPath,
  onApplied,
}: {
  uploadAction: Action;
  applyPath: string;
  onApplied: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);

  const handleUpload = useCallback(async (f: File, path: string) => {
    setFile(f);
    setAnalysis(null);
    setApplyResult(null);
    setApplyError(null);
    setAnalyzeError(null);
    try {
      const body = new FormData();
      body.append('file', f);
      const { data } = await api.post(path, body, MULTIPART);
      if (!isImportAnalysis(data)) {
        throw new Error('El backend respondió en un formato inesperado. Contacta al administrador.');
      }
      return data;
    } catch (e) {
      setAnalyzeError(serverMessage(e));
      throw e;
    }
  }, []);

  const handleAnalyzed = useCallback((result: unknown) => {
    setAnalysis(result as ImportAnalysis);
  }, []);

  const handleApply = useCallback(async () => {
    if (!file) return;
    setApplying(true);
    setApplyError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const { data } = await api.post(applyPath, body, MULTIPART);
      if (!isApplyResult(data)) {
        throw new Error('El backend respondió en un formato inesperado.');
      }
      setApplyResult(data);
      setAnalysis(null);
      onApplied();
    } catch (e) {
      setApplyError(serverMessage(e));
    } finally {
      setApplying(false);
    }
  }, [file, applyPath, onApplied]);

  const reset = useCallback(() => {
    setFile(null);
    setAnalysis(null);
    setApplyResult(null);
    setApplyError(null);
    setAnalyzeError(null);
  }, []);

  if (uploadAction.intent.kind !== 'upload') return null;

  const applyAction: Action | null = analysis
    ? {
        type: 'apply',
        label: 'Aplicar importación',
        enabled: analysis.canApply,
        reason: analysis.blockedReason,
        variant: 'primary',
        requiresConfirmation: true,
        intent: { kind: 'submit', method: 'POST', path: applyPath },
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

      {analysis && (
        <>
          <ImportSummaryCard title="Lo que el sistema detectó" summary={analysis.summary} />
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
            intent: { kind: 'submit', method: 'POST', path: applyPath },
          }}
          onIntent={() => void handleApply()}
        />
      )}

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
