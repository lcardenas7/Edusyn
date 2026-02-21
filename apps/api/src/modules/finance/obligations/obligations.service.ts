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
    gradeId?: string;
    groupId?: string;
    search?: string;
    dueDateFrom?: Date;
    dueDateTo?: Date;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = Math.min(filters?.limit || 25, 50);
    const skip = (page - 1) * limit;

    // Build thirdPartyId filter from gradeId/groupId/search if needed
    let thirdPartyIdFilter: string | undefined = filters?.thirdPartyId;
    let thirdPartyIdsFromFilter: string[] | undefined;

    if (filters?.gradeId || filters?.groupId || filters?.search) {
      // Find students matching grade/group/search, then map to thirdParty IDs
      const enrollmentWhere: any = { status: 'ACTIVE' };

      if (filters.groupId) {
        enrollmentWhere.groupId = filters.groupId;
      } else if (filters.gradeId) {
        enrollmentWhere.group = { gradeId: filters.gradeId };
      }

      if (filters.search) {
        const searchTerm = filters.search.trim();
        enrollmentWhere.student = {
          OR: [
            { firstName: { contains: searchTerm, mode: 'insensitive' } },
            { secondName: { contains: searchTerm, mode: 'insensitive' } },
            { lastName: { contains: searchTerm, mode: 'insensitive' } },
            { secondLastName: { contains: searchTerm, mode: 'insensitive' } },
            { documentNumber: { contains: searchTerm, mode: 'insensitive' } },
          ],
        };
      }

      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: enrollmentWhere,
        select: { studentId: true },
      });

      const studentIds = enrollments.map(e => e.studentId);

      // Map studentIds to thirdParty IDs
      const thirdParties = await this.prisma.financialThirdParty.findMany({
        where: {
          institutionId,
          type: 'STUDENT',
          referenceId: { in: studentIds },
        },
        select: { id: true },
      });

      thirdPartyIdsFromFilter = thirdParties.map(tp => tp.id);

      // If no matches found, return empty result immediately
      if (thirdPartyIdsFromFilter.length === 0) {
        return { data: [], meta: { total: 0, page, totalPages: 0, limit } };
      }
    }

    const where: Prisma.FinancialObligationWhereInput = {
      institutionId,
      ...(thirdPartyIdFilter && { thirdPartyId: thirdPartyIdFilter }),
      ...(thirdPartyIdsFromFilter && !thirdPartyIdFilter && { thirdPartyId: { in: thirdPartyIdsFromFilter } }),
      ...(filters?.conceptId && { conceptId: filters.conceptId }),
      ...(filters?.status && { status: filters.status }),
      ...(filters?.dueDateFrom || filters?.dueDateTo ? {
        dueDate: {
          ...(filters.dueDateFrom && { gte: filters.dueDateFrom }),
          ...(filters.dueDateTo && { lte: filters.dueDateTo }),
        },
      } : {}),
    };

    const [rawData, total] = await Promise.all([
      this.prisma.financialObligation.findMany({
        where,
        include: {
          thirdParty: { select: { id: true, name: true, document: true, type: true, referenceId: true } },
          concept: { select: { id: true, name: true, category: { select: { id: true, name: true } } } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financialObligation.count({ where }),
    ]);

    // Enrich with student enrollment info (group/grade) — batch query to avoid N+1
    const studentRefIds = rawData
      .filter(o => o.thirdParty.type === 'STUDENT' && o.thirdParty.referenceId)
      .map(o => o.thirdParty.referenceId as string);

    let enrollmentMap: Record<string, { groupName: string; gradeName: string }> = {};
    const uniqueStudentIds = [...new Set(studentRefIds)];
    if (uniqueStudentIds.length > 0) {
      const [enrollments, students] = await Promise.all([
        this.prisma.studentEnrollment.findMany({
          where: {
            studentId: { in: uniqueStudentIds },
            status: 'ACTIVE',
          },
          select: {
            studentId: true,
            group: {
              select: {
                name: true,
                grade: { select: { name: true } },
              },
            },
          },
        }),
        this.prisma.student.findMany({
          where: { id: { in: uniqueStudentIds } },
          select: { id: true, firstName: true, secondName: true, lastName: true, secondLastName: true },
        }),
      ]);

      for (const e of enrollments) {
        enrollmentMap[e.studentId] = {
          groupName: e.group.name,
          gradeName: e.group.grade.name,
        };
      }

      // Sync third party names to full institutional format
      const studentMap = new Map(students.map(s => [s.id, s]));
      const namesToUpdate: { id: string; name: string }[] = [];
      for (const o of rawData) {
        if (o.thirdParty.type === 'STUDENT' && o.thirdParty.referenceId) {
          const student = studentMap.get(o.thirdParty.referenceId);
          if (student) {
            const fullName = this.formatStudentName(student);
            if (o.thirdParty.name !== fullName) {
              namesToUpdate.push({ id: o.thirdParty.id, name: fullName });
              o.thirdParty.name = fullName; // Update in-memory for this response
            }
          }
        }
      }
      // Fire-and-forget batch name sync (non-blocking)
      if (namesToUpdate.length > 0) {
        Promise.all(
          namesToUpdate.map(u =>
            this.prisma.financialThirdParty.update({
              where: { id: u.id },
              data: { name: u.name },
            })
          )
        ).catch(err => console.error('Error syncing third party names:', err));
      }
    }

    const data = rawData.map(o => {
      const enrollment = o.thirdParty.referenceId
        ? enrollmentMap[o.thirdParty.referenceId]
        : undefined;
      return {
        ...o,
        studentGroup: enrollment?.groupName || null,
        studentGrade: enrollment?.gradeName || null,
      };
    });

    return { data, meta: { total, page, totalPages: Math.ceil(total / limit), limit } };
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
            status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
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

  private formatStudentName(student: { lastName: string; secondLastName?: string | null; firstName: string; secondName?: string | null }): string {
    return [
      student.lastName,
      student.secondLastName,
      student.firstName,
      student.secondName,
    ].filter(Boolean).join(' ').toUpperCase();
  }

  private async getOrCreateThirdParty(institutionId: string, type: string, referenceId: string) {
    let thirdParty = await this.prisma.financialThirdParty.findFirst({
      where: { institutionId, type: type as any, referenceId },
    });

    const student = await this.prisma.student.findUnique({
      where: { id: referenceId },
    });

    if (!student) return thirdParty;

    const fullName = this.formatStudentName(student);

    if (!thirdParty) {
      thirdParty = await this.prisma.financialThirdParty.create({
        data: {
          institutionId,
          type: 'STUDENT',
          referenceId,
          name: fullName,
          document: student.documentNumber,
          documentType: student.documentType as DocumentType,
          email: student.email,
          phone: student.phone,
        },
      });
    } else if (thirdParty.name !== fullName) {
      // Sync name if student data changed
      thirdParty = await this.prisma.financialThirdParty.update({
        where: { id: thirdParty.id },
        data: { name: fullName },
      });
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
