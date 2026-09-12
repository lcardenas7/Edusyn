import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { StaffLeaveStatus, StaffLeaveType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LEAVE_INCLUDE = {
  requester: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
};

@Injectable()
export class StaffLeaveService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value: string, field: string): Date {
    const result = new Date(value);
    if (!value || Number.isNaN(result.getTime())) {
      throw new BadRequestException(`${field} no es válida`);
    }
    return result;
  }

  private scope(institutionId: string, id?: string, requesterId?: string) {
    return {
      ...(id ? { id } : {}),
      institutionId,
      ...(requesterId ? { requesterId } : {}),
      requester: {
        OR: [
          { isSuperAdmin: true },
          { institutionUsers: { some: { institutionId } } },
        ],
      },
      OR: [
        { reviewedById: null },
        { reviewedBy: { isSuperAdmin: true } },
        { reviewedBy: { institutionUsers: { some: { institutionId } } } },
      ],
    };
  }

  async create(data: {
    institutionId: string;
    requesterId: string;
    type: StaffLeaveType;
    startDate: string;
    endDate?: string;
    startTime?: string;
    endTime?: string;
    reason: string;
    attachmentUrl?: string;
  }) {
    if (!Object.values(StaffLeaveType).includes(data.type)) {
      throw new BadRequestException('El tipo de ausencia no es válido');
    }
    if (!data.reason?.trim()) {
      throw new BadRequestException('La solicitud debe incluir un motivo');
    }
    const startDate = this.date(data.startDate, 'La fecha inicial');
    const endDate = data.endDate
      ? this.date(data.endDate, 'La fecha final')
      : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial',
      );
    }

    const requester = await this.prisma.user.findFirst({
      where: {
        id: data.requesterId,
        OR: [
          { isSuperAdmin: true },
          {
            institutionUsers: {
              some: { institutionId: data.institutionId, isActive: true },
            },
          },
        ],
      },
      select: { id: true },
    });
    if (!requester)
      throw new NotFoundException('Usuario solicitante no encontrado');

    return this.prisma.staffLeaveRequest.create({
      data: {
        institutionId: data.institutionId,
        requesterId: data.requesterId,
        type: data.type,
        startDate,
        endDate,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        reason: data.reason,
        attachmentUrl: data.attachmentUrl || null,
      },
      include: LEAVE_INCLUDE,
    });
  }

  async findAll(
    institutionId: string,
    filters?: {
      status?: StaffLeaveStatus;
      requesterId?: string;
      startDate?: string;
      endDate?: string;
      type?: StaffLeaveType;
    },
  ) {
    if (
      filters?.status &&
      !Object.values(StaffLeaveStatus).includes(filters.status)
    ) {
      throw new BadRequestException('El estado no es válido');
    }
    if (
      filters?.type &&
      !Object.values(StaffLeaveType).includes(filters.type)
    ) {
      throw new BadRequestException('El tipo de ausencia no es válido');
    }
    const rangeStart = filters?.startDate
      ? this.date(filters.startDate, 'La fecha inicial')
      : undefined;
    const rangeEnd = filters?.endDate
      ? this.date(filters.endDate, 'La fecha final')
      : undefined;
    if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial',
      );
    }
    return this.prisma.staffLeaveRequest.findMany({
      where: {
        ...this.scope(institutionId),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.requesterId ? { requesterId: filters.requesterId } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(rangeStart || rangeEnd
          ? {
              startDate: {
                ...(rangeStart ? { gte: rangeStart } : {}),
                ...(rangeEnd ? { lte: rangeEnd } : {}),
              },
            }
          : {}),
      },
      include: LEAVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyRequests(requesterId: string, institutionId: string) {
    return this.prisma.staffLeaveRequest.findMany({
      where: this.scope(institutionId, undefined, requesterId),
      include: LEAVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, institutionId: string, requesterId?: string) {
    const request = await this.prisma.staffLeaveRequest.findFirst({
      where: this.scope(institutionId, id, requesterId),
      include: LEAVE_INCLUDE,
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async review(
    id: string,
    institutionId: string,
    reviewerId: string,
    data: { status: 'APPROVED' | 'REJECTED'; reviewerNote?: string },
  ) {
    if (!['APPROVED', 'REJECTED'].includes(data.status)) {
      throw new BadRequestException(
        'La revisión debe aprobar o rechazar la solicitud',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const reviewer = await tx.user.findFirst({
        where: {
          id: reviewerId,
          OR: [
            { isSuperAdmin: true },
            { institutionUsers: { some: { institutionId, isActive: true } } },
          ],
        },
        select: { id: true },
      });
      if (!reviewer)
        throw new NotFoundException('Usuario revisor no encontrado');

      const request = await tx.staffLeaveRequest.findFirst({
        where: this.scope(institutionId, id),
        select: { id: true, status: true },
      });
      if (!request) throw new NotFoundException('Solicitud no encontrada');
      if (request.status !== 'PENDING') {
        throw new BadRequestException(
          'Solo se pueden revisar solicitudes pendientes',
        );
      }

      const changed = await tx.staffLeaveRequest.updateMany({
        where: { id, institutionId, status: 'PENDING' },
        data: {
          status: data.status as StaffLeaveStatus,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewerNote: data.reviewerNote || null,
        },
      });
      if (changed.count !== 1)
        throw new BadRequestException('La solicitud ya fue revisada');
      return tx.staffLeaveRequest.findFirst({
        where: { id, institutionId },
        include: LEAVE_INCLUDE,
      });
    });
  }

  async cancel(id: string, institutionId: string, requesterId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Se incluye requesterId en la primera búsqueda: una solicitud de otra persona o institución
      // es indistinguible de una inexistente y no confirma su existencia con un 403.
      const request = await tx.staffLeaveRequest.findFirst({
        where: this.scope(institutionId, id, requesterId),
        select: { id: true, status: true },
      });
      if (!request) throw new NotFoundException('Solicitud no encontrada');
      if (request.status !== 'PENDING') {
        throw new BadRequestException(
          'Solo se pueden cancelar solicitudes pendientes',
        );
      }

      const changed = await tx.staffLeaveRequest.updateMany({
        where: { id, institutionId, requesterId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (changed.count !== 1)
        throw new BadRequestException('La solicitud ya no está pendiente');
      return tx.staffLeaveRequest.findFirst({
        where: { id, institutionId, requesterId },
        include: LEAVE_INCLUDE,
      });
    });
  }

  async getStats(institutionId: string, startDate?: string, endDate?: string) {
    const rangeStart = startDate
      ? this.date(startDate, 'La fecha inicial')
      : undefined;
    const rangeEnd = endDate ? this.date(endDate, 'La fecha final') : undefined;
    if (rangeStart && rangeEnd && rangeEnd < rangeStart) {
      throw new BadRequestException(
        'La fecha final no puede ser anterior a la fecha inicial',
      );
    }
    const where: any = this.scope(institutionId);
    if (startDate || endDate) {
      where.startDate = {
        ...(rangeStart ? { gte: rangeStart } : {}),
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      };
    }

    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.staffLeaveRequest.count({ where }),
      this.prisma.staffLeaveRequest.count({
        where: { ...where, status: 'PENDING' },
      }),
      this.prisma.staffLeaveRequest.count({
        where: { ...where, status: 'APPROVED' },
      }),
      this.prisma.staffLeaveRequest.count({
        where: { ...where, status: 'REJECTED' },
      }),
    ]);

    return { total, pending, approved, rejected };
  }
}
