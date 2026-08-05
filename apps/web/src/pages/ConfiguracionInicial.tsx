import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { Action, ActionIntent, CanonicalStep, OnboardingState } from '@edusyn/types';
import {
  WizardShell,
  StatusBadge,
  ProgressCard,
  ImportSummaryCard,
  ActionCard,
  ValidationReportTable,
  InfoBanner,
  WarningBanner,
  SuccessBanner,
  FileDropUpload,
  ActionButton,
  LoadingView,
  ErrorView,
  EmptyView,
} from '@edusyn/ui';
import api from '../lib/api';
import { onboardingSource } from '../lib/onboarding/onboardingSource';
import { StudentsImportPanel } from '../components/onboarding/StudentsImportPanel';

/**
 * ConfiguracionInicial — puesta en marcha de la institución (Estado Canónico).
 *
 * Todo lo que se ve aquí llega del contrato: la pantalla no calcula estado,
 * progreso, elegibilidad ni bloqueos. Solo:
 *   1. pide el estado real a GET /onboarding/state (fuente intercambiable),
 *   2. reparte las props a los componentes,
 *   3. ejecuta los intents (navegar / subir / llamar endpoint).
 */
export default function ConfiguracionInicial() {
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedStep, setSelectedStep] = useState<string | undefined>(undefined);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const next = await onboardingSource.getState();
      setState(next);
      setSelectedStep((current) => current ?? next.recommendedNext ?? next.steps[0]?.key);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const step: CanonicalStep | undefined = useMemo(
    () => state?.steps.find((s) => s.key === selectedStep) ?? state?.steps[0],
    [state, selectedStep],
  );

  /** Ejecutor de intents: la única pieza de la pantalla que "actúa". */
  const handleIntent = useCallback(
    async (intent: ActionIntent) => {
      switch (intent.kind) {
        case 'navigate':
          navigate(intent.path);
          break;
        case 'submit':
          try {
            const method = (intent.method?.toLowerCase() ?? 'post') as 'post' | 'put' | 'patch' | 'delete';
            await api[method](intent.path);
            toast.success('Acción ejecutada correctamente.');
            void load();
          } catch (err: any) {
            const msg = err?.response?.data?.message;
            toast.error(Array.isArray(msg) ? msg.join(', ') : msg || 'Error al ejecutar la acción.');
          }
          break;
        case 'upload':
          // El upload real lo maneja FileDropUpload; este intent llega solo
          // si una ActionButton dispara un upload sin archivo, lo cual el
          // contrato no contempla (enmienda punto 9).
          toast.warning('Este paso espera un archivo: usa la zona de carga.');
          break;
      }
    },
    [navigate],
  );

  /** Refresca el Estado Canónico (tras apply: stepper y progreso se actualizan solos). */
  const refreshState = useCallback(() => {
    void load();
  }, [load]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-workspace px-4 py-10">
        <ErrorView message="Verifica tu conexión e inténtalo de nuevo." onRetry={() => void load()} />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-workspace px-4 py-10">
        <LoadingView label="Cargando estado del onboarding…" />
      </div>
    );
  }

  if (state.steps.length === 0) {
    return (
      <div className="mx-auto max-w-workspace px-4 py-10">
        <EmptyView title="Este proceso aún no tiene pasos configurados" />
      </div>
    );
  }

  const recommended = state.steps.find((s) => s.key === state.recommendedNext);
  const recommendedAction: Action | undefined = recommended?.actions.find((a) => a.enabled);
  const uploadAction = step?.actions.find((a) => a.intent.kind === 'upload');

  return (
    <WizardShell
      title="Configuración inicial"
      description="Estado real de tu institución, calculado por el backend. Completa cada paso para poner en marcha el año lectivo."
      steps={state.steps}
      recommendedNext={state.recommendedNext}
      selectedStep={step?.key}
      onSelectStep={setSelectedStep}
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna principal: detalle del paso seleccionado */}
        <div className="space-y-4 lg:col-span-2">
          {step && (
            <section aria-label={`Detalle del paso ${step.label}`} className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-hairline bg-surface-1 p-4">
                <h2 className="text-h2 font-semibold text-ink-primary">{step.label}</h2>
                <StatusBadge status={step.status} />
              </div>

              {/* Bloqueos explicados (UX5) */}
              {step.blockedBy.map((b) => (
                <WarningBanner key={b.key} title="Paso bloqueado" message={b.message} />
              ))}

              {/* Hechos resueltos por el backend */}
              {step.summary.length > 0 && (
                <ImportSummaryCard title="Lo que el sistema ya resolvió" summary={step.summary} />
              )}

              {/* Hallazgos (errores/advertencias/sugerencias) */}
              {step.issues.length > 0 && (
                <section aria-label="Hallazgos del paso">
                  <h3 className="mb-2 text-h3 font-semibold text-ink-primary">Hallazgos por revisar</h3>
                  <ValidationReportTable issues={step.issues} />
                </section>
              )}

              {step.status === 'done' && step.issues.length === 0 && (
                <SuccessBanner title="Paso completado" message="No hay nada pendiente aquí. Puedes continuar con el siguiente paso sugerido." />
              )}

              {/* Zona de carga cuando el paso tiene acción de upload */}
              {uploadAction && uploadAction.intent.kind === 'upload' && (
                <section aria-label="Carga de archivo">
                  <h3 className="mb-2 text-h3 font-semibold text-ink-primary">{uploadAction.label}</h3>
                  {step.key === 'students-import' ? (
                    /* Flujo real punta a punta (analyze → confirmación → apply → cuadre) */
                    <StudentsImportPanel uploadAction={uploadAction} onApplied={refreshState} />
                  ) : (
                    /* Docentes y carga académica: aún deshabilitados por el backend
                       ("Disponible próximamente"). Si se habilitan, el dropzone
                       hace el POST real al endpoint que expone el estado. */
                    <FileDropUpload
                      path={uploadAction.intent.path}
                      disabled={!uploadAction.enabled}
                      disabledReason={uploadAction.reason}
                      helperText="Plantilla oficial .xlsx — el análisis no modifica datos"
                    />
                  )}
                </section>
              )}

              {/* Demás acciones del paso, tal como las decidió el backend */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {step.actions
                  .filter((a) => a.intent.kind !== 'upload')
                  .map((a) => (
                    <ActionButton key={a.type} action={a} onIntent={handleIntent} />
                  ))}
              </div>
            </section>
          )}
        </div>

        {/* Columna lateral: progreso y siguiente sugerido */}
        <aside className="space-y-4">
          <ProgressCard title="Avance de la configuración" progress={state.progress} />

          {recommended && recommendedAction && (
            <ActionCard
              title={`Siguiente sugerido: ${recommended.label}`}
              description="El sistema sugiere; tú decides (E3)."
              action={recommendedAction}
              onIntent={handleIntent}
            />
          )}

          <InfoBanner
            title="Se actualiza sola"
            message="Esta pantalla muestra el avance real de tu institución. A medida que completes cada paso, se marca aquí automáticamente."
          />
        </aside>
      </div>
    </WizardShell>
  );
}
