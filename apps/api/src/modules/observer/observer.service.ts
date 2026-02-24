import { Injectable, NotFoundException } from '@nestjs/common';
import { ObserverEntryStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateObservationDto,
  UpdateObservationDto,
  CreateActaDto,
  CreateCommitmentDto,
  UpdateCommitmentDto,
  CreateCitationDto,
  UpdateCitationDto,
  CreateReferralDto,
  UpdateReferralDto,
  CreateMeasureDto,
  UpdateMeasureDto,
} from './dto/create-observation.dto';

const observationFullInclude = {
  studentEnrollment: {
    include: {
      student: { select: { id: true, firstName: true, lastName: true, secondName: true, secondLastName: true, hasDiagnosis: true, diagnosisType: true, photo: true } },
      group: { select: { id: true, name: true } },
    },
  },
  author: { select: { id: true, firstName: true, lastName: true } },
  actaRecord: true,
  commitments: { include: { author: { select: { id: true, firstName: true, lastName: true } } } },
  citation: true,
  referral: { include: { referredToUser: { select: { id: true, firstName: true, lastName: true } } } },
  measures: true,
  evidences: true,
};

@Injectable()
export class ObserverService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // OBSERVACIONES (CRUD principal)
  // ═══════════════════════════════════════════════════════════════════════════

  async create(authorId: string, dto: CreateObservationDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.studentObservation.create({
      data: {
        institutionId: enr!.institutionId,
        studentEnrollmentId: dto.studentEnrollmentId,
        authorId,
        date: new Date(dto.date),
        type: dto.type,
        category: dto.category,
        description: dto.description,
        actionTaken: dto.actionTaken,
        requiresFollowUp: dto.requiresFollowUp ?? false,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
      },
      include: observationFullInclude,
    });
  }

  async update(id: string, dto: UpdateObservationDto) {
    const observation = await this.prisma.studentObservation.findUnique({ where: { id } });
    if (!observation) throw new NotFoundException('Observación no encontrada');

    return this.prisma.studentObservation.update({
      where: { id },
      data: {
        type: dto.type,
        category: dto.category,
        description: dto.description,
        actionTaken: dto.actionTaken,
        parentNotified: dto.parentNotified,
        parentNotifiedAt: dto.parentNotifiedAt ? new Date(dto.parentNotifiedAt) : undefined,
        requiresFollowUp: dto.requiresFollowUp,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        followUpNotes: dto.followUpNotes,
        status: dto.status as ObserverEntryStatus | undefined,
      },
      include: observationFullInclude,
    });
  }

  async delete(id: string) {
    const observation = await this.prisma.studentObservation.findUnique({ where: { id } });
    if (!observation) throw new NotFoundException('Observación no encontrada');
    return this.prisma.studentObservation.delete({ where: { id } });
  }

  async getByStudent(studentEnrollmentId: string, filters?: { startDate?: string; endDate?: string; type?: string; category?: string; status?: string }) {
    return this.prisma.studentObservation.findMany({
      where: {
        studentEnrollmentId,
        ...(filters?.startDate && filters?.endDate ? { date: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) } } : {}),
        ...(filters?.type ? { type: filters.type as any } : {}),
        ...(filters?.category ? { category: filters.category as any } : {}),
        ...(filters?.status ? { status: filters.status as ObserverEntryStatus } : {}),
      },
      include: observationFullInclude,
      orderBy: { date: 'desc' },
    });
  }

  async getById(id: string) {
    const observation = await this.prisma.studentObservation.findUnique({
      where: { id },
      include: observationFullInclude,
    });
    if (!observation) throw new NotFoundException('Observación no encontrada');
    return observation;
  }

  // Timeline completa del estudiante (todas las entradas de todos los tipos)
  async getStudentTimeline(studentEnrollmentId: string) {
    const [observations, commitments, citations, referrals, measures] = await Promise.all([
      this.prisma.studentObservation.findMany({
        where: { studentEnrollmentId },
        include: observationFullInclude,
        orderBy: { date: 'desc' },
      }),
      this.prisma.observerCommitment.findMany({
        where: { studentEnrollmentId },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guardianCitation.findMany({
        where: { studentEnrollmentId },
        include: { author: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { scheduledDate: 'desc' },
      }),
      this.prisma.observerReferral.findMany({
        where: { studentEnrollmentId },
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          referredToUser: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pedagogicalMeasure.findMany({
        where: { studentEnrollmentId },
        include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { observations, commitments, citations, referrals, measures };
  }

  async getPendingFollowUps(authorId?: string) {
    return this.prisma.studentObservation.findMany({
      where: {
        requiresFollowUp: true,
        status: { not: 'CLOSED' },
        ...(authorId ? { authorId } : {}),
      },
      include: observationFullInclude,
      orderBy: { followUpDate: 'asc' },
    });
  }

  async getStudentSummary(studentEnrollmentId: string) {
    const [observations, commitments, citations, referrals] = await Promise.all([
      this.prisma.studentObservation.findMany({ where: { studentEnrollmentId } }),
      this.prisma.observerCommitment.findMany({ where: { studentEnrollmentId } }),
      this.prisma.guardianCitation.findMany({ where: { studentEnrollmentId } }),
      this.prisma.observerReferral.findMany({ where: { studentEnrollmentId } }),
    ]);

    return {
      total: observations.length,
      byType: {
        positive: observations.filter((o) => o.type === 'POSITIVE').length,
        pedagogical: observations.filter((o) => o.type === 'PEDAGOGICAL').length,
        behavioralMild: observations.filter((o) => o.type === 'BEHAVIORAL_MILD').length,
        actaTypeI: observations.filter((o) => o.type === 'ACTA_TYPE_I').length,
        actaTypeII: observations.filter((o) => o.type === 'ACTA_TYPE_II').length,
        actaTypeIII: observations.filter((o) => o.type === 'ACTA_TYPE_III').length,
        commitment: observations.filter((o) => o.type === 'COMMITMENT').length,
        referral: observations.filter((o) => o.type === 'REFERRAL').length,
      },
      byCategory: {
        academic: observations.filter((o) => o.category === 'ACADEMIC').length,
        behavioral: observations.filter((o) => o.category === 'BEHAVIORAL').length,
        attendance: observations.filter((o) => o.category === 'ATTENDANCE').length,
        uniform: observations.filter((o) => o.category === 'UNIFORM').length,
        other: observations.filter((o) => o.category === 'OTHER').length,
      },
      byStatus: {
        open: observations.filter((o) => o.status === 'OPEN').length,
        inProgress: observations.filter((o) => o.status === 'IN_PROGRESS').length,
        closed: observations.filter((o) => o.status === 'CLOSED').length,
      },
      pendingFollowUps: observations.filter((o) => o.requiresFollowUp && o.status !== 'CLOSED').length,
      pendingCommitments: commitments.filter((c) => c.status !== 'CLOSED').length,
      upcomingCitations: citations.filter((c) => c.attended === null).length,
      pendingReferrals: referrals.filter((r) => r.status !== 'CLOSED').length,
    };
  }

  async markParentNotified(id: string) {
    return this.prisma.studentObservation.update({
      where: { id },
      data: { parentNotified: true, parentNotifiedAt: new Date() },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTAS FORMALES
  // ═══════════════════════════════════════════════════════════════════════════

  async createActa(dto: CreateActaDto) {
    return this.prisma.actaRecord.create({
      data: {
        observationId: dto.observationId,
        actaNumber: dto.actaNumber,
        actaType: dto.actaType,
        facts: dto.facts,
        regulationApplied: dto.regulationApplied,
        witnesses: dto.witnesses,
        studentStatement: dto.studentStatement,
        sanctions: dto.sanctions,
      },
      include: { observation: { include: { author: { select: { id: true, firstName: true, lastName: true } } } } },
    });
  }

  async updateActa(id: string, data: Partial<CreateActaDto> & { digitalSignatures?: string }) {
    return this.prisma.actaRecord.update({
      where: { id },
      data: {
        facts: data.facts,
        regulationApplied: data.regulationApplied,
        witnesses: data.witnesses,
        studentStatement: data.studentStatement,
        sanctions: data.sanctions,
        digitalSignatures: data.digitalSignatures,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPROMISOS
  // ═══════════════════════════════════════════════════════════════════════════

  async createCommitment(authorId: string, dto: CreateCommitmentDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.observerCommitment.create({
      data: {
        institutionId: enr!.institutionId,
        observationId: dto.observationId,
        studentEnrollmentId: dto.studentEnrollmentId,
        authorId,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        responsibleRole: dto.responsibleRole,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateCommitment(id: string, userId: string, dto: UpdateCommitmentDto) {
    const data: any = {};
    if (dto.status) {
      data.status = dto.status as ObserverEntryStatus;
      if (dto.status === 'CLOSED') {
        data.closedAt = new Date();
        data.closedById = userId;
      }
    }
    if (dto.closureEvidence) data.closureEvidence = dto.closureEvidence;

    return this.prisma.observerCommitment.update({
      where: { id },
      data,
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getCommitmentsByStudent(studentEnrollmentId: string) {
    return this.prisma.observerCommitment.findMany({
      where: { studentEnrollmentId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        closedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CITACIONES A ACUDIENTES
  // ═══════════════════════════════════════════════════════════════════════════

  async createCitation(authorId: string, dto: CreateCitationDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.guardianCitation.create({
      data: {
        institutionId: enr!.institutionId,
        observationId: dto.observationId,
        studentEnrollmentId: dto.studentEnrollmentId,
        authorId,
        reason: dto.reason,
        scheduledDate: new Date(dto.scheduledDate),
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateCitation(id: string, dto: UpdateCitationDto) {
    return this.prisma.guardianCitation.update({
      where: { id },
      data: {
        attended: dto.attended,
        agreements: dto.agreements,
        notes: dto.notes,
      },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getCitationsByStudent(studentEnrollmentId: string) {
    return this.prisma.guardianCitation.findMany({
      where: { studentEnrollmentId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMISIONES
  // ═══════════════════════════════════════════════════════════════════════════

  async createReferral(authorId: string, dto: CreateReferralDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.observerReferral.create({
      data: {
        institutionId: enr!.institutionId,
        observationId: dto.observationId,
        studentEnrollmentId: dto.studentEnrollmentId,
        authorId,
        referredToRole: dto.referredToRole,
        referredToUserId: dto.referredToUserId,
        reason: dto.reason,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        referredToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateReferral(id: string, userId: string, dto: UpdateReferralDto) {
    const data: any = {};
    if (dto.status) {
      data.status = dto.status as ObserverEntryStatus;
      if (dto.status === 'CLOSED') {
        data.respondedAt = new Date();
        data.respondedById = userId;
      }
    }
    if (dto.responseNotes) data.responseNotes = dto.responseNotes;

    return this.prisma.observerReferral.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        referredToUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async getReferralsByStudent(studentEnrollmentId: string) {
    return this.prisma.observerReferral.findMany({
      where: { studentEnrollmentId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        referredToUser: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIDAS PEDAGÓGICAS
  // ═══════════════════════════════════════════════════════════════════════════

  async createMeasure(userId: string, dto: CreateMeasureDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.pedagogicalMeasure.create({
      data: {
        institutionId: enr!.institutionId,
        observationId: dto.observationId,
        studentEnrollmentId: dto.studentEnrollmentId,
        measureType: dto.measureType,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        appliedById: userId,
      },
      include: { appliedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async updateMeasure(id: string, dto: UpdateMeasureDto) {
    const data: any = {};
    if (dto.status) data.status = dto.status as ObserverEntryStatus;
    if (dto.result) data.result = dto.result;
    return this.prisma.pedagogicalMeasure.update({ where: { id }, data });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BÚSQUEDA POR GRUPO (para coordinadores/docentes)
  // ═══════════════════════════════════════════════════════════════════════════

  async getByGroup(groupId: string, academicYearId: string, filters?: { type?: string; status?: string; authorId?: string }) {
    return this.prisma.studentObservation.findMany({
      where: {
        studentEnrollment: { groupId, academicYearId },
        ...(filters?.type ? { type: filters.type as any } : {}),
        ...(filters?.status ? { status: filters.status as ObserverEntryStatus } : {}),
        ...(filters?.authorId ? { authorId: filters.authorId } : {}),
      },
      include: observationFullInclude,
      orderBy: { date: 'desc' },
      take: 100,
    });
  }

  // Dashboard de alertas para coordinación
  async getDashboard(institutionId: string, academicYearId: string) {
    const [pendingCommitments, pendingReferrals, upcomingCitations, recentActas] = await Promise.all([
      this.prisma.observerCommitment.count({
        where: {
          status: { not: 'CLOSED' },
          studentEnrollment: { academicYearId, group: { campus: { institutionId } } },
        },
      }),
      this.prisma.observerReferral.count({
        where: {
          status: { not: 'CLOSED' },
          studentEnrollment: { academicYearId, group: { campus: { institutionId } } },
        },
      }),
      this.prisma.guardianCitation.count({
        where: {
          attended: null,
          scheduledDate: { gte: new Date() },
          studentEnrollment: { academicYearId, group: { campus: { institutionId } } },
        },
      }),
      this.prisma.actaRecord.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          observation: { studentEnrollment: { academicYearId, group: { campus: { institutionId } } } },
        },
      }),
    ]);

    return { pendingCommitments, pendingReferrals, upcomingCitations, recentActas };
  }
}
