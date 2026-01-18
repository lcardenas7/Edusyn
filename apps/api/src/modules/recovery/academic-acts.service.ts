import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademicActType } from '@prisma/client';

@Injectable()
export class AcademicActsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    institutionId: string;
    academicYearId: string;
    actType: AcademicActType;
    actNumber: string;
    actDate: Date;
    title: string;
    content: string;
    decisions?: string;
    attendees?: string;
    studentEnrollmentId?: string;
    finalRecoveryPlanId?: string;
    createdById: string;
  }) {
    return this.prisma.academicAct.create({
      data,
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        finalRecoveryPlan: {
          include: { area: true },
        },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findByInstitution(
    institutionId: string,
    academicYearId?: string,
    actType?: AcademicActType,
  ) {
    return this.prisma.academicAct.findMany({
      where: {
        institutionId,
        ...(academicYearId && { academicYearId }),
        ...(actType && { actType }),
      },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        finalRecoveryPlan: {
          include: { area: true },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { actDate: 'desc' },
    });
  }

  async findByStudent(studentEnrollmentId: string) {
    return this.prisma.academicAct.findMany({
      where: { studentEnrollmentId },
      include: {
        academicYear: true,
        finalRecoveryPlan: {
          include: { area: true },
        },
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { actDate: 'desc' },
    });
  }

  async approve(id: string, approvedById: string) {
    return this.prisma.academicAct.update({
      where: { id },
      data: {
        approvedById,
        approvalDate: new Date(),
      },
    });
  }

  async generateNextActNumber(
    institutionId: string,
    academicYearId: string,
    actType: AcademicActType,
  ) {
    const count = await this.prisma.academicAct.count({
      where: {
        institutionId,
        academicYearId,
        actType,
      },
    });

    const year = new Date().getFullYear();
    const prefix = this.getActPrefix(actType);
    return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private getActPrefix(actType: AcademicActType): string {
    switch (actType) {
      case 'ACADEMIC_COUNCIL':
        return 'CA';
      case 'PROMOTION':
        return 'AP';
      case 'RECOVERY_APPROVAL':
        return 'AR';
      case 'FINAL_DECISION':
        return 'DF';
      default:
        return 'AC';
    }
  }

  async generatePromotionAct(data: {
    institutionId: string;
    academicYearId: string;
    studentEnrollmentId: string;
    finalRecoveryPlanId?: string;
    decision: string;
    attendees: string;
    createdById: string;
  }) {
    const actNumber = await this.generateNextActNumber(
      data.institutionId,
      data.academicYearId,
      'PROMOTION',
    );

    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: data.studentEnrollmentId },
      include: {
        student: true,
        group: { include: { grade: true } },
        academicYear: true,
      },
    });

    if (!enrollment) throw new Error('Enrollment not found');

    const content = `
ACTA DE PROMOCIÓN

Estudiante: ${enrollment.student.firstName} ${enrollment.student.lastName}
Documento: ${enrollment.student.documentType} ${enrollment.student.documentNumber}
Grado: ${enrollment.group.grade?.name} - ${enrollment.group.name}
Año Lectivo: ${enrollment.academicYear.year}

DECISIÓN:
${data.decision}

ASISTENTES:
${data.attendees}

Fecha: ${new Date().toLocaleDateString('es-CO')}
    `.trim();

    return this.create({
      institutionId: data.institutionId,
      academicYearId: data.academicYearId,
      actType: 'PROMOTION',
      actNumber,
      actDate: new Date(),
      title: `Acta de Promoción - ${enrollment.student.firstName} ${enrollment.student.lastName}`,
      content,
      decisions: data.decision,
      attendees: data.attendees,
      studentEnrollmentId: data.studentEnrollmentId,
      finalRecoveryPlanId: data.finalRecoveryPlanId,
      createdById: data.createdById,
    });
  }

  async generateAcademicCouncilAct(data: {
    institutionId: string;
    academicYearId: string;
    title: string;
    agenda: string;
    decisions: string;
    attendees: string;
    createdById: string;
  }) {
    const actNumber = await this.generateNextActNumber(
      data.institutionId,
      data.academicYearId,
      'ACADEMIC_COUNCIL',
    );

    const content = `
ACTA DE CONSEJO ACADÉMICO

ORDEN DEL DÍA:
${data.agenda}

DECISIONES:
${data.decisions}

ASISTENTES:
${data.attendees}

Fecha: ${new Date().toLocaleDateString('es-CO')}
    `.trim();

    return this.create({
      institutionId: data.institutionId,
      academicYearId: data.academicYearId,
      actType: 'ACADEMIC_COUNCIL',
      actNumber,
      actDate: new Date(),
      title: data.title,
      content,
      decisions: data.decisions,
      attendees: data.attendees,
      createdById: data.createdById,
    });
  }
}
