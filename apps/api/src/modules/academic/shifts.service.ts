import { Injectable } from '@nestjs/common';
import { SchoolShift } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateShiftDto } from './dto/create-shift.dto';

@Injectable()
export class ShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateShiftDto) {
    return this.prisma.shift.create({
      data: {
        campusId: dto.campusId,
        type: dto.type,
        name: dto.name,
      },
    });
  }

  async list(params: { campusId?: string }) {
    return this.prisma.shift.findMany({
      where: {
        campusId: params.campusId,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { groups: true } },
      },
    });
  }

  async update(id: string, data: { name?: string; type?: SchoolShift }) {
    return this.prisma.shift.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    // Check if shift has groups
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { _count: { select: { groups: true } } },
    });
    if (shift && shift._count.groups > 0) {
      throw new Error(`No se puede eliminar la jornada porque tiene ${shift._count.groups} grupo(s) asignados.`);
    }
    return this.prisma.shift.delete({ where: { id } });
  }
}
