import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentScope, PaymentStatus, Prisma } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════════════════════

export class CreatePaymentConceptDto {
  institutionId: string;
  name: string;
  description?: string;
  defaultAmount?: number;
  isRecurrent?: boolean;
}

export class CreatePaymentEventDto {
  institutionId: string;
  conceptId?: string;
  academicYearId?: string;
  name: string;
  description?: string;
  amount: number;
  dueDate?: string;
  scope?: PaymentScope;
  scopeFilter?: any;
  createdById: string;
}

export class RegisterPaymentDto {
  studentPaymentId: string;
  amount: number;
  paymentMethod?: string;
  reference?: string;
  observations?: string;
  receivedById: string;
}

export class ApplyDiscountDto {
  studentPaymentId: string;
  discountAmount: number;
  discountReason: string;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CONCEPTOS DE PAGO
  // ═══════════════════════════════════════════════════════════════════════════

  async createConcept(dto: CreatePaymentConceptDto) {
    return this.prisma.paymentConcept.create({
      data: {
        institutionId: dto.institutionId,
        name: dto.name,
        description: dto.description,
        defaultAmount: dto.defaultAmount ? new Prisma.Decimal(dto.defaultAmount) : null,
        isRecurrent: dto.isRecurrent || false,
      },
    });
  }

  async getConcepts(institutionId: string) {
    return this.prisma.paymentConcept.findMany({
      where: { institutionId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async updateConcept(id: string, data: Partial<CreatePaymentConceptDto>) {
    return this.prisma.paymentConcept.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.defaultAmount !== undefined && { 
          defaultAmount: data.defaultAmount ? new Prisma.Decimal(data.defaultAmount) : null 
        }),
        ...(data.isRecurrent !== undefined && { isRecurrent: data.isRecurrent }),
      },
    });
  }

