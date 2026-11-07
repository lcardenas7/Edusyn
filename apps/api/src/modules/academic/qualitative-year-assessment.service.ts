import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from './templates.service';
import { buildQualitativeCoverage } from '../achievements/qualitative-coverage';
import { evaluateQualitativePromotion, QualitativePromotionPolicy } from '../../engines/qualitative-promotion.engine';

@Injectable()
export class QualitativeYearAssessmentService {
  constructor(private readonly prisma: PrismaService, private readonly templates: TemplatesService) {}

  async assess(enrollmentId: string, institutionId: string, proposed?: { reportText: string; approvedById: string }) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { id: enrollmentId, institutionId }, include: { group: { include: { grade: true } } },
    });
    if (!enrollment) throw new NotFoundException('Matrícula no encontrada');
    if (proposed && enrollment.status !== 'ACTIVE') throw new BadRequestException('Solo se confirma una matrícula activa');
    if (enrollment.group.grade.academicStructure && enrollment.group.grade.academicStructure !== 'DIMENSIONS')
      throw new BadRequestException('La matrícula no corresponde a un grado cualitativo por dimensiones');
    const year = await this.prisma.academicYear.findFirst({
      where: { id: enrollment.academicYearId, institutionId }, include: { terms: { where: { type: 'PERIOD' }, orderBy: { order: 'asc' } } },
    });
    if (!year) throw new NotFoundException('Año lectivo no encontrado');
    const history = Array.isArray(year.qualitativePromotionPolicies) ? year.qualitativePromotionPolicies : [];
    const policyHistoryFingerprint = createHash('sha256').update(JSON.stringify(history)).digest('hex');
    const policy = history.filter((p: any) => p?.gradeId === enrollment.group.gradeId)
      .sort((a: any, b: any) => b.revision - a.revision)[0] as unknown as QualitativePromotionPolicy | undefined;
    const coordinates = { institutionId, academicYearId: year.id, gradeId: enrollment.group.gradeId, enrollmentId };
    if (!policy) return { ...evaluateQualitativePromotion({ ...coordinates, policy: null, periods: [], finalReportComplete: false }), academicYearId: year.id, evidenceFingerprint: null, policyHistoryFingerprint };
    const structure = await this.templates.getEffectiveStructureForGroupInScope(enrollment.groupId, year.id, institutionId);
    const dimensions = structure.areas.flatMap(area => area.templateSubjects)
      .filter(s => s.subject.subjectType === 'PRESCHOOL_DIMENSION');
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { institutionId, groupId: enrollment.groupId, academicYearId: year.id }, select: { id: true },
    });
    const coverage = await buildQualitativeCoverage(this.prisma, {
      institutionId, academicYearId: year.id, valuationScope: policy.valuationScope,
      terms: year.terms, teacherAssignmentIds: assignments.map(a => a.id),
      groups: [{ id: enrollment.groupId, gradeId: enrollment.group.gradeId,
        subjectIds: dimensions.map(d => d.subjectId), enrollmentIds: [enrollmentId] }],
    });
    const periods = year.terms.map(term => ({ id: term.id, name: term.name, dimensions: dimensions.map(dimension => {
        const key = `${enrollment.groupId}|${dimension.subjectId}|${term.id}`;
        return { id: dimension.subjectId, name: dimension.subject.name,
          expectedIds: [...(coverage.expectedByCell.get(key) ?? [])].sort(),
          valuedIds: [...(coverage.doneByCell.get(key)?.get(enrollmentId) ?? [])].sort() };
      }).sort((a, b) => a.id.localeCompare(b.id)) }));
    const evidenceFingerprint = createHash('sha256').update(JSON.stringify({ coordinates, policy, periods,
      valuations: coverage.valuationTokens.sort() })).digest('hex');
    const decisions = Array.isArray(year.qualitativePromotionDecisions) ? year.qualitativePromotionDecisions : [];
    const previous: any = [...decisions].reverse().find((d: any) => d?.enrollmentId === enrollmentId);
    const confirmationCurrent = !!previous && previous.evidenceFingerprint === evidenceFingerprint
      && previous.institutionId === institutionId && previous.academicYearId === year.id
      && previous.policyRevision === policy.revision && previous.outcome === 'CONTINUE' && !!previous.approvedById;
    const evidence: any = proposed ?? (confirmationCurrent ? previous : undefined);
    const result = evaluateQualitativePromotion({ ...coordinates, policy, periods,
      finalReportComplete: !!evidence?.reportText?.trim(),
      confirmation: evidence ? { enrollmentId, policyRevision: proposed ? policy.revision : evidence.policyRevision,
        approvedById: evidence.approvedById, outcome: 'CONTINUE' } : undefined,
    });
    return { ...result, academicYearId: year.id, evidenceFingerprint, policyHistoryFingerprint,
      periods, reportText: evidence?.reportText ?? '',
      confirmationCurrent,
      approvedAt: confirmationCurrent ? previous.approvedAt : null };
  }

  async confirm(enrollmentId: string, institutionId: string, actorId: string,
    input: { reportText: string; reason: string; expectedFingerprint: string }) {
    if (!actorId || typeof input?.reportText !== 'string' || typeof input.reason !== 'string'
      || !input.reason.trim() || typeof input.expectedFingerprint !== 'string' || !input.expectedFingerprint.trim())
      throw new BadRequestException('Indica informe, motivo y versión de la evaluación revisada');
    const assessment = await this.assess(enrollmentId, institutionId, { reportText: input.reportText, approvedById: actorId });
    if (assessment.evidenceFingerprint !== input.expectedFingerprint) throw new ConflictException('La evaluación cambió. Vuelve a revisarla');
    if (assessment.status !== 'CONTINUE') throw new BadRequestException({ message: 'Quedan requisitos pendientes', errors: assessment.reasons });
    return this.prisma.$transaction(async tx => {
      const year = await tx.academicYear.findFirst({ where: { id: assessment.academicYearId, institutionId } });
      if (!year) throw new NotFoundException('Año lectivo no encontrado');
      if (year.status !== 'ACTIVE') throw new BadRequestException('Solo se confirma en un año activo');
      const history = year.qualitativePromotionDecisions;
      if (!Array.isArray(history)) throw new ConflictException('Historial de decisiones inválido');
      const policies = year.qualitativePromotionPolicies;
      if (!Array.isArray(policies)) throw new ConflictException('Historial de políticas inválido');
      if (createHash('sha256').update(JSON.stringify(policies)).digest('hex') !== assessment.policyHistoryFingerprint)
        throw new ConflictException('La política cambió durante la confirmación. Vuelve a revisar la evaluación');
      const record = { enrollmentId, institutionId, academicYearId: year.id, policyRevision: assessment.policyRevision,
        evidenceFingerprint: assessment.evidenceFingerprint, reportText: input.reportText.trim(), reason: input.reason.trim(),
        approvedById: actorId, approvedAt: new Date().toISOString(), outcome: 'CONTINUE' };
      const saved = await tx.academicYear.updateMany({ where: { id: year.id, institutionId, status: 'ACTIVE',
        qualitativePromotionDecisions: { equals: history }, qualitativePromotionPolicies: { equals: policies } },
        data: { qualitativePromotionDecisions: [...history, record] } });
      if (saved.count !== 1) throw new ConflictException('El año cambió. Recarga antes de confirmar');
      return record;
    });
  }
}
