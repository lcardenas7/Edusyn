import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
  LinkGuardianToStudentDto,
  CreateGuardianWithLinkDto
} from './dto/guardian.dto';

/**
 * Acudientes (PII) y su vínculo con estudiantes.
 *
 * ⚠️ AISLAMIENTO MULTI-TENANT — punto único de control.
 * Todos los métodos reciben `institutionId` YA RESUELTO POR EL SERVIDOR
 * (`requireInstitutionId` en el controlador). El `institutionId` que llegue en un DTO,
 * una query o un parámetro de ruta NO es una fuente de autoridad: para un usuario normal
 * se ignora, y solo el SuperAdmin puede indicar una institución explícita.
 *
 * Antes de este endurecimiento (docs/security/RLS-AUDIT-FASE0.3.md):
 *   · `list()` construía `where: { ...(institutionId && { institutionId }) }`, así que
 *     OMITIR el parámetro eliminaba el filtro y devolvía los acudientes de TODA la
 *     plataforma, con sus estudiantes, a cualquier usuario autenticado.
 *   · Los métodos por id no comprobaban pertenencia: conocer un id bastaba para leer,
 *     editar o borrar el acudiente de otra institución.
 *   · `linkToStudent`/`createWithLink` permitían unir un acudiente de A con un estudiante
 *     de B. `StudentGuardian` no tiene `institutionId` propio y deriva su pertenencia de
 *     ambos extremos, así que un vínculo cruzado deja esos extremos en desacuerdo
 *     permanente — una fila que la futura política RLS vería desde un lado y no desde el
 *     otro. Por eso el vínculo cruzado se rechaza aquí, en la capa de aplicación.
 *
 * Las comprobaciones de pertenencia usan consultas ACOTADAS (`findFirst` con
 * `institutionId`) y lanzan el `NotFoundException` que este servicio ya usaba: no
 * inventan semántica nueva y no revelan la existencia del recurso ajeno.
 */
