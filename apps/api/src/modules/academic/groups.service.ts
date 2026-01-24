import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto } from './dto/create-group.dto';

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        campusId: dto.campusId,
        shiftId: dto.shiftId,
        gradeId: dto.gradeId,
        code: dto.code,
        name: dto.name,
      },
    });
  }

  async list(params: { campusId?: string; shiftId?: string; gradeId?: string; institutionId?: string }) {
    return this.prisma.group.findMany({
      where: {
        campusId: params.campusId,
        shiftId: params.shiftId,
        gradeId: params.gradeId,
        // Filtrar por institución a través del campus
        ...(params.institutionId && {
          campus: {
            institutionId: params.institutionId
          }
        }),
      },
      include: {
        grade: true,
        shift: true,
        campus: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
