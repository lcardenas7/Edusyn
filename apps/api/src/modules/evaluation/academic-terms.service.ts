import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateAcademicTermDto } from './dto/create-academic-term.dto';

@Injectable()
export class AcademicTermsService {
  constructor(private readonly prisma: PrismaService) {}

  async listYears(institutionId?: string) {
    const years = await this.prisma.academicYear.findMany({
      where: institutionId ? { institutionId } : undefined,
      include: {
        terms: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { year: 'desc' },
    });
    console.log('[AcademicTermsService] Years found:', years.length, 'for institutionId:', institutionId);
    return years;
  }

  async createYear(data: { institutionId: string; year: number; startDate?: Date; endDate?: Date }) {
    return this.prisma.academicYear.create({
      data: {
        institutionId: data.institutionId,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });
  }

  async create(dto: CreateAcademicTermDto) {
    return this.prisma.academicTerm.create({
      data: {
        academicYearId: dto.academicYearId,
        name: dto.name,
        type: dto.type,
        order: dto.order,
        weightPercentage: dto.weightPercentage,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
  }

  async list(academicYearId: string) {
    return this.prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });
  }

  async validateWeights(academicYearId: string) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
    });
    const total = terms.reduce((sum, t) => sum + t.weightPercentage, 0);
    if (total !== 100) {
      throw new BadRequestException(
        `La suma de pesos de los cortes debe ser 100%. Actual: ${total}%`,
      );
    }
    return { valid: true, total };
  }

  async update(id: string, dto: Partial<CreateAcademicTermDto>) {
    return this.prisma.academicTerm.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return this.prisma.academicTerm.delete({ where: { id } });
  }
}
