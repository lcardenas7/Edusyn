import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { backfillCatalogCodes } from '../../common/utils/catalog-code.util';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({
      data: {
        areaId: dto.areaId,
        name: dto.name,
        order: 0,
      },
      include: {
        area: true,
      },
    });
    // Asegurar un código estable para amarrar la carga académica.
    if (subject.area?.institutionId) await backfillCatalogCodes(this.prisma, subject.area.institutionId);
    return this.prisma.subject.findUnique({ where: { id: subject.id }, include: { area: true } });
  }

  async backfillCatalogCodes(institutionId: string) {
    return backfillCatalogCodes(this.prisma, institutionId);
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
