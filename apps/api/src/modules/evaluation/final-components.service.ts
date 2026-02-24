import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FinalComponentsService {
  private readonly logger = new Logger(FinalComponentsService.name);
  constructor(private prisma: PrismaService) {}

  async findByAcademicYear(academicYearId: string) {
    return this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });
  }

  async findOne(id: string) {
    const component = await this.prisma.finalComponent.findUnique({ where: { id } });
    if (!component) throw new NotFoundException('Componente final no encontrado');
    return component;
  }

  async create(data: {
    institutionId: string;
    academicYearId: string;
    name: string;
    weightPercentage: number;
    order: number;
  }) {
    // Validar que la suma de pesos (períodos + componentes) no exceda 100
    await this.validateTotalWeight(data.academicYearId, data.weightPercentage);

    return this.prisma.finalComponent.create({ data });
  }

  async bulkSync(
    institutionId: string,
    academicYearId: string,
    components: Array<{ id?: string; name: string; weightPercentage: number; order: number }>,
  ) {
    this.logger.log(`bulkSync called: institutionId=${institutionId}, academicYearId=${academicYearId}, components=${JSON.stringify(components)}`);

    // Eliminar componentes existentes que no están en la nueva lista
    const existingIds = components.filter(c => c.id).map(c => c.id!);
    await this.prisma.finalComponent.deleteMany({
      where: {
        academicYearId,
        id: { notIn: existingIds },
      },
    });

    // Upsert cada componente
    const results: any[] = [];
    for (const comp of components) {
      if (comp.id) {
        const updated = await this.prisma.finalComponent.update({
          where: { id: comp.id },
          data: {
            name: comp.name,
            weightPercentage: comp.weightPercentage,
            order: comp.order,
          },
        });
        results.push(updated);
      } else {
        const created = await this.prisma.finalComponent.create({
          data: {
            institutionId,
            academicYearId,
            name: comp.name,
            weightPercentage: comp.weightPercentage,
            order: comp.order,
          },
        });
        results.push(created);
      }
    }

    return results;
  }

  async toggleOpen(id: string, isOpen: boolean) {
    await this.findOne(id);
    return this.prisma.finalComponent.update({
      where: { id },
      data: { isOpen },
    });
  }

  async update(id: string, data: { name?: string; weightPercentage?: number; order?: number }) {
    const existing = await this.findOne(id);

    if (data.weightPercentage !== undefined) {
      const diff = data.weightPercentage - existing.weightPercentage;
      if (diff > 0) {
        await this.validateTotalWeight(existing.academicYearId, diff);
      }
    }

    return this.prisma.finalComponent.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.finalComponent.delete({ where: { id } });
  }

  private async validateTotalWeight(academicYearId: string, additionalWeight: number) {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      select: { weightPercentage: true },
    });
    const existingComponents = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      select: { weightPercentage: true },
    });

    const totalTermWeight = terms.reduce((sum, t) => sum + t.weightPercentage, 0);
    const totalComponentWeight = existingComponents.reduce((sum, c) => sum + c.weightPercentage, 0);
    const total = totalTermWeight + totalComponentWeight + additionalWeight;

    if (total > 100) {
      throw new BadRequestException(
        `El peso total excedería 100%. Períodos: ${totalTermWeight}%, Componentes existentes: ${totalComponentWeight}%, Nuevo: ${additionalWeight}%`,
      );
    }
  }
}