@Injectable()
export class GuardiansService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // Comprobaciones de pertenencia
  // ═══════════════════════════════════════════════════════════════════════════

  /** El acudiente debe existir DENTRO de la institución resuelta. */
  private async assertGuardianInInstitution(guardianId: string, institutionId: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id: guardianId, institutionId },
      select: { id: true },
    });
    if (!guardian) throw new NotFoundException('Acudiente no encontrado');
    return guardian;
  }

  /** El estudiante debe existir DENTRO de la institución resuelta. */
  private async assertStudentInInstitution(studentId: string, institutionId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, institutionId },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    return student;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Alta
  // ═══════════════════════════════════════════════════════════════════════════

  async create(dto: CreateGuardianDto, institutionId: string) {
    return this.prisma.guardian.create({
      data: {
        // Institución resuelta por el servidor; se ignora dto.institutionId.
        institutionId,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        firstName: dto.firstName,
        secondName: dto.secondName,
        lastName: dto.lastName,
        secondLastName: dto.secondLastName,
        phone: dto.phone,
        alternatePhone: dto.alternatePhone,
        email: dto.email,
        address: dto.address,
        neighborhood: dto.neighborhood,
        city: dto.city,
        occupation: dto.occupation,
        workplace: dto.workplace,
        workPhone: dto.workPhone,
        workAddress: dto.workAddress,
      },
    });
  }

  async createWithLink(dto: CreateGuardianWithLinkDto, institutionId: string) {
    // El estudiante debe pertenecer a la institución resuelta: impide crear el vínculo
    // cruzado A↔B por la vía del alta.
    await this.assertStudentInInstitution(dto.studentId, institutionId);

    // Verificar si el acudiente ya existe por documento
    let guardian = await this.prisma.guardian.findUnique({
      where: {
        institutionId_documentNumber: {
          institutionId,
          documentNumber: dto.documentNumber,
        },
      },
    });

    if (!guardian) {
      guardian = await this.prisma.guardian.create({
        data: {
          institutionId,
          documentType: dto.documentType,
          documentNumber: dto.documentNumber,
          firstName: dto.firstName,
          secondName: dto.secondName,
          lastName: dto.lastName,
          secondLastName: dto.secondLastName,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          email: dto.email,
          address: dto.address,
          neighborhood: dto.neighborhood,
          city: dto.city,
          occupation: dto.occupation,
          workplace: dto.workplace,
          workPhone: dto.workPhone,
          workAddress: dto.workAddress,
        },
      });
    }

    // Si es acudiente principal, quitar el flag de otros acudientes del estudiante
    if (dto.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: { studentId: dto.studentId },
        data: { isPrimary: false },
      });
    }

    // Crear o actualizar la relación
    const link = await this.prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: dto.studentId,
          guardianId: guardian.id,
        },
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
      },
      create: {
        studentId: dto.studentId,
        guardianId: guardian.id,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
      },
      include: {
        guardian: true,
        student: true,
      },
    });

    return link;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Consulta
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * `institutionId` es OBLIGATORIO y no admite `undefined`: omitirlo era exactamente el
   * fallo que permitía volcar los acudientes de toda la plataforma.
   */
  async list(params: { institutionId: string; search?: string }) {
    const { institutionId, search } = params;

    if (!institutionId) {
      throw new BadRequestException('No se pudo determinar la institución.');
    }

    return this.prisma.guardian.findMany({
      where: {
        institutionId,
        ...(search && {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
      },
      include: {
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                documentNumber: true,
              },
            },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });
  }

  async findById(id: string, institutionId: string) {
    // Consulta acotada: un acudiente de otra institución simplemente "no existe".
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, institutionId },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  include: {
                    group: {
                      include: {
                        grade: true,
                      },
                    },
                    academicYear: true,
                  },
                  orderBy: {
                    academicYear: { year: 'desc' },
                  },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!guardian) {
      throw new NotFoundException('Acudiente no encontrado');
    }

    return guardian;
  }

  async findByStudent(studentId: string, institutionId: string) {
    await this.assertStudentInInstitution(studentId, institutionId);

    return this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: {
        guardian: true,
      },
      orderBy: [
        { isPrimary: 'desc' },
        { guardian: { lastName: 'asc' } },
      ],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Modificación y baja
  // ═══════════════════════════════════════════════════════════════════════════

  async update(id: string, dto: UpdateGuardianDto, institutionId: string) {
    await this.assertGuardianInInstitution(id, institutionId);

    return this.prisma.guardian.update({
      where: { id },
      data: {
        ...(dto.documentType && { documentType: dto.documentType }),
        ...(dto.documentNumber && { documentNumber: dto.documentNumber }),
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.secondName !== undefined && { secondName: dto.secondName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.secondLastName !== undefined && { secondLastName: dto.secondLastName }),
        ...(dto.phone && { phone: dto.phone }),
        ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.neighborhood !== undefined && { neighborhood: dto.neighborhood }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.occupation !== undefined && { occupation: dto.occupation }),
        ...(dto.workplace !== undefined && { workplace: dto.workplace }),
        ...(dto.workPhone !== undefined && { workPhone: dto.workPhone }),
        ...(dto.workAddress !== undefined && { workAddress: dto.workAddress }),
      },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.assertGuardianInInstitution(id, institutionId);

    return this.prisma.guardian.delete({
      where: { id },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Vínculo estudiante ↔ acudiente
  // ═══════════════════════════════════════════════════════════════════════════

  async linkToStudent(dto: LinkGuardianToStudentDto, institutionId: string) {
    // AMBOS extremos deben pertenecer a la institución resuelta. Un vínculo A↔B queda
    // rechazado aquí; ver la nota sobre StudentGuardian en la cabecera del servicio.
    const [student, guardian] = await Promise.all([
      this.prisma.student.findFirst({
        where: { id: dto.studentId, institutionId },
        select: { id: true },
      }),
      this.prisma.guardian.findFirst({
        where: { id: dto.guardianId, institutionId },
        select: { id: true },
      }),
    ]);

    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (!guardian) throw new NotFoundException('Acudiente no encontrado');

    // Si es acudiente principal, quitar el flag de otros
    if (dto.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: { studentId: dto.studentId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.studentGuardian.upsert({
      where: {
        studentId_guardianId: {
          studentId: dto.studentId,
          guardianId: dto.guardianId,
        },
      },
      update: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        receivesNotifications: dto.receivesNotifications ?? true,
        receivesGrades: dto.receivesGrades ?? true,
      },
      create: {
        studentId: dto.studentId,
        guardianId: dto.guardianId,
        relationship: dto.relationship,
        isPrimary: dto.isPrimary ?? false,
        canPickUp: dto.canPickUp ?? true,
        isEmergencyContact: dto.isEmergencyContact ?? false,
        receivesNotifications: dto.receivesNotifications ?? true,
        receivesGrades: dto.receivesGrades ?? true,
      },
      include: {
        guardian: true,
        student: true,
      },
    });
  }

  async unlinkFromStudent(studentId: string, guardianId: string, institutionId: string) {
    await Promise.all([
      this.assertStudentInInstitution(studentId, institutionId),
      this.assertGuardianInInstitution(guardianId, institutionId),
    ]);

    return this.prisma.studentGuardian.delete({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
    });
  }

  async updateLink(
    studentId: string,
    guardianId: string,
    data: Partial<LinkGuardianToStudentDto>,
    institutionId: string,
  ) {
    // `updateLink` puede activar receivesGrades/receivesNotifications: sin esta guarda,
    // se podía encaminar el boletín de un estudiante ajeno hacia un tercero.
    await Promise.all([
      this.assertStudentInInstitution(studentId, institutionId),
      this.assertGuardianInInstitution(guardianId, institutionId),
    ]);

    // Si se marca como principal, quitar de otros
    if (data.isPrimary) {
      await this.prisma.studentGuardian.updateMany({
        where: {
          studentId,
          guardianId: { not: guardianId },
        },
        data: { isPrimary: false },
      });
    }

    return this.prisma.studentGuardian.update({
      where: {
        studentId_guardianId: {
          studentId,
          guardianId,
        },
      },
      data: {
        ...(data.relationship && { relationship: data.relationship }),
        ...(data.isPrimary !== undefined && { isPrimary: data.isPrimary }),
        ...(data.canPickUp !== undefined && { canPickUp: data.canPickUp }),
        ...(data.isEmergencyContact !== undefined && { isEmergencyContact: data.isEmergencyContact }),
        ...(data.receivesNotifications !== undefined && { receivesNotifications: data.receivesNotifications }),
        ...(data.receivesGrades !== undefined && { receivesGrades: data.receivesGrades }),
      },
      include: {
        guardian: true,
      },
    });
  }
}
