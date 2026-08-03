import { Injectable } from '@nestjs/common';
import type { Action, CanonicalStep, Issue, OnboardingState, StepStatus } from '@edusyn/types';

import { PrismaService } from '../../prisma/prisma.service';
import { InstitutionConfigService } from '../institution-config/institution-config.service';
import { AcademicYearLifecycleService } from '../academic/academic-year-lifecycle.service';

/**
 * MÓDULO 8 (Onboarding v2) — Estado Canónico del onboarding (§5, AR10).
 *
 * Read-only puro (I1): reúne HECHOS CONSUMADOS (config lista, año, conteos de
 * ecosistema/personas/asignaciones) y arma los pasos con su status, bloqueos,
 * conteos y acciones. El frontend NO deriva nada de esto (AR2/E1).
 *
 * No reimplementa reglas: reusa InstitutionConfigService.getConfigCompleteness
 * para el gate SIEE (AR3). El tipo de respuesta es OnboardingState de
 * @edusyn/types — sin variante propia (CH3).
 */

/** Pesos del progreso ponderado (§4 de la spec). Suman 100. */
const STEP_WEIGHTS: Record<string, number> = {
  'siee-config': 15,
  'academic-year': 15,
  'students-import': 30,
  'teachers-import': 15,
  'academic-load': 15,
  activation: 10,
};

const nf = new Intl.NumberFormat('es-CO');

