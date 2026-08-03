import type { OnboardingState } from '@edusyn/types';
import api from '../api';

/**
 * Fuente de datos del Onboarding Institucional — PUNTO ÚNICO DE INTERCAMBIO.
 *
 * La aplicación consume el estado SIEMPRE a través de `OnboardingDataSource`.
 * Hoy la implementación es un mock que cumple el contrato @edusyn/types;
 * cuando el backend entregue GET /onboarding/state (§5, AR10), se reemplaza
 * la implementación aquí y NADA MÁS cambia: ni componentes ni pantallas.
 *
 * El mock NO simula lógica de negocio: es un fixture estático que representa
 * un estado que el backend calcularía. Ningún valor se deriva en el cliente.
 */
export interface OnboardingDataSource {
  getState(): Promise<OnboardingState>;
}

/**
 * Fixture: colegio a mitad del onboarding. Año lectivo y estructura listos;
 * la importación de estudiantes tiene hallazgos por corregir; los pasos
 * siguientes esperan sus precondiciones (blockedBy).
 */
const MOCK_STATE: OnboardingState = {
  kind: 'onboarding',
  contractVersion: 1,
  progress: 45,
  recommendedNext: 'students-import',
  steps: [
    {
      key: 'academic-year',
      label: 'Año lectivo',
      status: 'done',
      blockedBy: [],
      summary: [
        { key: 'year', label: 'Año lectivo', value: '2026' },
        { key: 'periods', label: 'Períodos', value: '4' },
      ],
      issues: [],
      actions: [
        {
          type: 'view',
          label: 'Ver configuración',
          enabled: true,
          variant: 'secondary',
          requiresConfirmation: false,
          intent: { kind: 'navigate', path: '/setup' },
        },
      ],
    },
    {
      key: 'structure',
      label: 'Estructura académica',
      status: 'done',
      blockedBy: [],
      summary: [
        { key: 'levels', label: 'Niveles', value: '3' },
        { key: 'grades', label: 'Grados', value: '11' },
        { key: 'groups', label: 'Grupos', value: '42' },
      ],
      issues: [],
      actions: [
        {
          type: 'view',
          label: 'Ver estructura',
          enabled: true,
          variant: 'secondary',
          requiresConfirmation: false,
          intent: { kind: 'navigate', path: '/institution/structure' },
        },
      ],
    },
    {
      key: 'students-import',
      label: 'Importación de estudiantes',
      status: 'error',
      blockedBy: [],
      summary: [
        { key: 'students', label: 'Estudiantes detectados', value: '1.500' },
        { key: 'guardians', label: 'Acudientes inferidos', value: '1.218' },
      ],
      issues: [
        {
          severity: 'blocking',
          code: 'DUPLICATE_DOCUMENT',
          message: 'Documento 1034567890 aparece dos veces en el archivo',
          howToFix: 'Corrige el documento en la fila indicada y vuelve a analizar el archivo',
          location: { row: 42, field: 'documento' },
        },
        {
          severity: 'blocking',
          code: 'EMAIL_COLLISION',
          message: 'El correo luisa.gomez@colegio.edu.co ya pertenece a otro usuario del sistema',
          howToFix: 'Usa un correo distinto o vincula el registro al usuario existente',
          location: { row: 387, field: 'correo_acudiente' },
        },
        {
          severity: 'warning',
          code: 'GRADE_SEQUENCE_GAP',
          message: 'No se encontraron estudiantes para 5.° en el archivo',
          howToFix: 'Si el grado 5.° no tiene matrícula este año, puedes ignorar esta advertencia',
        },
        {
          severity: 'info',
          code: 'NAME_NORMALIZATION',
          message: '86 nombres se normalizarán a formato «Apellidos, Nombres»',
        },
      ],
      actions: [
        {
          type: 'analyze',
          label: 'Analizar archivo corregido',
          enabled: true,
          variant: 'primary',
          requiresConfirmation: false,
          intent: { kind: 'upload', path: '/imports/students/analyze' },
        },
        {
          type: 'apply',
          label: 'Aplicar importación',
          enabled: false,
          reason: 'Hay 2 hallazgos bloqueantes por corregir',
          variant: 'primary',
          requiresConfirmation: true,
          intent: { kind: 'submit', method: 'POST', path: '/imports/students/apply' },
        },
        {
          type: 'download_template',
          label: 'Descargar plantilla oficial',
          enabled: true,
          variant: 'secondary',
          requiresConfirmation: false,
          intent: { kind: 'submit', method: 'POST', path: '/imports/students/template' },
        },
      ],
    },
    {
      key: 'teachers-import',
      label: 'Importación de docentes',
      status: 'locked',
      blockedBy: [
        { key: 'students-import', message: 'Completa la importación de estudiantes para habilitar este paso' },
      ],
      summary: [],
      issues: [],
      actions: [
        {
          type: 'analyze',
          label: 'Analizar archivo de docentes',
          enabled: false,
          reason: 'Completa primero la importación de estudiantes',
          variant: 'primary',
          requiresConfirmation: false,
          intent: { kind: 'upload', path: '/imports/teachers/analyze' },
        },
      ],
    },
    {
      key: 'academic-load',
      label: 'Carga académica',
      status: 'locked',
      blockedBy: [
        { key: 'teachers-import', message: 'Completa la importación de docentes para habilitar este paso' },
      ],
      summary: [],
      issues: [],
      actions: [
        {
          type: 'analyze',
          label: 'Analizar carga académica',
          enabled: false,
          reason: 'Completa primero la importación de docentes',
          variant: 'primary',
          requiresConfirmation: false,
          intent: { kind: 'upload', path: '/imports/academic-load/analyze' },
        },
      ],
    },
    {
      key: 'activation',
      label: 'Activación del año',
      status: 'locked',
      blockedBy: [
        { key: 'students-import', message: 'Completa la importación de estudiantes' },
        { key: 'teachers-import', message: 'Completa la importación de docentes' },
        { key: 'academic-load', message: 'Completa la carga académica' },
      ],
      summary: [],
      issues: [],
      actions: [
        {
          type: 'activate',
          label: 'Activar año lectivo 2026',
          enabled: false,
          reason: 'Quedan 3 pasos por completar',
          variant: 'destructive',
          requiresConfirmation: true,
          intent: { kind: 'submit', method: 'POST', path: '/academic-years/2026/activate' },
        },
      ],
    },
  ],
};

const mockSource: OnboardingDataSource = {
  async getState() {
    // Latencia simulada para ejercitar el estado de carga (UX7).
    await new Promise((resolve) => setTimeout(resolve, 600));
    return structuredClone(MOCK_STATE);
  },
};

/**
 * Fuente real: consume GET /onboarding/state (Módulo 8) con el cliente axios
 * autenticado (inyecta el token y maneja el 401 → login). El estado lo calcula
 * el backend por completo; aquí no se deriva nada (AR2/E1).
 */
const httpSource: OnboardingDataSource = {
  async getState() {
    const { data } = await api.get<OnboardingState>('/onboarding/state');
    return data;
  },
};

// Fuente activa. Para desarrollo offline sin backend, cambiar a `mockSource`.
export const onboardingSource: OnboardingDataSource = httpSource;

// Referencia de desarrollo (no se elimina): fixture que cumple el contrato.
void mockSource;
