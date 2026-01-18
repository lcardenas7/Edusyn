import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateCampusDto } from './dto/create-campus.dto';

@Injectable()
export class CampusesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCampusDto) {
    return this.prisma.campus.create({
      data: {
        institutionId: dto.institutionId,
        name: dto.name,
        address: dto.address,
      },
    });
  }

  async list(params: { institutionId?: string }) {
    return this.prisma.campus.findMany({
      where: {
        institutionId: params.institutionId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
