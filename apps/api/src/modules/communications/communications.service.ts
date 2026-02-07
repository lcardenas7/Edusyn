import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        institutionId: dto.institutionId,
        authorId,
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        recipients: {
          create: dto.recipients.map((r) => ({
            recipientType: r.type,
            recipientId: r.recipientId,
          })),
        },
      },
      include: {
        recipients: true,
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async update(id: string, dto: UpdateMessageDto) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: {
        type: dto.type,
        subject: dto.subject,
        content: dto.content,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      },
      include: {
        recipients: true,
      },
    });
  }

  async send(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    const message = await this.prisma.message.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');

    return this.prisma.message.delete({ where: { id } });
  }

  async getByInstitution(institutionId: string, status?: string) {
    return this.prisma.message.findMany({
      where: {
        institutionId,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        recipients: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        recipients: true,
      },
    });

    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async markAsRead(messageId: string, recipientId: string) {
    return this.prisma.messageRecipient.updateMany({
      where: {
        messageId,
        recipientId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  }

  /**
   * Retorna los destinatarios disponibles según el rol del remitente:
   * - ADMIN/COORDINADOR: todos los usuarios de la institución
   * - DOCENTE: docentes, coordinadores, admin + estudiantes/acudientes de sus grupos
   * - ESTUDIANTE: solo sus profesores
   * - ACUDIENTE: profesores de sus hijos, coordinador, admin
   */
  async getAvailableRecipients(
    userId: string,
    institutionId: string,
    userRoles: string[],
    search?: string,
  ) {
    const isAdmin = userRoles.some(r => r === 'ADMIN_INSTITUTIONAL' || r === 'SUPERADMIN');
    const isCoord = userRoles.includes('COORDINADOR');
    const isTeacher = userRoles.includes('DOCENTE');
    const isStudent = userRoles.includes('ESTUDIANTE');
    const isParent = userRoles.includes('ACUDIENTE');

    let allowedUserIds: string[] | null = null; // null = todos

    if (isAdmin || isCoord) {
      // Pueden enviar a cualquier usuario de la institución
      allowedUserIds = null;
    } else if (isTeacher) {
      // Docentes: otros docentes + coordinadores + admin + estudiantes de sus grupos
      const [staffIds, studentUserIds] = await Promise.all([
        this.getInstitutionUserIdsByRoles(institutionId, [
          'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE',
          'SECRETARIA', 'ORIENTADOR', 'BIBLIOTECARIO', 'AUXILIAR',
        ]),
        this.getStudentUserIdsForTeacher(userId),
      ]);
      allowedUserIds = [...new Set([...staffIds, ...studentUserIds])];
    } else if (isStudent) {
      // Estudiantes: solo sus profesores
      allowedUserIds = await this.getTeacherUserIdsForStudent(userId);
    } else if (isParent) {
      // Acudientes: profesores de sus hijos + coordinador + admin
      const [teacherIds, adminIds] = await Promise.all([
        this.getTeacherUserIdsForParent(userId),
        this.getInstitutionUserIdsByRoles(institutionId, ['ADMIN_INSTITUTIONAL', 'COORDINADOR']),
      ]);
      allowedUserIds = [...new Set([...teacherIds, ...adminIds])];
    } else {
      // Staff genérico: docentes + coordinadores + admin
      allowedUserIds = await this.getInstitutionUserIdsByRoles(institutionId, [
        'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE',
      ]);
    }

    // Excluir al propio usuario
    const excludeId = userId;

    // Construir query base
    const whereClause: any = {
      id: { not: excludeId },
      institutionUsers: { some: { institutionId } },
    };

    if (allowedUserIds !== null) {
      whereClause.id = { in: allowedUserIds.filter(id => id !== excludeId) };
    }

    if (search && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: {
          include: { role: { select: { name: true } } },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      take: 50,
    });

    return users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      roles: u.roles.map(r => r.role.name),
    }));
  }

  /**
   * Retorna las categorías masivas permitidas según el rol del remitente
   */
  getAllowedCategories(userRoles: string[]) {
    const isAdmin = userRoles.some(r => r === 'ADMIN_INSTITUTIONAL' || r === 'SUPERADMIN');
    const isCoord = userRoles.includes('COORDINADOR');
    const isTeacher = userRoles.includes('DOCENTE');

    if (isAdmin || isCoord) {
      return ['ALL', 'TEACHERS', 'STUDENTS', 'PARENTS', 'GROUP', 'INDIVIDUAL'];
    }
    if (isTeacher) {
      return ['TEACHERS', 'GROUP', 'INDIVIDUAL'];
    }
    // Estudiantes, acudientes, staff genérico: solo individual
    return ['INDIVIDUAL'];
  }

  // --- Helpers privados ---

  private async getInstitutionUserIdsByRoles(institutionId: string, roleNames: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        institutionUsers: { some: { institutionId } },
        roles: { some: { role: { name: { in: roleNames } } } },
      },
      select: { id: true },
    });
    return users.map(u => u.id);
  }

  private async getStudentUserIdsForTeacher(teacherUserId: string): Promise<string[]> {
    // Obtener grupos donde enseña el docente (año académico activo)
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId: teacherUserId },
      select: { groupId: true },
    });
    const groupIds = [...new Set(assignments.map(a => a.groupId))];
    if (groupIds.length === 0) return [];

    // Obtener estudiantes de esos grupos que tengan userId
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        groupId: { in: groupIds },
        status: 'ACTIVE',
        student: { userId: { not: null } },
      },
      select: { student: { select: { userId: true } } },
    });
    return enrollments.map(e => e.student.userId).filter(Boolean) as string[];
  }

  private async getTeacherUserIdsForStudent(studentUserId: string): Promise<string[]> {
    // Buscar el Student asociado a este userId
    const student = await this.prisma.student.findUnique({
      where: { userId: studentUserId },
      select: { id: true },
    });
    if (!student) return [];

    // Obtener grupo activo del estudiante
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { studentId: student.id, status: 'ACTIVE' },
      select: { groupId: true },
    });
    if (!enrollment) return [];

    // Obtener profesores de ese grupo
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { groupId: enrollment.groupId },
      select: { teacherId: true },
    });
    return [...new Set(assignments.map(a => a.teacherId))];
  }

  private async getTeacherUserIdsForParent(parentUserId: string): Promise<string[]> {
    // Un acudiente con rol ACUDIENTE: buscar sus hijos via Guardian
    // Primero intentar buscar Guardian por email del user
    const user = await this.prisma.user.findUnique({
      where: { id: parentUserId },
      select: { email: true },
    });
    if (!user?.email) return [];

    const guardian = await this.prisma.guardian.findFirst({
      where: { email: user.email },
      include: {
        students: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                  select: { groupId: true },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian) return [];

    const groupIds = guardian.students.flatMap(sg =>
      sg.student.enrollments.map(e => e.groupId)
    );
    if (groupIds.length === 0) return [];

    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { groupId: { in: [...new Set(groupIds)] } },
      select: { teacherId: true },
    });
    return [...new Set(assignments.map(a => a.teacherId))];
  }

  async getInbox(userId: string) {
    return this.prisma.messageRecipient.findMany({
      where: {
        OR: [
          { recipientId: userId },
          { recipientType: 'ALL_TEACHERS' },
          { recipientType: 'ALL_STUDENTS' },
        ],
      },
      include: {
        message: {
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
