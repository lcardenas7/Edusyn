import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    return this.prisma.subject.create({
      data: {
        areaId: dto.areaId,
        name: dto.name,
        order: 0,
      },
      include: {
        area: true,
      },
    });
  }

  async list(params: { areaId?: string; institutionId?: string }) {
    return this.prisma.subject.findMany({
      where: {
        areaId: params.areaId,
        ...(params.institutionId && {
          area: { institutionId: params.institutionId },
        }),
      },
      include: { area: true },
      orderBy: { name: 'asc' },
    });
  }
}