  async deleteConcept(id: string) {
    return this.prisma.paymentConcept.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENTOS DE PAGO
  // ═══════════════════════════════════════════════════════════════════════════

  async createEvent(dto: CreatePaymentEventDto) {
    const event = await this.prisma.paymentEvent.create({
      data: {
        institutionId: dto.institutionId,
        conceptId: dto.conceptId,
        academicYearId: dto.academicYearId,
        name: dto.name,
        description: dto.description,
        amount: new Prisma.Decimal(dto.amount),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        scope: dto.scope || 'INSTITUTION',
        scopeFilter: dto.scopeFilter,
        createdById: dto.createdById,
      },
      include: {
        concept: true,
        academicYear: true,
      },
    });

    // Generar pagos para estudiantes según el alcance
    await this.generateStudentPayments(event.id);

    return event;
  }

  async getEvents(institutionId: string, academicYearId?: string) {
    return this.prisma.paymentEvent.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        concept: true,
        academicYear: true,
        _count: {
          select: { payments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEventById(eventId: string) {
    const event = await this.prisma.paymentEvent.findUnique({
      where: { id: eventId },
      include: {
        concept: true,
        academicYear: true,
        payments: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentNumber: true,
              },
            },
            transactions: {
              include: {
                receivedBy: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException('Evento de pago no encontrado');
    }

    return event;
  }

  async updateEvent(id: string, data: Partial<CreatePaymentEventDto>) {
    return this.prisma.paymentEvent.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.amount !== undefined && { amount: new Prisma.Decimal(data.amount) }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
        ...(data.scope && { scope: data.scope }),
        ...(data.scopeFilter !== undefined && { scopeFilter: data.scopeFilter }),
      },
    });
  }

  async deleteEvent(id: string) {
    return this.prisma.paymentEvent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GENERAR PAGOS PARA ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  private async generateStudentPayments(eventId: string) {
    const event = await this.prisma.paymentEvent.findUnique({
      where: { id: eventId },
      include: { institution: true },
    });

    if (!event) return;

    // Obtener estudiantes según el alcance
    let studentIds: string[] = [];

    if (event.scope === 'INSTITUTION') {
      const students = await this.prisma.student.findMany({
        where: { institutionId: event.institutionId },
        select: { id: true },
      });
      studentIds = students.map(s => s.id);
    } else if (event.scope === 'GRADE' || event.scope === 'GROUP') {
      const filter = event.scopeFilter as any;
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          academicYearId: event.academicYearId || undefined,
          status: 'ACTIVE',
          ...(event.scope === 'GRADE' && filter?.gradeIds && {
            group: { gradeId: { in: filter.gradeIds } },
          }),
          ...(event.scope === 'GROUP' && filter?.groupIds && {
            groupId: { in: filter.groupIds },
          }),
        },
        select: { studentId: true },
      });
      studentIds = [...new Set(enrollments.map(e => e.studentId))];
    } else if (event.scope === 'INDIVIDUAL') {
      const filter = event.scopeFilter as any;
      studentIds = filter?.studentIds || [];
    }

    // Crear registros de pago para cada estudiante
    if (studentIds.length > 0) {
      await this.prisma.studentPayment.createMany({
        data: studentIds.map(studentId => ({
          studentId,
          eventId,
          totalAmount: event.amount,
          paidAmount: new Prisma.Decimal(0),
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGOS DE ESTUDIANTES
  // ═══════════════════════════════════════════════════════════════════════════

  async getStudentPayments(studentId: string, academicYearId?: string) {
    return this.prisma.studentPayment.findMany({
      where: {
        studentId,
        event: {
          isActive: true,
          ...(academicYearId && { academicYearId }),
        },
      },
      include: {
        event: {
          include: { concept: true },
        },
        transactions: {
          orderBy: { receivedAt: 'desc' },
        },
      },
      orderBy: { event: { dueDate: 'asc' } },
    });
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.prisma.studentPayment.findUnique({
      where: { id: paymentId },
      include: {
        student: true,
        event: {
          include: { concept: true },
        },
        transactions: {
          include: {
            receivedBy: {
              select: { firstName: true, lastName: true },
            },
          },
          orderBy: { receivedAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Pago no encontrado');
    }

    return payment;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRAR PAGO (ABONO)
  // ═══════════════════════════════════════════════════════════════════════════

  async registerPayment(dto: RegisterPaymentDto) {
    const payment = await this.prisma.studentPayment.findUnique({
      where: { id: dto.studentPaymentId },
    });

    if (!payment) {
      throw new NotFoundException('Registro de pago no encontrado');
    }

    if (payment.status === 'PAID' || payment.status === 'EXEMPT') {
      throw new BadRequestException('Este pago ya está completo o exento');
    }

    const amountDecimal = new Prisma.Decimal(dto.amount);
    const newPaidAmount = payment.paidAmount.add(amountDecimal);
    const effectiveTotal = payment.discountAmount 
      ? payment.totalAmount.sub(payment.discountAmount)
      : payment.totalAmount;

    // Determinar nuevo estado
    let newStatus: PaymentStatus = 'PARTIAL';
    if (newPaidAmount.gte(effectiveTotal)) {
      newStatus = 'PAID';
    }

    // Crear transacción y actualizar pago
    const [transaction] = await this.prisma.$transaction([
      this.prisma.paymentTransaction.create({
        data: {
          studentPaymentId: dto.studentPaymentId,
          amount: amountDecimal,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference,
          observations: dto.observations,
          receivedById: dto.receivedById,
        },
      }),
      this.prisma.studentPayment.update({
        where: { id: dto.studentPaymentId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      }),
    ]);

    return this.getPaymentById(dto.studentPaymentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // APLICAR DESCUENTO
  // ═══════════════════════════════════════════════════════════════════════════

  async applyDiscount(dto: ApplyDiscountDto) {
    const payment = await this.prisma.studentPayment.findUnique({
      where: { id: dto.studentPaymentId },
    });

    if (!payment) {
      throw new NotFoundException('Registro de pago no encontrado');
    }

    const discountDecimal = new Prisma.Decimal(dto.discountAmount);
    
    // Si el descuento cubre todo, marcar como exento
    let newStatus = payment.status;
    if (discountDecimal.gte(payment.totalAmount)) {
      newStatus = 'EXEMPT';
    } else if (payment.paidAmount.add(discountDecimal).gte(payment.totalAmount)) {
      newStatus = 'PAID';
    }

    return this.prisma.studentPayment.update({
      where: { id: dto.studentPaymentId },
      data: {
        discountAmount: discountDecimal,
        discountReason: dto.discountReason,
        status: newStatus,
      },
      include: {
        student: true,
        event: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS Y REPORTES
  // ═══════════════════════════════════════════════════════════════════════════

  async getEventStats(eventId: string) {
    const payments = await this.prisma.studentPayment.findMany({
      where: { eventId },
    });

    const total = payments.length;
    const paid = payments.filter(p => p.status === 'PAID').length;
    const partial = payments.filter(p => p.status === 'PARTIAL').length;
    const pending = payments.filter(p => p.status === 'PENDING').length;
    const exempt = payments.filter(p => p.status === 'EXEMPT').length;

    const totalExpected = payments.reduce((sum, p) => sum.add(p.totalAmount), new Prisma.Decimal(0));
    const totalCollected = payments.reduce((sum, p) => sum.add(p.paidAmount), new Prisma.Decimal(0));
    const totalDiscounts = payments.reduce((sum, p) => sum.add(p.discountAmount || new Prisma.Decimal(0)), new Prisma.Decimal(0));

    return {
      total,
      byStatus: { paid, partial, pending, exempt },
      amounts: {
        expected: totalExpected.toNumber(),
        collected: totalCollected.toNumber(),
        discounts: totalDiscounts.toNumber(),
        pending: totalExpected.sub(totalCollected).sub(totalDiscounts).toNumber(),
      },
      percentageCollected: total > 0 
        ? (totalCollected.toNumber() / totalExpected.toNumber() * 100).toFixed(2)
        : 0,
    };
  }

  async getInstitutionStats(institutionId: string, academicYearId?: string) {
    const events = await this.prisma.paymentEvent.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        payments: true,
      },
    });

    let totalExpected = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalPending = 0;
    let totalPaid = 0;

    for (const event of events) {
      for (const payment of event.payments) {
        totalExpected = totalExpected.add(payment.totalAmount);
        totalCollected = totalCollected.add(payment.paidAmount);
        if (payment.status === 'PAID' || payment.status === 'EXEMPT') {
          totalPaid++;
        } else {
          totalPending++;
        }
      }
    }

    return {
      totalEvents: events.length,
      totalPayments: totalPaid + totalPending,
      paid: totalPaid,
      pending: totalPending,
      amounts: {
        expected: totalExpected.toNumber(),
        collected: totalCollected.toNumber(),
        pending: totalExpected.sub(totalCollected).toNumber(),
      },
    };
  }
}
