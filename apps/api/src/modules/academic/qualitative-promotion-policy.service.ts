import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { QualitativePromotionPolicy } from '../../engines/qualitative-promotion.engine';

export type QualitativePolicyInput = Pick<QualitativePromotionPolicy, 'valuationScope' | 'requireFinalReport' | 'decisionMode'> & {
  expectedRevision: number; reason: string;
};

@Injectable()
export class QualitativePromotionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async history(institutionId: string, yearId: string) {
    const year = await this.prisma.academicYear.findFirst({ where: { id: yearId, institutionId },
      select: { qualitativePromotionPolicies: true } });
    if (!year) throw new NotFoundException('Año lectivo no encontrado');
    return year.qualitativePromotionPolicies;
  }

  async revise(institutionId: string, yearId: string, gradeId: string, actorId: string, input: QualitativePolicyInput) {
    if (!actorId || !input || !['PURPOSE', 'EVIDENCE'].includes(input.valuationScope)
      || !['CONFIRMED', 'ON_COMPLETION'].includes(input.decisionMode)
      || typeof input.requireFinalReport !== 'boolean' || typeof input.reason !== 'string' || !input.reason.trim()
      || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
      throw new BadRequestException('Política incompleta: indica modalidad, requisitos, revisión esperada y motivo');
    }
    return this.prisma.$transaction(async tx => {
      const year = await tx.academicYear.findFirst({ where: { id: yearId, institutionId } });
      if (!year) throw new NotFoundException('Año lectivo no encontrado');
      if (year.status === 'CLOSED') throw new BadRequestException('No se puede modificar la política de un año cerrado');
      const grade = await tx.grade.findFirst({ where: { id: gradeId, institutionId }, select: { academicStructure: true } });
      if (!grade) throw new NotFoundException('Grado no encontrado');
      if (grade.academicStructure !== 'DIMENSIONS') throw new BadRequestException('Esta política requiere un grado por dimensiones');
      const history = year.qualitativePromotionPolicies;
      if (!Array.isArray(history)) throw new ConflictException('Historial de políticas inválido');
      const currentRevision = Math.max(0, ...history.filter((p: any) => p.gradeId === gradeId).map((p: any) => Number(p.revision)));
      if (currentRevision !== input.expectedRevision) throw new ConflictException('La política cambió. Recarga antes de guardar');
      const policy = { institutionId, academicYearId: yearId, gradeId, revision: currentRevision + 1,
        mode: 'QUALITATIVE_CONTINUITY' as const, valuationScope: input.valuationScope,
        requireFinalReport: input.requireFinalReport, decisionMode: input.decisionMode,
        approvedById: actorId, approvedAt: new Date().toISOString(), reason: input.reason.trim() };
      const saved = await tx.academicYear.updateMany({
        where: { id: yearId, institutionId, status: { not: 'CLOSED' }, qualitativePromotionPolicies: { equals: history } },
        data: { qualitativePromotionPolicies: [...history, policy] },
      });
      if (saved.count !== 1) throw new ConflictException('El año o sus políticas cambiaron. Recarga antes de guardar');
      return policy;
    });
  }
}
