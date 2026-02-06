import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ThirdPartyType, Prisma, DocumentType } from '@prisma/client';
import { CreateThirdPartyDto, UpdateThirdPartyDto, SyncThirdPartiesDto } from './dto';

@Injectable()
export class ThirdPartiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, filters?: {
    type?: ThirdPartyType;
    search?: string;
    isActive?: boolean;
  }) {
    const where: Prisma.FinancialThirdPartyWhereInput = {
      institutionId,
      ...(filters?.type && { type: filters.type }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters?.search && {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { document: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      }),
    };

    return this.prisma.financialThirdParty.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            obligations: true,
            payments: true,
          },
        },
      },
    });
  }

  async findOne(id: string, institutionId: string) {
    const thirdParty = await this.prisma.financialThirdParty.findFirst({
      where: { id, institutionId },
      include: {
        obligations: {
          include: { concept: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 10,
        },
      },
    });

    if (!thirdParty) {
      throw new NotFoundException('Tercero no encontrado');
    }

    return thirdParty;
  }

  async create(institutionId: string, dto: CreateThirdPartyDto) {
    // Verificar si ya existe un tercero con el mismo referenceId
    if (dto.referenceId) {
      const existing = await this.prisma.financialThirdParty.findFirst({
        where: {
          institutionId,
          type: dto.type,
          referenceId: dto.referenceId,
        },
      });

      if (existing) {
        throw new BadRequestException('Ya existe un tercero con esta referencia');
      }
    }

    return this.prisma.financialThirdParty.create({
      data: {
        institutionId,
        ...dto,
      },
    });
  }

  async update(id: string, institutionId: string, dto: UpdateThirdPartyDto) {
    const thirdParty = await this.findOne(id, institutionId);

    return this.prisma.financialThirdParty.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, institutionId: string) {
    const thirdParty = await this.findOne(id, institutionId);

    // Verificar si tiene obligaciones o pagos
    const hasRelations = await this.prisma.financialThirdParty.findFirst({
      where: { id },
      include: {
        _count: {
          select: {
            obligations: true,
            payments: true,
          },
        },
      },
    });

    if (hasRelations && (hasRelations._count.obligations > 0 || hasRelations._count.payments > 0)) {
      // Soft delete - solo desactivar
      return this.prisma.financialThirdParty.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete si no tiene relaciones
    return this.prisma.financialThirdParty.delete({
      where: { id },
    });
  }

  // Sincronizar terceros desde módulo académico
  async syncFromAcademic(institutionId: string, dto: SyncThirdPartiesDto) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
    };

    if (dto.syncStudents) {
      const students = await this.prisma.student.findMany({
        where: { institutionId, isActive: true },
        include: {
          enrollments: {
            where: { status: 'ACTIVE' },
            include: { group: { include: { grade: true } } },
            take: 1,
          },
        },
      });

      for (const student of students) {
        const existing = await this.prisma.financialThirdParty.findFirst({
          where: {
            institutionId,
            type: 'STUDENT',
            referenceId: student.id,
          },
        });

        if (existing) {
          await this.prisma.financialThirdParty.update({
            where: { id: existing.id },
            data: {
              name: `${student.firstName} ${student.lastName}`,
              document: student.documentNumber,
              documentType: student.documentType as DocumentType,
              email: student.email,
              phone: student.phone,
            },
          });
          results.updated++;
        } else {
          await this.prisma.financialThirdParty.create({
            data: {
              institutionId,
              type: 'STUDENT',
              referenceId: student.id,
              name: `${student.firstName} ${student.lastName}`,
              document: student.documentNumber,
              documentType: student.documentType as DocumentType,
              email: student.email,
              phone: student.phone,
            },
          });
          results.created++;
        }
      }
    }

    if (dto.syncTeachers) {
      const teachers = await this.prisma.institutionUser.findMany({
        where: {
          institutionId,
          isActive: true,
          user: {
            roles: {
              some: {
                role: { name: { contains: 'DOCENTE' } },
              },
            },
          },
        },
        include: { user: true },
      });

      for (const teacher of teachers) {
        const existing = await this.prisma.financialThirdParty.findFirst({
          where: {
            institutionId,
            type: 'TEACHER',
            referenceId: teacher.userId,
          },
        });

        if (existing) {
          await this.prisma.financialThirdParty.update({
            where: { id: existing.id },
            data: {
              name: `${teacher.user.firstName} ${teacher.user.lastName}`,
              document: teacher.user.documentNumber,
              documentType: teacher.user.documentType,
              email: teacher.user.email,
              phone: teacher.user.phone,
            },
          });
          results.updated++;
        } else {
          await this.prisma.financialThirdParty.create({
            data: {
              institutionId,
              type: 'TEACHER',
              referenceId: teacher.userId,
              name: `${teacher.user.firstName} ${teacher.user.lastName}`,
              document: teacher.user.documentNumber,
              documentType: teacher.user.documentType,
              email: teacher.user.email,
              phone: teacher.user.phone,
            },
          });
          results.created++;
        }
      }
    }

    if (dto.syncGuardians) {
      const guardians = await this.prisma.guardian.findMany({
        where: { institutionId },
      });

      for (const guardian of guardians) {
        const existing = await this.prisma.financialThirdParty.findFirst({
          where: {
            institutionId,
            type: 'GUARDIAN',
            referenceId: guardian.id,
          },
        });

        if (existing) {
          await this.prisma.financialThirdParty.update({
            where: { id: existing.id },
            data: {
              name: `${guardian.firstName} ${guardian.lastName}`,
              document: guardian.documentNumber,
              documentType: guardian.documentType,
              email: guardian.email,
              phone: guardian.phone,
            },
          });
          results.updated++;
        } else {
          await this.prisma.financialThirdParty.create({
            data: {
              institutionId,
              type: 'GUARDIAN',
              referenceId: guardian.id,
              name: `${guardian.firstName} ${guardian.lastName}`,
              document: guardian.documentNumber,
              documentType: guardian.documentType,
              email: guardian.email,
              phone: guardian.phone,
            },
          });
          results.created++;
        }
      }
    }

    return results;
  }

  // Obtener terceros por tipo para selección en UI
  async getByType(institutionId: string, type: ThirdPartyType) {
    return this.prisma.financialThirdParty.findMany({
      where: { institutionId, type, isActive: true },
      select: {
        id: true,
        name: true,
        document: true,
        referenceId: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // Obtener resumen financiero de un tercero
  async getFinancialSummary(id: string, institutionId: string) {
    const thirdParty = await this.findOne(id, institutionId);

    const [obligations, payments] = await Promise.all([
      this.prisma.financialObligation.aggregate({
        where: { thirdPartyId: id },
        _sum: {
          totalAmount: true,
          paidAmount: true,
          balance: true,
        },
        _count: true,
      }),
      this.prisma.financialPayment.aggregate({
        where: { thirdPartyId: id, voidedAt: null },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      thirdParty,
      summary: {
        totalObligations: obligations._count,
        totalCharged: obligations._sum.totalAmount || 0,
        totalPaid: obligations._sum.paidAmount || 0,
        totalBalance: obligations._sum.balance || 0,
        totalPayments: payments._count,
      },
    };
  }
}
