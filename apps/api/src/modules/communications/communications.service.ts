import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

@Injectable()
export class CommunicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
  ) {}

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

  async getByInstitution(institutionId: string, status?: string, authorId?: string) {
    return this.prisma.message.findMany({
      where: {
        institutionId,
        ...(status ? { status: status as any } : {}),
        ...(authorId ? { authorId } : {}),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true },
        },
        recipients: true,
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
        },
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
        attachments: {
          select: { id: true, fileName: true, fileSize: true, mimeType: true, createdAt: true },
        },
        replies: {
          where: { status: 'SENT' },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async reply(parentId: string, authorId: string, content: string) {
    const parent = await this.prisma.message.findUnique({
      where: { id: parentId },
      include: { author: true },
    });
    if (!parent) throw new NotFoundException('Mensaje original no encontrado');

    // Crear la respuesta como mensaje directo al autor del mensaje original
    const reply = await this.prisma.message.create({
      data: {
        institutionId: parent.institutionId,
        authorId,
        parentId,
        type: parent.type,
        subject: parent.subject.startsWith('Re: ') ? parent.subject : `Re: ${parent.subject}`,
        content,
        status: 'SENT',
        sentAt: new Date(),
        recipients: {
          create: [{ recipientType: 'USER', recipientId: parent.authorId }],
        },
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
      },
    });

    return reply;
  }

  async getReplies(messageId: string) {
    return this.prisma.message.findMany({
      where: { parentId: messageId, status: 'SENT' },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        attachments: { select: { id: true, fileName: true, fileSize: true, mimeType: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
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
            attachments: {
              select: { id: true, fileName: true, fileSize: true, mimeType: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADJUNTOS
  // ═══════════════════════════════════════════════════════════════════════════

  async uploadAttachment(messageId: string, userId: string, file: Express.Multer.File) {
    const message = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!message) throw new NotFoundException('Mensaje no encontrado');
    if (message.authorId !== userId) {
      throw new BadRequestException('Solo el autor puede agregar adjuntos');
    }
    if (message.status === 'SENT') {
      throw new BadRequestException('No se pueden agregar adjuntos a mensajes ya enviados');
    }

    // Verificar límite de adjuntos por mensaje
    const currentCount = await this.prisma.messageAttachment.count({ where: { messageId } });
    if (currentCount >= SupabaseStorageService.MESSAGE_MAX_ATTACHMENTS) {
      throw new BadRequestException(
        `Máximo ${SupabaseStorageService.MESSAGE_MAX_ATTACHMENTS} adjuntos por mensaje`,
      );
    }

    // Subir a Supabase
    const result = await this.storage.uploadMessageAttachment(
      message.institutionId,
      messageId,
      file,
    );

    // Guardar referencia en BD
    return this.prisma.messageAttachment.create({
      data: {
        messageId,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storagePath: result.path,
      },
    });
  }

  async removeAttachment(attachmentId: string, userId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: true },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');
    if (attachment.message.authorId !== userId) {
      throw new BadRequestException('Solo el autor puede eliminar adjuntos');
    }
    if (attachment.message.status === 'SENT') {
      throw new BadRequestException('No se pueden eliminar adjuntos de mensajes ya enviados');
    }

    // Eliminar de Supabase
    await this.storage.deleteFile(this.storage.buckets.mensajes, attachment.storagePath);

    // Eliminar de BD
    return this.prisma.messageAttachment.delete({ where: { id: attachmentId } });
  }

  async getAttachmentDownloadUrl(attachmentId: string, userId: string) {
    const attachment = await this.prisma.messageAttachment.findUnique({
      where: { id: attachmentId },
      include: { message: { include: { recipients: true } } },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    // Verificar acceso: autor o destinatario
    const isAuthor = attachment.message.authorId === userId;
    const isRecipient = attachment.message.recipients.some(
      r => r.recipientId === userId || r.recipientType === 'ALL_TEACHERS' || r.recipientType === 'ALL_STUDENTS',
    );
    if (!isAuthor && !isRecipient) {
      throw new BadRequestException('No tienes acceso a este adjunto');
    }

    const url = await this.storage.getSignedUrlForBucket(
      this.storage.buckets.mensajes,
      attachment.storagePath,
    );

    return { url, fileName: attachment.fileName, mimeType: attachment.mimeType };
  }

  /**
   * Devuelve el uso de almacenamiento de adjuntos para una institución
   */
  async getStorageUsage(institutionId: string) {
    const result = await this.prisma.messageAttachment.aggregate({
      where: { message: { institutionId } },
      _sum: { fileSize: true },
      _count: true,
    });

    const usedBytes = result._sum.fileSize || 0;
    const totalFiles = result._count;
    const limitBytes = 500 * 1024 * 1024; // 500 MB por institución

    return {
      usedBytes,
      usedMB: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
      totalFiles,
      limitMB: 500,
      percentUsed: Math.round((usedBytes / limitBytes) * 10000) / 100,
    };
  }
}
