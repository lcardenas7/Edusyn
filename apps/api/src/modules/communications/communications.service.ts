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

  // ═══════════════════════════════════════════════════════════════════════════
  // AISLAMIENTO MULTI-TENANT — punto único de control
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // `Message` tiene `institutionId` directo. `MessageRecipient` y `MessageAttachment` NO
  // lo tienen: derivan su pertenencia de `messageId -> Message.institutionId`, que es su
  // ÚNICA ruta de tenant (verificado en el schema). Por eso todas las comprobaciones
  // pasan por el mensaje (docs/security/RLS-AUDIT-COMMUNICATIONS.md).
  //
  // Seis operaciones —update, send, delete, reply, getById, getReplies— repetían
  // `findUnique({ where: { id } })` sin comprobar institución. La guarda vive en el
  // SERVICIO, no en el controlador: la lección de guardians es que pueden existir
  // caminos alternativos hacia el servicio.

  /** El mensaje debe existir DENTRO de la institución resuelta. */
  private async assertMessage(messageId: string, institutionId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, institutionId },
    });
    // Consulta acotada + el NotFoundException que este servicio ya usaba: no inventa
    // semántica nueva y no revela la existencia del mensaje ajeno.
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async create(authorId: string, dto: CreateMessageDto, institutionId: string) {
    return this.prisma.message.create({
      data: {
        // Institución resuelta por el servidor; dto.institutionId se ignora.
        institutionId,
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

  async update(id: string, dto: UpdateMessageDto, institutionId: string) {
    await this.assertMessage(id, institutionId);

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

  async send(id: string, institutionId: string) {
    await this.assertMessage(id, institutionId);

    return this.prisma.message.update({
      where: { id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async delete(id: string, institutionId: string) {
    await this.assertMessage(id, institutionId);

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

  async getById(id: string, institutionId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id, institutionId },
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

  async reply(parentId: string, authorId: string, content: string, institutionId: string) {
    // Sin esta guarda se podia inyectar un mensaje en la bandeja del autor de otra
    // institucion: la respuesta hereda parent.institutionId.
    const parent = await this.prisma.message.findFirst({
      where: { id: parentId, institutionId },
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

  async getReplies(messageId: string, institutionId: string) {
    await this.assertMessage(messageId, institutionId);
    return this.prisma.message.findMany({
      where: { parentId: messageId, status: 'SENT', institutionId },
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

  /**
   * Bandeja de entrada.
   *
   * ⚠️ P0 CORREGIDO. La version anterior emparejaba por
   * `recipientType: 'ALL_TEACHERS' | 'ALL_STUDENTS'` SIN filtrar por institucion ni por
   * rol, asi que toda comunicacion masiva de TODA institucion entraba en la bandeja de
   * TODOS los usuarios. No era una vulnerabilidad que hubiera que explotar: ocurria en
   * operacion normal, y ademas en cada carga de pagina, porque el contador de no leidos
   * de la barra de navegacion consume este mismo endpoint.
   *
   * Cada rama del OR lleva ahora su propio aislamiento Y su condicion de destinatario.
   * El filtro de institucion se repite ademas a nivel superior: esa es la garantia
   * estructural que protege cualquier rama que se anada en el futuro.
   *
   * ALCANCE DELIBERADO: no se anaden `ALL_PARENTS` ni `GROUP`. Hoy no se entregan a
   * nadie, y hacerlo funcionar seria un cambio de comportamiento del producto, no una
   * correccion de aislamiento. Queda documentado como deuda funcional.
   *
   * SuperAdmin: su token no trae institucion. Devuelve bandeja VACIA por diseno; no se
   * inventa un alcance global, porque convertiria la ausencia de tenant en privilegio de
   * lectura universal — el mismo patron de puerta trasera que ya corregimos en otros
   * modulos.
   */
  async getInbox(userId: string, institutionId: string | null, userRoles: string[] = []) {
    if (!institutionId) return [];

    const isTeacher = userRoles.includes('DOCENTE');
    const isStudent = userRoles.includes('ESTUDIANTE');

    const scope = { message: { institutionId } };
    const branches: any[] = [
      // Individual: dirigido explicitamente a este usuario.
      { ...scope, recipientId: userId },
      // Colectivos: solo si el rol del usuario corresponde a la categoria.
      ...(isTeacher ? [{ ...scope, recipientType: 'ALL_TEACHERS' as const }] : []),
      ...(isStudent ? [{ ...scope, recipientType: 'ALL_STUDENTS' as const }] : []),
    ];

    return this.prisma.messageRecipient.findMany({
      where: {
        ...scope,
        OR: branches,
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

  /**
   * ⚠️ Vulnerabilidad INDEPENDIENTE de la de getInbox, con el mismo error de modelo.
   * El predicado anterior daba por destinatario a cualquiera en cuanto el mensaje tuviera
   * UNA sola fila de difusion: `r.recipientType === 'ALL_TEACHERS'` es cierto sin mirar
   * quien pregunta. Era una comprobacion de autorizacion que no comprobaba nada.
   */
  async getAttachmentDownloadUrl(
    attachmentId: string,
    userId: string,
    institutionId: string | null,
    userRoles: string[] = [],
  ) {
    if (!institutionId) throw new NotFoundException('Adjunto no encontrado');

    // Consulta acotada: un adjunto de otra institucion no existe.
    const attachment = await this.prisma.messageAttachment.findFirst({
      where: { id: attachmentId, message: { institutionId } },
      include: { message: { include: { recipients: true } } },
    });
    if (!attachment) throw new NotFoundException('Adjunto no encontrado');

    const isTeacher = userRoles.includes('DOCENTE');
    const isStudent = userRoles.includes('ESTUDIANTE');

    // Verificar acceso: autor, destinatario individual, o difusion QUE CORRESPONDE A SU ROL.
    const isAuthor = attachment.message.authorId === userId;
    const isRecipient = attachment.message.recipients.some(
      r =>
        r.recipientId === userId ||
        (r.recipientType === 'ALL_TEACHERS' && isTeacher) ||
        (r.recipientType === 'ALL_STUDENTS' && isStudent),
    );
    if (!isAuthor && !isRecipient) {
      // Mismo error que antes para el caso "de mi institucion pero no soy destinatario":
      // no se cambia la semantica existente.
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
