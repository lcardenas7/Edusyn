/**
 * ACADEMIC DATA SOURCE SERVICE
 *
 * Motor único centralizado para resolver la fuente de datos académicos.
 *
 * REGLA DE ORO:
 *   FINALIZED + snapshot → snapshot es la ÚNICA verdad (sin comparar, sin fallback)
 *   FINALIZED + NO snapshot → error explícito (ConflictException)
 *   OPEN / CLOSED → datos live (PeriodFinalGrade / buildGroupReportCards)
 *
 * Todos los endpoints de reporte DEBEN pasar por este servicio.
 * Ningún endpoint debe consultar PeriodFinalGrade ni buildGroupReportCards directamente.
 */

import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════════════════

export interface AcademicDataMeta {
  source: 'live' | 'snapshot';
  termStatus: 'OPEN' | 'CLOSED' | 'FINALIZED';
  snapshotVersion: number | null;
  generatedAt: string; // ISO timestamp
  wasReopened: boolean; // true si el término fue reabierto alguna vez
}

/** Resultado de getGroupReportCardData — boletines completos de un grupo */
export interface GroupReportCardResult {
  meta: AcademicDataMeta;
  data: any; // Mismo DTO que retorna buildGroupReportCards
}

/** Resultado de getStudentReportCardData — boletín individual */
export interface StudentReportCardResult {
  meta: AcademicDataMeta;
  data: any; // Mismo DTO que retorna getReportCardData
}

/** Una fila de nota final para reportes analíticos (subject averages, ranking, etc.) */
export interface GradeRow {
  studentEnrollmentId: string;
  studentFirstName: string;
  studentLastName: string;
  groupId: string;
  groupName: string;
  gradeName: string;
  academicTermId: string;
  termName: string;
  termWeight: number;
  termOrder: number;
  subjectId: string;
  subjectName: string;
  areaId: string | null;
  areaName: string | null;
  finalScore: number;
}

