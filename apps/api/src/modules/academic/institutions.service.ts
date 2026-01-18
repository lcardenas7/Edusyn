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
        daneCode: dto.daneCode,
        nit: dto.nit,
      },
    });
  }

  async list() {
    return this.prisma.institution.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
