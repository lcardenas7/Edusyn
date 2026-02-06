import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ObligationStatus, Prisma, DocumentType } from '@prisma/client';

@Injectable()
export class ObligationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, filters?: {
    thirdPartyId?: string;
    conceptId?: string;
    status?: ObligationStatus;
    dueDateFrom?: Date;
    dueDateTo?: Date;
  }) {
    return this.prisma.financialObligation.findMany({
      where: {
        institutionId,
        ...(filters?.thirdPartyId && { thirdPartyId: filters.thirdPartyId }),
        ...(filters?.conceptId && { conceptId: filters.conceptId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.dueDateFrom || filters?.dueDateTo ? {
          dueDate: {
            ...(filters.dueDateFrom && { gte: filters.dueDateFrom }),
            ...(filters.dueDateTo && { lte: filters.dueDateTo }),
          },
        } : {}),
      },
      include: {
        thirdParty: true,
        concept: { include: { category: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    const obligation = await this.prisma.financialObligation.findFirst({
      where: { id, institutionId },
      include: {
        thirdParty: true,
        concept: { include: { category: true } },
        payments: {
          where: { voidedAt: null },
          orderBy: { paymentDate: 'desc' },
        },
      },
    });

    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }

    return obligation;
  }

  async create(institutionId: string, userId: string, data: {
    thirdPartyId: string;
    conceptId: string;
    amount?: number;
    discountAmount?: number;
    discountReason?: string;
    dueDate?: Date;
    notes?: string;
  }) {
    const concept = await this.prisma.chargeConcept.findFirst({
      where: { id: data.conceptId, institutionId },
    });

    if (!concept) {
      throw new NotFoundException('Concepto no encontrado');
    }

    const originalAmount = data.amount ?? Number(concept.defaultAmount);
    const discountAmount = data.discountAmount ?? 0;
    const totalAmount = originalAmount - discountAmount;
    const balance = totalAmount;

    const reference = await this.generateReference(institutionId);

    return this.prisma.financialObligation.create({
      data: {
        institutionId,
        thirdPartyId: data.thirdPartyId,
        conceptId: data.conceptId,
        originalAmount: new Prisma.Decimal(originalAmount),
        discountAmount: new Prisma.Decimal(discountAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
        balance: new Prisma.Decimal(balance),
        dueDate: data.dueDate ?? concept.dueDate,
        discountReason: data.discountReason,
        notes: data.notes,
        reference,
        createdById: userId,
      },
      include: {
        thirdParty: true,
        concept: true,
      },
    });
  }

  // GENERACIÓN MASIVA DE OBLIGACIONES
  async createMassive(institutionId: string, userId: string, data: {
    conceptId: string;
    targetType: 'GRADE' | 'GROUP' | 'STUDENTS';
    targetIds: string[];
    amount?: number;
    discountAmount?: number;
    discountReason?: string;
    dueDate?: Date;
  }) {
    const concept = await this.prisma.chargeConcept.findFirst({
      where: { id: data.conceptId, institutionId },
    });

    if (!concept) {
      throw new NotFoundException('Concepto no encontrado');
    }

    let thirdPartyIds: string[] = [];

    // Obtener terceros según el tipo de destino
    if (data.targetType === 'GRADE') {
      // Obtener estudiantes de los grados seleccionados
      const students = await this.prisma.studentEnrollment.findMany({
        where: {
          status: 'ACTIVE',
          group: {
            grade: { id: { in: data.targetIds } },
          },
        },
        select: { studentId: true },
      });

      const studentIds = students.map(s => s.studentId);

      // Obtener o crear terceros para estos estudiantes
      for (const studentId of studentIds) {
        const thirdParty = await this.getOrCreateThirdParty(institutionId, 'STUDENT', studentId);
        if (thirdParty) thirdPartyIds.push(thirdParty.id);
      }
    } else if (data.targetType === 'GROUP') {
      // Obtener estudiantes de los grupos seleccionados
      const students = await this.prisma.studentEnrollment.findMany({
        where: {
          status: 'ACTIVE',
          groupId: { in: data.targetIds },
        },
        select: { studentId: true },
      });

      const studentIds = students.map(s => s.studentId);

      for (const studentId of studentIds) {
        const thirdParty = await this.getOrCreateThirdParty(institutionId, 'STUDENT', studentId);
        if (thirdParty) thirdPartyIds.push(thirdParty.id);
      }
    } else if (data.targetType === 'STUDENTS') {
      // Terceros específicos ya seleccionados
      thirdPartyIds = data.targetIds;
    }

    // Eliminar duplicados
    thirdPartyIds = [...new Set(thirdPartyIds)];

    const originalAmount = data.amount ?? Number(concept.defaultAmount);
    const discountAmount = data.discountAmount ?? 0;
    const totalAmount = originalAmount - discountAmount;

    const results = {
      created: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const thirdPartyId of thirdPartyIds) {
      try {
        // Verificar si ya existe una obligación para este tercero y concepto
        const existing = await this.prisma.financialObligation.findFirst({
          where: {
            institutionId,
            thirdPartyId,
            conceptId: data.conceptId,
            status: { in: ['PENDING', 'PARTIAL'] },
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        const reference = await this.generateReference(institutionId);

        await this.prisma.financialObligation.create({
          data: {
            institutionId,
            thirdPartyId,
            conceptId: data.conceptId,
            originalAmount: new Prisma.Decimal(originalAmount),
            discountAmount: new Prisma.Decimal(discountAmount),
            totalAmount: new Prisma.Decimal(totalAmount),
            balance: new Prisma.Decimal(totalAmount),
            dueDate: data.dueDate ?? concept.dueDate,
            discountReason: data.discountReason,
            reference,
            createdById: userId,
          },
        });

        results.created++;
      } catch (error) {
        results.errors.push(`Error con tercero ${thirdPartyId}: ${error.message}`);
      }
    }

    return results;
  }

  async applyDiscount(id: string, institutionId: string, data: {
    discountAmount: number;
    discountReason: string;
    approvedBy: string;
  }) {
    const obligation = await this.findOne(id, institutionId);

    if (obligation.status === 'PAID' || obligation.status === 'CANCELLED') {
      throw new BadRequestException('No se puede aplicar descuento a una obligación pagada o cancelada');
    }

    const newTotal = Number(obligation.originalAmount) - data.discountAmount;
    const newBalance = newTotal - Number(obligation.paidAmount);

    return this.prisma.financialObligation.update({
      where: { id },
      data: {
        discountAmount: new Prisma.Decimal(data.discountAmount),
        totalAmount: new Prisma.Decimal(newTotal),
        balance: new Prisma.Decimal(newBalance),
        discountReason: data.discountReason,
        discountApprovedBy: data.approvedBy,
        status: newBalance <= 0 ? 'PAID' : obligation.status,
        paidDate: newBalance <= 0 ? new Date() : null,
      },
    });
  }

  async cancel(id: string, institutionId: string, reason: string) {
    const obligation = await this.findOne(id, institutionId);

    if (obligation.status === 'PAID') {
      throw new BadRequestException('No se puede cancelar una obligación pagada');
    }

    return this.prisma.financialObligation.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: `${obligation.notes || ''}\n[CANCELADA] ${reason}`.trim(),
      },
    });
  }

  // Actualizar saldo después de un pago
  async updateBalance(id: string, paymentAmount: number) {
    const obligation = await this.prisma.financialObligation.findUnique({
      where: { id },
    });

    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }

    const newPaidAmount = Number(obligation.paidAmount) + paymentAmount;
    const newBalance = Number(obligation.totalAmount) - newPaidAmount;

    let newStatus: ObligationStatus = obligation.status;
    if (newBalance <= 0) {
      newStatus = 'PAID';
    } else if (newPaidAmount > 0) {
      newStatus = 'PARTIAL';
    }

    return this.prisma.financialObligation.update({
      where: { id },
      data: {
        paidAmount: new Prisma.Decimal(newPaidAmount),
        balance: new Prisma.Decimal(Math.max(0, newBalance)),
        status: newStatus,
        paidDate: newStatus === 'PAID' ? new Date() : null,
      },
    });
  }

  // Helpers
  private async generateReference(institutionId: string): Promise<string> {
    const count = await this.prisma.financialObligation.count({
      where: { institutionId },
    });
    const year = new Date().getFullYear();
    return `OBL-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async getOrCreateThirdParty(institutionId: string, type: string, referenceId: string) {
    let thirdParty = await this.prisma.financialThirdParty.findFirst({
      where: { institutionId, type: type as any, referenceId },
    });

    if (!thirdParty) {
      // Obtener datos del estudiante
      const student = await this.prisma.student.findUnique({
        where: { id: referenceId },
      });

      if (student) {
        thirdParty = await this.prisma.financialThirdParty.create({
          data: {
            institutionId,
            type: 'STUDENT',
            referenceId,
            name: `${student.firstName} ${student.lastName}`,
            document: student.documentNumber,
            documentType: student.documentType as DocumentType,
            email: student.email,
            phone: student.phone,
          },
        });
      }
    }

    return thirdParty;
  }

  // Estadísticas de cartera
  async getPortfolioStats(institutionId: string) {
    const [pending, partial, overdue, paid] = await Promise.all([
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PENDING' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PARTIAL' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'OVERDUE' },
        _sum: { balance: true },
        _count: true,
      }),
      this.prisma.financialObligation.aggregate({
        where: { institutionId, status: 'PAID' },
        _sum: { totalAmount: true },
        _count: true,
      }),
    ]);

    return {
      pending: {
        count: pending._count,
        amount: pending._sum.balance || 0,
      },
      partial: {
        count: partial._count,
        amount: partial._sum.balance || 0,
      },
      overdue: {
        count: overdue._count,
        amount: overdue._sum.balance || 0,
      },
      paid: {
        count: paid._count,
        amount: paid._sum.totalAmount || 0,
      },
      totalPortfolio: Number(pending._sum.balance || 0) + Number(partial._sum.balance || 0) + Number(overdue._sum.balance || 0),
    };
  }
}