/** Resultado de getTermGradeData — notas planas para reportes analíticos */
export interface TermGradeDataResult {
  meta: AcademicDataMeta;
  grades: GradeRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class AcademicDataSourceService {
  private readonly logger = new Logger(AcademicDataSourceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 1. BOLETINES — Datos completos de grupo (para vista de boletines y PDFs)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve datos de boletines para un grupo completo.
   * Si FINALIZED → retorna snapshots congelados.
   * Si OPEN/CLOSED → delega a buildGroupReportCards (inyectado como callback).
   */
  async getGroupReportCardData(
    groupId: string,
    academicTermId: string,
    buildLiveFn: (groupId: string, termId: string) => Promise<any>,
  ): Promise<GroupReportCardResult> {
    const termInfo = await this.resolveTermInfo(academicTermId);

    if (termInfo.status === 'FINALIZED') {
      const { snapshots, version } = await this.loadSnapshotsForTerm(academicTermId);

      // Filtrar snapshots del grupo solicitado
      const groupSnapshots = new Map<string, any>();
      for (const [enrollmentId, snapshotData] of snapshots) {
        if (snapshotData?.group?.id === groupId) {
          groupSnapshots.set(enrollmentId, snapshotData);
        }
      }

      if (groupSnapshots.size === 0) {
        this.logger.error(
          `[INTEGRITY] FINALIZED term ${academicTermId} has NO snapshots for group ${groupId}. ` +
          'This indicates data corruption — a finalized term must always have snapshots.',
        );
        throw new ConflictException(
          `Período finalizado pero no se encontraron snapshots para el grupo ${groupId}. ` +
          'Posible causa: el grupo fue creado después de la finalización. ' +
          'Reabra el período y vuelva a finalizar.',
        );
      }

      this.logger.log(
        `Snapshot v${version} used for group ${groupId}, term ${academicTermId} (${groupSnapshots.size} students)`,
      );

      // Reconstruir estructura compatible con buildGroupReportCards output
      const firstSnapshot = groupSnapshots.values().next().value;
      const reconstructed = {
        institution: firstSnapshot.institution,
        academicYear: firstSnapshot.academicYear,
        term: firstSnapshot.term,
        academicStructure: firstSnapshot.academicStructure,
        displayConfig: firstSnapshot.displayConfig,
        cards: Array.from(groupSnapshots.entries()).map(([enrollmentId, snap]) => ({
          enrollmentId,
          student: snap.student,
          group: snap.group,
          areaGrades: snap.areaGrades,
          subjectGrades: snap.subjectGrades,
          structureSource: snap.structureSource,
          attendance: snap.attendance,
          achievements: snap.achievements,
          observations: snap.observations,
          // Campos enriquecidos (Fase 0.2 — pueden no existir en snapshots viejos)
          rank: snap.rank ?? null,
          generalAverage: snap.generalAverage ?? null,
          promotionStatus: snap.promotionStatus ?? null,
          failedSubjectsCount: snap.failedSubjectsCount ?? null,
        })),
        generatedAt: firstSnapshot.generatedAt,
      };

      return {
        meta: this.buildMeta('snapshot', termInfo, version),
        data: reconstructed,
      };
    }

    // OPEN o CLOSED → datos en vivo
    const liveData = await buildLiveFn(groupId, academicTermId);

    return {
      meta: this.buildMeta('live', termInfo, null),
      data: liveData,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. BOLETÍN INDIVIDUAL — Datos de un solo estudiante
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Resuelve datos de boletín para un estudiante individual.
   * Si FINALIZED → retorna snapshot congelado.
   * Si OPEN/CLOSED → delega a buildLiveFn.
   */
  async getStudentReportCardData(
    studentEnrollmentId: string,
    academicTermId: string,
    buildLiveFn: (enrollmentId: string, termId: string) => Promise<any>,
  ): Promise<StudentReportCardResult> {
    const termInfo = await this.resolveTermInfo(academicTermId);

    if (termInfo.status === 'FINALIZED') {
      const { snapshot, version } = await this.loadSnapshotForStudent(
        academicTermId,
        studentEnrollmentId,
      );

      if (!snapshot) {
        this.logger.error(
          `[INTEGRITY] FINALIZED term ${academicTermId} has NO snapshot for student ${studentEnrollmentId}. ` +
          'This indicates data corruption — a finalized term must always have snapshots for all enrolled students.',
        );
        throw new ConflictException(
          'Período finalizado pero no se encontró snapshot para este estudiante. ' +
          'Posible causa: el estudiante fue matriculado después de la finalización. ' +
          'Reabra el período y vuelva a finalizar.',
        );
      }

      this.logger.log(
        `Snapshot v${version} used for student ${studentEnrollmentId}, term ${academicTermId}`,
      );

      return {
        meta: this.buildMeta('snapshot', termInfo, version),
        data: snapshot,
      };
    }

    // OPEN o CLOSED → datos en vivo
    const liveData = await buildLiveFn(studentEnrollmentId, academicTermId);

    return {
      meta: this.buildMeta('live', termInfo, null),
      data: liveData,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. NOTAS PLANAS — Para reportes analíticos (ranking, promedios, etc.)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Retorna notas planas (GradeRow[]) para reportes analíticos.
   *
   * Si TODOS los términos consultados están FINALIZED → extrae notas del snapshot.
   * Si alguno está OPEN/CLOSED → consulta PeriodFinalGrade live.
   * Si se consulta sin termId (todo el año) → mezcla según estado de cada término.
   */
  async getTermGradeData(params: {
    institutionId: string;
    academicYearId: string;
    groupId?: string;
    termId?: string;
    subjectId?: string;
    stage?: string;
  }): Promise<TermGradeDataResult> {
    // Si hay termId específico, resolver directamente
    if (params.termId) {
      return this.resolveGradeDataForTerm(params, params.termId);
    }

    // Sin termId → consultar todos los términos del año
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId: params.academicYearId },
      select: { id: true, name: true, status: true, weightPercentage: true, order: true },
      orderBy: { order: 'asc' },
    });

    if (terms.length === 0) {
      return {
        meta: {
          source: 'live',
          termStatus: 'OPEN',
          snapshotVersion: null,
          generatedAt: new Date().toISOString(),
          wasReopened: false,
        },
        grades: [],
      };
    }

    // Verificar si TODOS están finalized
    const allFinalized = terms.every(t => t.status === 'FINALIZED');
    const anyFinalized = terms.some(t => t.status === 'FINALIZED');

    if (allFinalized) {
      // Todos finalized → extraer de snapshots
      const allGrades: GradeRow[] = [];
      let lastVersion: number | null = null;

      for (const term of terms) {
        const result = await this.resolveGradeDataForTerm(params, term.id);
        allGrades.push(...result.grades);
        if (result.meta.snapshotVersion !== null) {
          lastVersion = result.meta.snapshotVersion;
        }
      }

      return {
        meta: {
          source: 'snapshot',
          termStatus: 'FINALIZED',
          snapshotVersion: lastVersion,
          generatedAt: new Date().toISOString(),
          wasReopened: false,
        },
        grades: allGrades,
      };
    }

    // Mezcla de estados → usar live para todo (consistencia)
    // No mezclamos snapshot + live para evitar inconsistencias entre términos
    const liveGrades = await this.loadLiveGradeData(params);

    // Determinar el estado "peor" para el meta
    const worstStatus = terms.some(t => t.status === 'OPEN') ? 'OPEN' : 'CLOSED';

    return {
      meta: {
        source: anyFinalized ? 'live' : 'live', // Siempre live si hay mezcla
        termStatus: worstStatus as any,
        snapshotVersion: null,
        generatedAt: new Date().toISOString(),
        wasReopened: false,
      },
      grades: liveGrades,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS INTERNOS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resuelve info del término: status, si fue reabierto, versión de snapshot.
   */
  private async resolveTermInfo(academicTermId: string): Promise<{
    id: string;
    status: string;
    wasReopened: boolean;
  }> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { id: true, status: true },
    });

    if (!term) throw new NotFoundException('Período académico no encontrado');

    // Verificar si fue reabierto alguna vez
    const reopeningCount = await this.prisma.termReopeningRecord.count({
      where: { academicTermId },
    });

    if (term.status === 'OPEN' && reopeningCount > 0) {
      console.warn(
        `[AcademicDataSource] Term ${academicTermId} was reopened (${reopeningCount} times). Serving live data.`,
      );
    }

    return {
      id: term.id,
      status: term.status,
      wasReopened: reopeningCount > 0,
    };
  }

  /**
   * Carga snapshot individual de un estudiante para un período.
   */
  private async loadSnapshotForStudent(
    academicTermId: string,
    studentEnrollmentId: string,
  ): Promise<{ snapshot: any | null; version: number | null }> {
    const record = await this.prisma.termReportCardSnapshot.findFirst({
      where: { academicTermId, studentEnrollmentId },
      orderBy: { version: 'desc' },
      select: { data: true, version: true },
    });

    return {
      snapshot: record?.data ?? null,
      version: record?.version ?? null,
    };
  }

  /**
   * Carga todos los snapshots más recientes de un período.
   */
  private async loadSnapshotsForTerm(
    academicTermId: string,
  ): Promise<{ snapshots: Map<string, any>; version: number | null }> {
    const lastVersion = await this.prisma.termReportCardSnapshot.aggregate({
      where: { academicTermId },
      _max: { version: true },
    });

    const version = lastVersion._max.version ?? null;
    if (version === null) {
      return { snapshots: new Map(), version: null };
    }

    const records = await this.prisma.termReportCardSnapshot.findMany({
      where: { academicTermId, version },
      select: { studentEnrollmentId: true, data: true },
    });

    const map = new Map<string, any>();
    for (const r of records) {
      map.set(r.studentEnrollmentId, r.data);
    }

    return { snapshots: map, version };
  }

  /**
   * Resuelve notas planas para un término específico.
   * FINALIZED → extrae del snapshot. OPEN/CLOSED → PeriodFinalGrade live.
   */
  private async resolveGradeDataForTerm(
    params: {
      institutionId: string;
      academicYearId: string;
      groupId?: string;
      subjectId?: string;
      stage?: string;
    },
    termId: string,
  ): Promise<TermGradeDataResult> {
    const termInfo = await this.resolveTermInfo(termId);

    if (termInfo.status === 'FINALIZED') {
      const { snapshots, version } = await this.loadSnapshotsForTerm(termId);

      if (snapshots.size === 0) {
        this.logger.error(
          `[INTEGRITY] FINALIZED term ${termId} has ZERO snapshots. ` +
          'This is a critical integrity violation — the term was finalized without generating snapshots.',
        );
        throw new ConflictException(
          `Período ${termId} está finalizado pero no tiene snapshots. ` +
          'Reabra el período y vuelva a finalizar.',
        );
      }

      this.logger.log(
        `Snapshot v${version} used for analytical grades, term ${termId} (${snapshots.size} students)`,
      );

      // Extraer notas planas del snapshot
      const grades = this.extractGradeRowsFromSnapshots(snapshots, termId, params);

      return {
        meta: this.buildMeta('snapshot', termInfo, version),
        grades,
      };
    }

    // OPEN o CLOSED → live
    const liveGrades = await this.loadLiveGradeData({ ...params, termId });

    return {
      meta: this.buildMeta('live', termInfo, null),
      grades: liveGrades,
    };
  }

  /**
   * Extrae GradeRow[] desde snapshots congelados.
   * Aplica filtros opcionales (groupId, subjectId, stage).
   */
  private extractGradeRowsFromSnapshots(
    snapshots: Map<string, any>,
    termId: string,
    filters: {
      groupId?: string;
      subjectId?: string;
      stage?: string;
    },
  ): GradeRow[] {
    const rows: GradeRow[] = [];

    for (const [enrollmentId, snap] of snapshots) {
      // Filtro por grupo
      if (filters.groupId && snap.group?.id !== filters.groupId) continue;

      // Filtro por stage (si el snapshot tiene info de grado)
      // stage no está directamente en el snapshot, pero podemos inferirlo del grupo
      // Por ahora, si se filtra por stage y no hay info, incluimos todo

      const termName = snap.term?.name ?? '';
      const termData = snap.term ?? {};

      // Extraer notas de subjectGrades (lista plana de asignaturas)
      const subjectGrades: any[] = snap.subjectGrades || [];
      for (const sg of subjectGrades) {
        if (sg.grade === null || sg.grade === undefined) continue;

        // Filtro por asignatura
        if (filters.subjectId && sg.subjectId !== filters.subjectId) continue;

        rows.push({
          studentEnrollmentId: enrollmentId,
          studentFirstName: snap.student?.firstName ?? '',
          studentLastName: snap.student?.lastName ?? '',
          groupId: snap.group?.id ?? '',
          groupName: `${snap.group?.gradeLevel ?? ''} ${snap.group?.name ?? ''}`.trim(),
          gradeName: snap.group?.gradeLevel ?? '',
          academicTermId: termId,
          termName,
          termWeight: termData.weightPercentage ?? 0,
          termOrder: termData.order ?? 0,
          subjectId: sg.subjectId ?? '',
          subjectName: sg.subject ?? '',
          areaId: sg.areaId ?? null,
          areaName: sg.areaName ?? null,
          finalScore: Number(sg.grade),
        });
      }
    }

    return rows;
  }

  /**
   * Carga notas live desde PeriodFinalGrade (misma lógica que getBaseGradeData).
   */
  private async loadLiveGradeData(params: {
    institutionId: string;
    academicYearId: string;
    groupId?: string;
    termId?: string;
    subjectId?: string;
    stage?: string;
  }): Promise<GradeRow[]> {
    const records = await this.prisma.periodFinalGrade.findMany({
      where: {
        institutionId: params.institutionId,
        academicTerm: {
          academicYearId: params.academicYearId,
          ...(params.termId && { id: params.termId }),
        },
        studentEnrollment: {
          status: 'ACTIVE',
          ...(params.groupId && { groupId: params.groupId }),
          ...(params.stage && { group: { grade: { stage: params.stage as any } } }),
        },
        ...(params.subjectId && { subjectId: params.subjectId }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            group: { include: { grade: true } },
          },
        },
        academicTerm: { select: { id: true, name: true, weightPercentage: true, order: true } },
        subject: { include: { area: { select: { id: true, name: true } } } },
      },
      orderBy: { studentEnrollment: { student: { lastName: 'asc' } } },
    });

    return records.map(r => ({
      studentEnrollmentId: r.studentEnrollmentId,
      studentFirstName: r.studentEnrollment.student.firstName,
      studentLastName: r.studentEnrollment.student.lastName,
      groupId: r.studentEnrollment.groupId,
      groupName: `${r.studentEnrollment.group.grade?.name ?? ''} ${r.studentEnrollment.group.name}`.trim(),
      gradeName: r.studentEnrollment.group.grade?.name ?? '',
      academicTermId: r.academicTermId,
      termName: r.academicTerm.name,
      termWeight: r.academicTerm.weightPercentage ?? 0,
      termOrder: r.academicTerm.order ?? 0,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      areaId: r.subject.area?.id ?? null,
      areaName: r.subject.area?.name ?? null,
      finalScore: Number(r.finalScore),
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VISIÓN FUTURA (no implementado)
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Actualmente los snapshots son estudiante-céntricos (un registro por estudiante).
  // Las estadísticas institucionales/grupales se recalculan desde datos base.
  //
  // A mediano-largo plazo (3-5 años) considerar:
  //   - SnapshotGroupStats: promedio grupo, distribución, tasa aprobación congelados
  //   - SnapshotInstitutionStats: estadísticas agregadas por año/nivel
  //
  // Esto evitaría recalcular estadísticas históricas y permitiría dashboards
  // institucionales instantáneos sobre datos de años anteriores.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Construye el objeto meta estándar.
   */
  private buildMeta(
    source: 'live' | 'snapshot',
    termInfo: { status: string; wasReopened: boolean },
    snapshotVersion: number | null,
  ): AcademicDataMeta {
    return {
      source,
      termStatus: termInfo.status as AcademicDataMeta['termStatus'],
      snapshotVersion,
      generatedAt: new Date().toISOString(),
      wasReopened: termInfo.wasReopened,
    };
  }
}
