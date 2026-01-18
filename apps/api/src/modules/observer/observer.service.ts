import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateObservationDto, UpdateObservationDto } from './dto/create-observation.dto';

@Injectable()
export class ObserverService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateObservationDto) {
    return this.prisma.studentObservation.create({
      data: {
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
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateObservationDto) {
    const observation = await this.prisma.studentObservation.findUnique({
      where: { id },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

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
      },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async delete(id: string) {
    const observation = await this.prisma.studentObservation.findUnique({
      where: { id },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    return this.prisma.studentObservation.delete({ where: { id } });
  }

  async getByStudent(studentEnrollmentId: string, startDate?: string, endDate?: string) {
    return this.prisma.studentObservation.findMany({
      where: {
        studentEnrollmentId,
        ...(startDate && endDate
          ? {
              date: {
                gte: new Date(startDate),
                lte: new Date(endDate),
              },
            }
          : {}),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getById(id: string) {
    const observation = await this.prisma.studentObservation.findUnique({
      where: { id },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    return observation;
  }

  async getPendingFollowUps(authorId?: string) {
    return this.prisma.studentObservation.findMany({
      where: {
        requiresFollowUp: true,
        followUpNotes: null,
        ...(authorId ? { authorId } : {}),
      },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { followUpDate: 'asc' },
    });
  }

  async getStudentSummary(studentEnrollmentId: string) {
    const observations = await this.prisma.studentObservation.findMany({
      where: { studentEnrollmentId },
    });

    return {
      total: observations.length,
      byType: {
        positive: observations.filter((o) => o.type === 'POSITIVE').length,
        negative: observations.filter((o) => o.type === 'NEGATIVE').length,
        neutral: observations.filter((o) => o.type === 'NEUTRAL').length,
        commitment: observations.filter((o) => o.type === 'COMMITMENT').length,
      },
      byCategory: {
        academic: observations.filter((o) => o.category === 'ACADEMIC').length,
        behavioral: observations.filter((o) => o.category === 'BEHAVIORAL').length,
        attendance: observations.filter((o) => o.category === 'ATTENDANCE').length,
        uniform: observations.filter((o) => o.category === 'UNIFORM').length,
        other: observations.filter((o) => o.category === 'OTHER').length,
      },
      pendingFollowUps: observations.filter((o) => o.requiresFollowUp && !o.followUpNotes).length,
    };
  }

  async markParentNotified(id: string) {
    return this.prisma.studentObservation.update({
      where: { id },
      data: {
        parentNotified: true,
        parentNotifiedAt: new Date(),
      },
    });
  }
}
