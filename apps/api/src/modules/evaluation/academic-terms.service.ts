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
    return years;
  }

  async createYear(data: { institutionId: string; year: number; startDate?: Date; endDate?: Date }, institutionId: string) {
    // Segunda ruta de creacion de anos lectivos, y la que usa realmente el frontend
    // (academicYearsApi.create). La institucion la resuelve el servidor; data.institutionId
    // se ignora (docs/security/RLS-AUDIT-ACADEMIC-YEARS.md).
    return this.prisma.academicYear.create({
      data: {
        institutionId,
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
    // Tolerancia: 3 períodos de 33.33% suman 99.99; aceptamos ±0.5% de redondeo.
    if (Math.abs(total - 100) > 0.5) {
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

  // Sincronizar períodos desde la configuración de Periods.tsx hacia AcademicTerm
  async syncPeriods(academicYearId: string, periods: Array<{
    name: string;
    weight: number;
    order?: number;
    startDate?: string;
    endDate?: string;
  }>) {
    // Verificar que el año existe
    const year = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!year) {
      throw new BadRequestException('Año académico no encontrado');
    }

    // Obtener términos existentes
    const existingTerms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    const results: any[] = [];

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const order = period.order ?? (i + 1);
      const existing = existingTerms.find(t => t.order === order);

      if (existing) {
        const updated = await this.prisma.academicTerm.update({
          where: { id: existing.id },
          data: {
            name: period.name,
            weightPercentage: period.weight,
            startDate: period.startDate ? new Date(period.startDate) : existing.startDate,
            endDate: period.endDate ? new Date(period.endDate) : existing.endDate,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.academicTerm.create({
          data: {
            academicYearId,
            type: 'PERIOD',
            name: period.name,
            order,
            weightPercentage: period.weight,
            startDate: period.startDate ? new Date(period.startDate) : null,
            endDate: period.endDate ? new Date(period.endDate) : null,
          },
        });
        results.push(created);
      }
    }

    // Eliminar términos sobrantes (si se redujo el número de períodos)
    // Solo eliminar los de tipo PERIOD que excedan el número actual
    const maxOrder = periods.length;
    const toDelete = existingTerms.filter(t => t.order > maxOrder && t.type === 'PERIOD');
    for (const t of toDelete) {
      try {
        await this.prisma.academicTerm.delete({ where: { id: t.id } });
      } catch (e) {
        // Si tiene dependencias, no eliminar
      }
    }

    return { synced: results.length, terms: results };
  }

  async toggleBulletinsRelease(termId: string, released: boolean) {
    return this.prisma.academicTerm.update({
      where: { id: termId },
      data: { bulletinsReleasedForTeachers: released },
    });
  }
}
