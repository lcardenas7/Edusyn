import { Injectable } from '@nestjs/common';

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
    });
  }
}
