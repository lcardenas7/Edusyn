import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ConceptsService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, filters?: {
    categoryId?: string;
    isActive?: boolean;
    isMassive?: boolean;
  }) {
    return this.prisma.chargeConcept.findMany({
      where: {
        institutionId,
        ...(filters?.categoryId && { categoryId: filters.categoryId }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.isMassive !== undefined && { isMassive: filters.isMassive }),
      },
      include: {
        category: true,
        _count: { select: { obligations: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const concept = await this.prisma.chargeConcept.findFirst({
      where: { id, institutionId },
      include: { category: true },
    });

    if (!concept) {
      throw new NotFoundException('Concepto no encontrado');
    }

    return concept;
  }

  async create(institutionId: string, data: {
    name: string;
    description?: string;
    categoryId: string;
    defaultAmount: number;
    isMassive?: boolean;
    isRecurring?: boolean;
    allowPartial?: boolean;
    allowDiscount?: boolean;
    validFrom?: Date;
    validUntil?: Date;
    dueDate?: Date;
    lateFeeType?: string;
    lateFeeValue?: number;
    gracePeriodDays?: number;
  }) {
    const existing = await this.prisma.chargeConcept.findFirst({
      where: { institutionId, name: data.name },
    });

    if (existing) {
      throw new BadRequestException('Ya existe un concepto con este nombre');
    }

    return this.prisma.chargeConcept.create({
      data: {
        institutionId,
        ...data,
        defaultAmount: new Prisma.Decimal(data.defaultAmount),
        lateFeeValue: data.lateFeeValue ? new Prisma.Decimal(data.lateFeeValue) : null,
      },
      include: { category: true },
    });
  }

  async update(id: string, institutionId: string, data: Partial<{
    name: string;
    description: string;
    categoryId: string;
    defaultAmount: number;
    isMassive: boolean;
    isRecurring: boolean;
    allowPartial: boolean;
    allowDiscount: boolean;
    validFrom: Date;
    validUntil: Date;
    dueDate: Date;
    lateFeeType: string;
    lateFeeValue: number;
    gracePeriodDays: number;
    isActive: boolean;
  }>) {
    await this.findOne(id, institutionId);

    if (data.name) {
      const existing = await this.prisma.chargeConcept.findFirst({
        where: { institutionId, name: data.name, NOT: { id } },
      });

      if (existing) {
        throw new BadRequestException('Ya existe un concepto con este nombre');
      }
    }

    const { defaultAmount, lateFeeValue, ...rest } = data;

    return this.prisma.chargeConcept.update({
      where: { id },
      data: {
        ...rest,
        ...(defaultAmount !== undefined && { defaultAmount: new Prisma.Decimal(defaultAmount) }),
        ...(lateFeeValue !== undefined && { lateFeeValue: lateFeeValue ? new Prisma.Decimal(lateFeeValue) : null }),
      },
      include: { category: true },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.findOne(id, institutionId);

    const hasObligations = await this.prisma.financialObligation.count({
      where: { conceptId: id },
    });

    if (hasObligations > 0) {
      return this.prisma.chargeConcept.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return this.prisma.chargeConcept.delete({ where: { id } });
  }
}
