import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RoomRestrictionType } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, campusId?: string) {
    return this.prisma.room.findMany({
      where: {
        institutionId,
        ...(campusId && { campusId }),
        isActive: true,
      },
      orderBy: { name: 'asc' },
      include: {
        campus: { select: { id: true, name: true } },
        restrictions: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
        _count: { select: { scheduleEntries: true } },
      },
    });
  }

  async findOne(id: string, institutionId: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, institutionId },
      include: {
        campus: { select: { id: true, name: true } },
        restrictions: {
          include: {
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!room) throw new NotFoundException('Espacio no encontrado');
    return room;
  }

  async create(institutionId: string, data: {
    campusId?: string;
    name: string;
    code?: string;
    capacity?: number;
    description?: string;
    equipment?: string[];
    isReservable?: boolean;
  }) {
    const existing = await this.prisma.room.findFirst({
      where: { institutionId, name: data.name },
    });
    if (existing) {
      throw new BadRequestException('Ya existe un espacio con ese nombre');
    }

    return this.prisma.room.create({
      data: {
        institutionId,
        ...data,
      },
      include: {
        campus: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, institutionId: string, data: {
    campusId?: string;
    name?: string;
    code?: string;
    capacity?: number;
    description?: string;
    equipment?: string[];
    isReservable?: boolean;
    isActive?: boolean;
  }) {
    await this.findOne(id, institutionId);

    if (data.name) {
      const existing = await this.prisma.room.findFirst({
        where: { institutionId, name: data.name, NOT: { id } },
      });
      if (existing) {
        throw new BadRequestException('Ya existe un espacio con ese nombre');
      }
    }

    return this.prisma.room.update({
      where: { id },
      data,
      include: {
        campus: { select: { id: true, name: true } },
      },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    const entriesCount = await this.prisma.scheduleEntry.count({
      where: { roomId: id },
    });

    if (entriesCount > 0) {
      return this.prisma.room.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.room.delete({ where: { id } });
  }

  // ── Restricciones de espacio ──

  async addRestriction(roomId: string, institutionId: string, data: {
    subjectId?: string;
    type?: RoomRestrictionType;
  }) {
    await this.findOne(roomId, institutionId);

    return this.prisma.roomRestriction.create({
      data: {
        roomId,
        subjectId: data.subjectId || null,
        type: data.type || 'PREFERRED',
      },
      include: {
        subject: { select: { id: true, name: true } },
      },
    });
  }

  async removeRestriction(restrictionId: string, institutionId: string) {
    const restriction = await this.prisma.roomRestriction.findFirst({
      where: { id: restrictionId },
      include: { room: { select: { institutionId: true } } },
    });

    if (!restriction || restriction.room.institutionId !== institutionId) {
      throw new NotFoundException('Restricción no encontrada');
    }

    return this.prisma.roomRestriction.delete({ where: { id: restrictionId } });
  }
}
