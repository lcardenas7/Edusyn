import { randomUUID } from 'crypto';

import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GradeAuditActor, GradeAuditService } from './grade-audit.service';
import { PeriodFinalGradeWriter } from './period-final-grade.writer';
import {
  CausalNotaFinal,
  decidirEscrituraNotaFinal,
  mensajeDeRechazo,
} from './period-final-grade-policy';

/**
 * Quién escribe, según la SESIÓN. La institución nunca llega en el cuerpo de la
 * petición: se deriva aquí y lo recibido solo se contrasta contra ella.
 */
export interface QuienEscribe {
  userId: string;
  roles: readonly string[];
  esSuperAdmin?: boolean;
  institutionId: string;
}

/** Origen de auditoría de esta superficie: la nota final del período. */
const AUDIT_SOURCE = 'PERIOD_FINAL_GRADE';

@Injectable()
export class PeriodFinalGradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gradeAudit: GradeAuditService,
    private readonly writer: PeriodFinalGradeWriter,
  ) {}

  /**
   * Valida que el período NO esté FINALIZED.
   * Lanza ForbiddenException si está congelado.
   */
  private async guardTermNotFinalized(academicTermId: string): Promise<void> {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      select: { status: true },
    });

    if (term?.status === 'FINALIZED') {
      throw new ForbiddenException(
        'El período está finalizado. Debe reabrirse formalmente para modificar notas.',
      );
    }
  }

  /**
   * Reúne los hechos que la política necesita y aplica su decisión.
   *
   * Las cuatro consultas van en paralelo y piden SOLO la institución de cada
   * recurso: basta para contrastarlos contra la sesión, y no arrastra datos
   * personales a una comprobación de permisos.
   */
  private async autorizarEscritura(
    data: { studentEnrollmentId: string; academicTermId: string; subjectId: string; reason?: unknown },
    quien: QuienEscribe,
  ): Promise<CausalNotaFinal | undefined> {
    const [matricula, periodo, asignatura, institucion] = await Promise.all([
      this.prisma.studentEnrollment.findUnique({
        where: { id: data.studentEnrollmentId },
        select: { institutionId: true, groupId: true },
      }),
      // El período y la asignatura no llevan la institución encima: se alcanza
      // por su año académico y por su área respectivamente.
      this.prisma.academicTerm.findUnique({
        where: { id: data.academicTermId },
        select: { status: true, academicYear: { select: { institutionId: true } } },
      }),
      this.prisma.subject.findUnique({
        where: { id: data.subjectId },
        select: { area: { select: { institutionId: true } } },
      }),
      this.prisma.institution.findUnique({
        where: { id: quien.institutionId },
        select: { allowTeacherFinalGradeOverride: true },
      }),
    ]);

    // La titularidad solo se consulta si hace falta: un supervisor no la
    // necesita, y una consulta de más en cada guardado masivo se nota.
    let esTitular = false;
    if (matricula?.groupId) {
      const asignacion = await this.prisma.teacherAssignment.findFirst({
        where: {
          teacherId: quien.userId,
          groupId: matricula.groupId,
          subjectId: data.subjectId,
          institutionId: quien.institutionId,
          OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
        },
        select: { id: true },
      });
      esTitular = Boolean(asignacion);
    }

    const decision = decidirEscrituraNotaFinal({
      roles: quien.roles,
      esSuperAdmin: quien.esSuperAdmin,
      institucionSesion: quien.institutionId,
      institucionMatricula: matricula?.institutionId ?? null,
      institucionPeriodo: periodo?.academicYear?.institutionId ?? null,
      institucionAsignatura: asignatura?.area?.institutionId ?? null,
      periodoFinalizado: periodo?.status === 'FINALIZED',
      habilitacionInstitucional: institucion?.allowTeacherFinalGradeOverride ?? false,
      esTitular,
      causal: data.reason,
    });

    if (decision.permitido) return decision.causalRegistrada;

    const mensaje = mensajeDeRechazo(decision.motivo!);
    // Un recurso de otra institución se trata como inexistente: prohibirlo
    // confirmaría que existe.
    if (decision.motivo === 'FUERA_DE_INSTITUCION') throw new NotFoundException(mensaje);
    if (decision.motivo === 'CAUSAL_INVALIDA') throw new BadRequestException(mensaje);
    throw new ForbiddenException(mensaje);
  }

  async upsert(
    data: {
      studentEnrollmentId: string;
      academicTermId: string;
      subjectId: string;
      finalScore: number;
      observations?: string;
      enteredById: string;
      reason?: unknown;
    },
    quien: QuienEscribe,
    actor?: GradeAuditActor,
    batchId?: string,
  ) {
    const causal = await this.autorizarEscritura(data, quien);
    // `reason` es un dato de la decisión, no una columna de la nota: viaja a la
    // auditoría y no debe llegar a Prisma.
    const { reason: _causalRecibida, ...datosNota } = data;
    const key = {
      studentEnrollmentId: data.studentEnrollmentId,
      academicTermId: data.academicTermId,
      subjectId: data.subjectId,
    };
    // Lectura previa: `upsert` no distingue alta de modificación y descarta el
    // valor anterior, que es justo lo que da valor forense al rastro.
    const prev = await this.prisma.periodFinalGrade.findUnique({
      where: { studentEnrollmentId_academicTermId_subjectId: key },
      select: { id: true, finalScore: true, institutionId: true },
    });
    const result = await this.writer.upsert({
      clave: key,
      institutionId: quien.institutionId,
      finalScore: data.finalScore,
      observations: data.observations,
      enteredById: data.enteredById,
      // Escritura manual = fijada; el recálculo no la pisa.
      isManualOverride: true,
      contexto: { origen: 'MANUAL', causal, batchId, actor },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        academicTerm: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
    });

    return result;
  }

  async findByGroup(groupId: string, academicTermId: string) {
    return this.prisma.periodFinalGrade.findMany({
      where: {
        academicTermId,
        studentEnrollment: {
          groupId,
        },
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
        { studentEnrollment: { student: { secondLastName: 'asc' } } },
        { studentEnrollment: { student: { firstName: 'asc' } } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  async findByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.periodFinalGrade.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      include: {
        subject: true,
        academicTerm: true,
        enteredBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { subject: { name: 'asc' } },
    });
  }

  async delete(id: string, quien: QuienEscribe, reason?: unknown, actor?: GradeAuditActor) {
    const grade = await this.prisma.periodFinalGrade.findUnique({
      where: { id },
      select: {
        academicTermId: true,
        finalScore: true,
        institutionId: true,
        studentEnrollmentId: true,
        subjectId: true,
      },
    });
    // Un registro de otra institución se trata como inexistente.
    if (!grade || grade.institutionId !== quien.institutionId) {
      throw new NotFoundException('Registro no encontrado.');
    }
    // Borrar una nota final es una escritura como cualquier otra y pasa por la
    // misma puerta.
    const causalBorrado = await this.autorizarEscritura(
      {
        studentEnrollmentId: grade.studentEnrollmentId,
        academicTermId: grade.academicTermId,
        subjectId: grade.subjectId,
        reason,
      },
      quien,
    );
    const result = await this.writer.eliminarPorId(id, {
      origen: 'MANUAL',
      causal: causalBorrado,
      actor,
    });

    return result;
  }

  async bulkUpsert(
    grades: Array<{
      studentEnrollmentId: string;
      academicTermId: string;
      subjectId: string;
      finalScore: number;
      observations?: string;
    }>,
    enteredById: string,
    quien: QuienEscribe,
    actor?: GradeAuditActor,
  ) {
    // Toda la carga masiva comparte correlación: ocurrió como una sola acción.
    const batchId = randomUUID();
    const results: any[] = [];
    for (const grade of grades) {
      const result = await this.upsert({ ...grade, enteredById }, quien, actor, batchId);
      results.push(result);
    }
    return results;
  }
}
