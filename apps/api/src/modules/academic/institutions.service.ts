import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateInstitutionDto } from './dto/create-institution.dto';

@Injectable()
export class InstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateInstitutionDto) {
    return this.prisma.institution.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        daneCode: dto.daneCode,
        nit: dto.nit,
        status: 'TRIAL',
      },
    });
  }

  async list() {
    return this.prisma.institution.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
