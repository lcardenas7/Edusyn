import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateGradeDto } from './dto/create-grade.dto';

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGradeDto) {
    return this.prisma.grade.create({
      data: {
        stage: dto.stage,
        number: dto.number,
        name: dto.name,
      },
    });
  }

  async list() {
    return this.prisma.grade.findMany({
      orderBy: [{ stage: 'asc' }, { name: 'asc' }],
    });
  }
}
