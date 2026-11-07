import { PrismaService } from '../../prisma/prisma.service';
import { isEvidenceVigente, collectRetirementTermIds, RetirableEvidence } from './evidence-vigencia.util';

export type QualitativeCoverageParams = {
    valuationScope?: 'PURPOSE' | 'EVIDENCE';
    institutionId: string;
    academicYearId: string;
    terms: Array<{ id: string; order: number }>;
    teacherAssignmentIds: string[];
    groups: Array<{ id: string; gradeId: string | null; subjectIds: string[]; enrollmentIds: string[] }>;
  };

async function resolveRetirementTermOrders(prisma: PrismaService, institutionId: string, academicYearId: string, evidences: RetirableEvidence[]) {
  const ids = collectRetirementTermIds(evidences);
  if (!ids.length) return new Map<string, number>();
  const terms = await prisma.academicTerm.findMany({
    where: { id: { in: ids }, academicYearId, academicYear: { institutionId } }, select: { id: true, order: true },
  });
  return new Map(terms.map(t => [t.id, t.order]));
}

/** Shared catalog coverage. Zero obligations preserves legacy report behavior;
 * annual promotion must explicitly reject unconfigured cells using expectedByCell.
 */
export async function buildQualitativeCoverage(prisma: PrismaService, params: QualitativeCoverageParams) {
    const valuationTokens: string[] = [];
    const index = new Map<string, Set<string>>();
    const { institutionId, academicYearId, terms, groups } = params;
    if (groups.length === 0 || terms.length === 0) return { index, valuationTokens, expectedByCell: new Map<string, Set<string>>(), doneByCell: new Map<string, Map<string, Set<string>>>() };

    const termIds = terms.map(t => t.id);
    const gradeIds = [...new Set(groups.map(g => g.gradeId).filter((id): id is string => !!id))];
    const enrollmentIds = groups.flatMap(g => g.enrollmentIds);
    const groupOfEnrollment = new Map<string, string>();
    for (const g of groups) for (const e of g.enrollmentIds) groupOfEnrollment.set(e, g.id);

    const achConfig = await prisma.achievementConfig.findUnique({
      where: { institutionId },
      select: { valuationScope: true },
    });
    const evidenceMode = (params.valuationScope ?? achConfig?.valuationScope ?? 'PURPOSE') === 'EVIDENCE';

    // Catálogo esperado: propósitos por-asignación (flujo tradicional) + catálogo
    // compartido por grado. Mismo criterio que `getAchievementsByAssignment`.
    const expectedAchievements = await prisma.achievement.findMany({
      where: {
        institutionId,
        isPromotional: false,
        OR: [
          { teacherAssignmentId: { in: params.teacherAssignmentIds }, academicTermId: { in: termIds } },
          {
            teacherAssignmentId: null,
            gradeId: { in: gradeIds },
            academicYearId,
            OR: [{ academicTermId: { in: termIds } }, { academicTermId: null }],
          },
        ],
      },
      select: {
        id: true,
        gradeId: true,
        subjectId: true,
        academicTermId: true,
        teacherAssignment: { select: { subjectId: true, groupId: true } },
        evidences: { select: { id: true, retiredFromTermId: true } },
      },
    });

    const subjectOf = (a: (typeof expectedAchievements)[0]) => a.subjectId ?? a.teacherAssignment?.subjectId ?? null;

    // Órdenes de período: los consultados MÁS los de retiro. Sin estos últimos, validar
    // un solo período dejaría a `isEvidenceVigente` sin el orden del término de retiro,
    // fallando ABIERTO y manteniendo como obligación una evidencia ya retirada.
    const termOrderById = new Map(terms.map(t => [t.id, t.order]));
    const ordenesDeRetiro = await resolveRetirementTermOrders(prisma, institutionId, academicYearId,
      expectedAchievements.flatMap(a => a.evidences),
    );
    for (const [id, order] of ordenesDeRetiro) if (!termOrderById.has(id)) termOrderById.set(id, order);

    // Obligaciones esperadas por "groupId|subjectId|termId".
    const expectedByCell = new Map<string, Set<string>>();
    for (const group of groups) {
      for (const term of terms) {
        for (const a of expectedAchievements) {
          if (a.gradeId && a.gradeId !== group.gradeId) continue;
          if (a.teacherAssignment?.groupId && a.teacherAssignment.groupId !== group.id) continue;
          // Un propósito por-período sólo aplica a SU período; uno anual, a todos.
          if (a.academicTermId && a.academicTermId !== term.id) continue;
          const subjectId = subjectOf(a);
          if (!subjectId) continue;
          const key = `${group.id}|${subjectId}|${term.id}`;
          if (!expectedByCell.has(key)) expectedByCell.set(key, new Set());
          const bucket = expectedByCell.get(key)!;
          if (evidenceMode) {
            // D-12: sólo las evidencias VIGENTES en ese período son obligación.
            for (const ev of a.evidences) {
              if (isEvidenceVigente(ev, termOrderById.get(term.id), termOrderById)) bucket.add(ev.id);
            }
          } else {
            bucket.add(a.id);
          }
        }
      }
    }

    // Valoraciones registradas, según el modo configurado.
    const doneByCell = new Map<string, Map<string, Set<string>>>();
    const addDone = (cellKey: string, enrollmentId: string, obligationId: string) => {
      if (!doneByCell.has(cellKey)) doneByCell.set(cellKey, new Map());
      const perEnrollment = doneByCell.get(cellKey)!;
      if (!perEnrollment.has(enrollmentId)) perEnrollment.set(enrollmentId, new Set());
      perEnrollment.get(enrollmentId)!.add(obligationId);
    };

    if (evidenceMode) {
      const evidenceToSubject = new Map<string, string>();
      for (const a of expectedAchievements) {
        const subjectId = subjectOf(a);
        if (!subjectId) continue;
        for (const ev of a.evidences) evidenceToSubject.set(ev.id, subjectId);
      }
      const valuations = await prisma.studentEvidenceValuation.findMany({
        where: {
          studentEnrollmentId: { in: enrollmentIds },
          academicTermId: { in: termIds },
          achievementEvidenceId: { in: [...evidenceToSubject.keys()] },
        },
        select: { studentEnrollmentId: true, achievementEvidenceId: true, academicTermId: true, performanceLevel: true, updatedAt: true },
      });
      for (const v of valuations) {
        valuationTokens.push(JSON.stringify(v));
        const subjectId = evidenceToSubject.get(v.achievementEvidenceId);
        const groupId = groupOfEnrollment.get(v.studentEnrollmentId);
        if (!subjectId || !groupId) continue;
        addDone(`${groupId}|${subjectId}|${v.academicTermId}`, v.studentEnrollmentId, v.achievementEvidenceId);
      }
    } else {
      const achievementToSubject = new Map<string, string>();
      for (const a of expectedAchievements) {
        const subjectId = subjectOf(a);
        if (subjectId) achievementToSubject.set(a.id, subjectId);
      }
      const valuations = await prisma.studentAchievement.findMany({
        where: {
          studentEnrollmentId: { in: enrollmentIds },
          academicTermId: { in: termIds },
          achievementId: { in: [...achievementToSubject.keys()] },
        },
        select: { studentEnrollmentId: true, achievementId: true, academicTermId: true, performanceLevel: true, updatedAt: true },
      });
      for (const v of valuations) {
        valuationTokens.push(JSON.stringify(v));
        const subjectId = achievementToSubject.get(v.achievementId);
        const groupId = groupOfEnrollment.get(v.studentEnrollmentId);
        if (!subjectId || !groupId) continue;
        addDone(`${groupId}|${subjectId}|${v.academicTermId}`, v.studentEnrollmentId, v.achievementId);
      }
    }

    // Un estudiante está diligenciado en la celda cuando cubrió TODAS sus obligaciones.
    for (const group of groups) {
      for (const subjectId of group.subjectIds) {
        for (const term of terms) {
          const key = `${group.id}|${subjectId}|${term.id}`;
          const expected = expectedByCell.get(key);
          const done = doneByCell.get(key);
          const complete = new Set<string>();
          for (const enrollmentId of group.enrollmentIds) {
            if (!expected || expected.size === 0) {
              // Sin obligaciones configuradas no hay nada que exigir.
              complete.add(enrollmentId);
              continue;
            }
            const cubiertas = done?.get(enrollmentId);
            if (cubiertas && [...expected].every(id => cubiertas.has(id))) complete.add(enrollmentId);
          }
          index.set(key, complete);
        }
      }
    }

    return { index, expectedByCell, doneByCell, valuationTokens };

}
