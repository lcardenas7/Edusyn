import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { StaffLeaveStatus, StaffLeaveType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const LEAVE_INCLUDE = {
  requester: { select: { id: true, firstName: true, lastName: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
};

@Injectable()
export class StaffLeaveService {
  constructor(private readonly prisma: PrismaService) {}

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
    return this.prisma.staffLeaveRequest.create({
      data: {
        institutionId: data.institutionId,
        requesterId: data.requesterId,
        type: data.type,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
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
    return this.prisma.staffLeaveRequest.findMany({
      where: {
        institutionId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.requesterId ? { requesterId: filters.requesterId } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.startDate && filters?.endDate
          ? { startDate: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) } }
          : {}),
      },
      include: LEAVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMyRequests(requesterId: string, institutionId: string) {
    return this.prisma.staffLeaveRequest.findMany({
      where: { requesterId, institutionId },
      include: LEAVE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const request = await this.prisma.staffLeaveRequest.findUnique({
      where: { id },
      include: LEAVE_INCLUDE,
    });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    return request;
  }

  async review(
    id: string,
    reviewerId: string,
    data: { status: 'APPROVED' | 'REJECTED'; reviewerNote?: string },
  ) {
    const request = await this.prisma.staffLeaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden revisar solicitudes pendientes');
    }

    return this.prisma.staffLeaveRequest.update({
      where: { id },
      data: {
        status: data.status as StaffLeaveStatus,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
        reviewerNote: data.reviewerNote || null,
      },
      include: LEAVE_INCLUDE,
    });
  }

  async cancel(id: string, requesterId: string) {
    const request = await this.prisma.staffLeaveRequest.findUnique({ where: { id } });
    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.requesterId !== requesterId) {
      throw new ForbiddenException('Solo puedes cancelar tus propias solicitudes');
    }
    if (request.status !== 'PENDING') {
      throw new BadRequestException('Solo se pueden cancelar solicitudes pendientes');
    }

    return this.prisma.staffLeaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: LEAVE_INCLUDE,
    });
  }

  async getStats(institutionId: string, startDate?: string, endDate?: string) {
    const where: any = { institutionId };
    if (startDate && endDate) {
      where.startDate = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const [total, pending, approved, rejected] = await Promise.all([
      this.prisma.staffLeaveRequest.count({ where }),
      this.prisma.staffLeaveRequest.count({ where: { ...where, status: 'PENDING' } }),
      this.prisma.staffLeaveRequest.count({ where: { ...where, status: 'APPROVED' } }),
      this.prisma.staffLeaveRequest.count({ where: { ...where, status: 'REJECTED' } }),
    ]);

    return { total, pending, approved, rejected };
  }
}