@Injectable()
export class OnboardingStateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: InstitutionConfigService,
    private readonly yearLifecycle: AcademicYearLifecycleService,
  ) {}

  async getState(institutionId: string): Promise<OnboardingState> {
    // 1. Recolección en una sola pasada (sin N+1).
    const [completeness, year, campusCount, shiftCount, gradeCount, groupCount, teacherCount] =
      await Promise.all([
        this.configService.getConfigCompleteness(institutionId),
        this.prisma.academicYear.findFirst({
          where: { institutionId, status: { in: ['DRAFT', 'ACTIVE'] } },
          orderBy: { year: 'desc' },
          select: { id: true, year: true, status: true },
        }),
        this.prisma.campus.count({ where: { institutionId } }),
        this.prisma.shift.count({ where: { campus: { institutionId } } }),
        this.prisma.grade.count({ where: { institutionId } }),
        this.prisma.group.count({ where: { campus: { institutionId } } }),
        this.prisma.institutionUser.count({
          where: {
            institutionId,
            institutionUserRoles: { some: { role: { name: 'DOCENTE' } } },
          },
        }),
      ]);

    // 2. Conteos que dependen del año destino.
    const [enrollmentCount, assignmentCount, periodCount] = year
      ? await Promise.all([
          this.prisma.studentEnrollment.count({
            where: { institutionId, academicYearId: year.id },
          }),
          this.prisma.teacherAssignment.count({
            where: { institutionId, academicYearId: year.id },
          }),
          this.prisma.academicTerm.count({
            where: { academicYearId: year.id, type: 'PERIOD' },
          }),
        ])
      : [0, 0, 0];

    // 3. Señales de "done" por paso.
    const sieeDone = completeness.ready;
    const yearDone = !!year;
    const studentsDone = enrollmentCount > 0;
    const teachersDone = teacherCount > 0;
    const loadDone = assignmentCount > 0;
    const activationDone = year?.status === 'ACTIVE';

    // 4. Construcción de pasos.
    const steps: CanonicalStep[] = [];

    // ── Paso 1: SIEE ────────────────────────────────────────────────────────
    steps.push({
      key: 'siee-config',
      label: 'Configuración SIEE',
      status: sieeDone ? 'done' : 'available',
      blockedBy: [],
      summary: [],
      issues: sieeDone
        ? []
        : completeness.missing.map((m) => ({
            severity: 'warning' as const,
            code: `SIEE_MISSING_${m.toUpperCase()}`,
            message: `Falta configurar: ${m}`,
            howToFix: 'Aplica la plantilla MEN o completa la configuración manualmente.',
          })),
      actions: sieeDone
        ? [action('view', 'Ver configuración', { kind: 'navigate', path: '/setup' }, 'secondary')]
        : [
            action(
              'apply_base',
              'Aplicar plantilla MEN',
              { kind: 'submit', method: 'POST', path: '/institution-config/apply-base' },
              'primary',
            ),
          ],
    });

    // ── Paso 2: Año lectivo ──────────────────────────────────────────────────
    steps.push({
      key: 'academic-year',
      label: 'Año lectivo',
      status: statusFor(yearDone, [{ done: sieeDone, key: 'siee-config', label: 'la configuración SIEE' }]),
      blockedBy: blockersOf(yearDone, [{ done: sieeDone, key: 'siee-config', label: 'Configura el SIEE base primero' }]),
      summary: year
        ? [
            { key: 'year', label: 'Año', value: String(year.year) },
            { key: 'periods', label: 'Períodos', value: String(periodCount) },
          ]
        : [],
      issues: [],
      actions: yearDone
        ? [action('view', 'Ver año lectivo', { kind: 'navigate', path: '/academic-years' }, 'secondary')]
        : [
            {
              type: 'create_year',
              label: 'Crear año lectivo',
              enabled: sieeDone,
              reason: sieeDone ? undefined : 'Configura el SIEE base primero',
              variant: 'primary',
              requiresConfirmation: false,
              intent: { kind: 'navigate', path: '/academic-years' },
            },
          ],
    });

    // ── Paso 3: Estudiantes ──────────────────────────────────────────────────
    {
      const deps = [
        { done: sieeDone, key: 'siee-config', label: 'Configura el SIEE base primero' },
        { done: yearDone, key: 'academic-year', label: 'Crea el año lectivo primero' },
      ];
      const canRun = deps.every((d) => d.done);
      steps.push({
        key: 'students-import',
        label: 'Estudiantes',
        status: statusFor(studentsDone, deps.map((d) => ({ done: d.done, key: d.key, label: d.label }))),
        blockedBy: blockersOf(studentsDone, deps),
        summary: studentsDone
          ? [
              { key: 'students', label: 'Estudiantes matriculados', value: nf.format(enrollmentCount) },
              { key: 'grades', label: 'Grados', value: String(gradeCount) },
              { key: 'groups', label: 'Grupos', value: String(groupCount) },
              { key: 'campuses', label: 'Sedes', value: String(campusCount) },
              { key: 'shifts', label: 'Jornadas', value: String(shiftCount) },
            ]
          : [],
        issues: [],
        actions: [
          {
            type: 'analyze',
            label: studentsDone ? 'Actualizar estudiantes' : 'Subir Excel de estudiantes',
            enabled: canRun,
            reason: canRun ? undefined : 'Completa la configuración SIEE y el año lectivo',
            variant: 'primary',
            requiresConfirmation: false,
            intent: { kind: 'upload', path: '/onboarding/students/analyze' },
          },
        ],
      });
    }

    // ── Paso 4: Docentes (backend Módulo 4 pendiente) ────────────────────────
    steps.push({
      key: 'teachers-import',
      label: 'Docentes',
      status: statusFor(teachersDone, [{ done: yearDone, key: 'academic-year', label: 'el año lectivo' }]),
      blockedBy: blockersOf(teachersDone, [{ done: yearDone, key: 'academic-year', label: 'Crea el año lectivo primero' }]),
      summary: teachersDone ? [{ key: 'teachers', label: 'Docentes', value: nf.format(teacherCount) }] : [],
      issues: [],
      actions: [
        {
          type: 'analyze',
          label: teachersDone ? 'Actualizar docentes' : 'Subir Excel de docentes',
          enabled: yearDone,
          reason: yearDone ? undefined : 'Crea el año lectivo primero',
          variant: 'primary',
          requiresConfirmation: false,
          intent: { kind: 'upload', path: '/onboarding/teachers/analyze' },
        },
      ],
    });

    // ── Paso 5: Carga académica (backend Módulo 5 pendiente) ──────────────────
    {
      const deps = [
        { done: teachersDone, key: 'teachers-import', label: 'Importa los docentes primero' },
        { done: studentsDone, key: 'students-import', label: 'Importa los estudiantes primero' },
      ];
      steps.push({
        key: 'academic-load',
        label: 'Carga académica',
        status: statusFor(loadDone, deps),
        blockedBy: blockersOf(loadDone, deps),
        summary: loadDone ? [{ key: 'assignments', label: 'Asignaciones', value: nf.format(assignmentCount) }] : [],
        issues: [],
        actions: [
          {
            type: 'analyze',
            label: loadDone ? 'Actualizar carga académica' : 'Subir Excel de carga académica',
            enabled: teachersDone && studentsDone,
            reason: teachersDone && studentsDone ? undefined : 'Importa docentes y estudiantes primero',
            variant: 'primary',
            requiresConfirmation: false,
            intent: { kind: 'upload', path: '/onboarding/academic-load/analyze' },
          },
        ],
      });
    }

    // ── Paso 6: Activación del año ────────────────────────────────────────────
    // Honestidad de la interfaz (UX11): el estado NO ofrece activar si el backend
    // lo rechazaría. Reusa validateYearForActivation (AR3) para reflejar la verdad.
    {
      let activationStatus: StepStatus;
      let activationBlockedBy: { key: string; message: string }[] = [];
      let activationIssues: Issue[] = [];
      let activationEnabled = false;
      let activationReason: string | undefined;

      if (activationDone) {
        activationStatus = 'done';
      } else if (!studentsDone) {
        activationStatus = 'locked';
        activationBlockedBy = [{ key: 'students-import', message: 'Completa la importación de estudiantes' }];
        activationReason = 'Completa la importación de estudiantes';
      } else if (year) {
        // Estudiantes listos y año en DRAFT: preguntar al backend si de verdad se puede activar.
        const val = await this.yearLifecycle.validateYearForActivation(year.id);
        activationIssues = [
          ...val.errors.map((e): Issue => ({
            severity: 'blocking',
            code: 'ACTIVATION_REQUIREMENT',
            message: e,
            howToFix: 'Corrige este requisito antes de activar el año.',
          })),
          ...val.warnings.map((w): Issue => ({
            severity: 'warning',
            code: 'ACTIVATION_WARNING',
            message: w,
          })),
        ];
        if (val.errors.length === 0) {
          activationStatus = 'available';
          activationEnabled = true;
        } else {
          activationStatus = 'locked';
          activationBlockedBy = val.errors.map((e, i) => ({ key: `activation-req-${i}`, message: e }));
          activationReason = val.errors[0];
        }
      } else {
        activationStatus = 'locked';
        activationReason = 'Crea el año lectivo primero';
      }

      steps.push({
        key: 'activation',
        label: 'Activación del año',
        status: activationStatus,
        blockedBy: activationBlockedBy,
        summary: activationDone && year ? [{ key: 'status', label: 'Estado', value: 'Activo' }] : [],
        issues: activationIssues,
        actions: [
          {
            type: 'activate',
            label: year ? `Activar año lectivo ${year.year}` : 'Activar año lectivo',
            enabled: activationEnabled,
            reason: activationReason,
            variant: 'destructive',
            requiresConfirmation: true,
            // #3: sin año no hay id → evitar '//'. La acción va deshabilitada igual.
            intent: {
              kind: 'submit',
              method: 'POST',
              path: year ? `/academic-years/${year.id}/activate` : '/academic-years/activate',
            },
          },
        ],
      });
    }

    // 5. Derivados: progreso ponderado + siguiente sugerido (E1/E3).
    const progress = steps.reduce(
      (sum, s) => (s.status === 'done' ? sum + (STEP_WEIGHTS[s.key] ?? 0) : sum),
      0,
    );
    const recommendedNext = steps.find((s) => s.status === 'available')?.key;

    return {
      kind: 'onboarding',
      contractVersion: 1,
      progress: Math.round(progress),
      ...(recommendedNext ? { recommendedNext } : {}),
      steps,
    };
  }
}

// ── Helpers puros ──────────────────────────────────────────────────────────

interface Dep {
  done: boolean;
  key: string;
  label: string;
}

/** done → 'done'; alguna dep sin cumplir → 'locked'; si no → 'available'. */
function statusFor(done: boolean, deps: Dep[]): StepStatus {
  if (done) return 'done';
  if (deps.some((d) => !d.done)) return 'locked';
  return 'available';
}

/** Lista de bloqueos (solo si el paso no está done y la dep no se cumple). */
function blockersOf(done: boolean, deps: Dep[]): { key: string; message: string }[] {
  if (done) return [];
  return deps.filter((d) => !d.done).map((d) => ({ key: d.key, message: d.label }));
}

function action(
  type: string,
  label: string,
  intent: Action['intent'],
  variant: Action['variant'],
): Action {
  return { type, label, enabled: true, variant, requiresConfirmation: false, intent };
}
