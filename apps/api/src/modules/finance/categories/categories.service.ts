import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FinancialMovementType, Prisma } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, type?: FinancialMovementType) {
    return this.prisma.financialCategory.findMany({
      where: {
        institutionId,
        ...(type && { type }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: {
            concepts: true,
            expenses: true,
          },
        },
      },
    });
  }

  async findOne(id: string, institutionId: string) {
    const category = await this.prisma.financialCategory.findFirst({
      where: { id, institutionId },
    });

    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }

    return category;
  }

  async create(institutionId: string, data: {
    name: string;
    description?: string;
    code?: string;
    type?: FinancialMovementType;
    budgetAmount?: number;
    color?: string;
    icon?: string;
  }) {
    const existing = await this.prisma.financialCategory.findFirst({
      where: { institutionId, name: data.name },
    });

    if (existing) {
      throw new BadRequestException('Ya existe una categoría con este nombre');
    }

    return this.prisma.financialCategory.create({
      data: {
        institutionId,
        ...data,
        budgetAmount: data.budgetAmount ? new Prisma.Decimal(data.budgetAmount) : null,
      },
    });
  }

  async update(id: string, institutionId: string, data: {
    name?: string;
    description?: string;
    code?: string;
    type?: FinancialMovementType;
    budgetAmount?: number;
    color?: string;
    icon?: string;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    await this.findOne(id, institutionId);

    if (data.name) {
      const existing = await this.prisma.financialCategory.findFirst({
        where: { institutionId, name: data.name, NOT: { id } },
      });

      if (existing) {
        throw new BadRequestException('Ya existe una categoría con este nombre');
      }
    }

    return this.prisma.financialCategory.update({
      where: { id },
      data: {
        ...data,
        budgetAmount: data.budgetAmount !== undefined 
          ? (data.budgetAmount ? new Prisma.Decimal(data.budgetAmount) : null)
          : undefined,
      },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    const hasRelations = await this.prisma.financialCategory.findFirst({
      where: { id },
      include: {
        _count: {
          select: {
            concepts: true,
            expenses: true,
          },
        },
      },
    });

    if (hasRelations && (hasRelations._count.concepts > 0 || hasRelations._count.expenses > 0)) {
      return this.prisma.financialCategory.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.financialCategory.delete({
      where: { id },
    });
  }

  async seedDefaults(institutionId: string) {
    const defaults = [
      { name: 'Eventos', type: 'INCOME' as FinancialMovementType, color: '#3B82F6', icon: 'calendar' },
      { name: 'Rifas y Bingos', type: 'INCOME' as FinancialMovementType, color: '#10B981', icon: 'ticket' },
      { name: 'Derechos de Grado', type: 'INCOME' as FinancialMovementType, color: '#8B5CF6', icon: 'graduation-cap' },
      { name: 'Donaciones', type: 'INCOME' as FinancialMovementType, color: '#F59E0B', icon: 'heart' },
      { name: 'Salidas Pedagógicas', type: 'INCOME' as FinancialMovementType, color: '#06B6D4', icon: 'bus' },
      { name: 'Multas y Sanciones', type: 'INCOME' as FinancialMovementType, color: '#EF4444', icon: 'alert-triangle' },
      { name: 'Papelería', type: 'EXPENSE' as FinancialMovementType, color: '#64748B', icon: 'file-text' },
      { name: 'Premios', type: 'EXPENSE' as FinancialMovementType, color: '#EC4899', icon: 'gift' },
      { name: 'Logística', type: 'EXPENSE' as FinancialMovementType, color: '#F97316', icon: 'truck' },
      { name: 'Mantenimiento', type: 'EXPENSE' as FinancialMovementType, color: '#84CC16', icon: 'wrench' },
      { name: 'Servicios', type: 'EXPENSE' as FinancialMovementType, color: '#14B8A6', icon: 'zap' },
    ];

    const created = [];
    for (const cat of defaults) {
      const existing = await this.prisma.financialCategory.findFirst({
        where: { institutionId, name: cat.name },
      });

      if (!existing) {
        const newCat = await this.prisma.financialCategory.create({
          data: { institutionId, ...cat },
        });
        created.push(newCat);
      }
    }

    return { created: created.length };
  }
}
