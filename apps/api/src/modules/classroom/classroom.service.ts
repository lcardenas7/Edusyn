import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClassroomService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSROOMS
  // ═══════════════════════════════════════════════════════════════════════════

  async listForTeacher(teacherId: string, institutionId: string) {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId, institutionId, endDate: null },
      select: { id: true },
    });
    const assignmentIds = assignments.map(a => a.id);

    const classrooms = await this.prisma.classroom.findMany({
      where: { teacherAssignmentId: { in: assignmentIds }, isActive: true },
      include: {
        teacherAssignment: {
          include: {
            group: { include: { grade: true } },
            subject: true,
          },
        },
        _count: {
          select: { sections: true, activities: true, announcements: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with student count
    const result = await Promise.all(
      classrooms.map(async (c) => {
        const studentCount = await this.prisma.studentEnrollment.count({
          where: {
            groupId: c.teacherAssignment.groupId,
            academicYearId: c.teacherAssignment.academicYearId,
            status: 'ACTIVE',
          },
        });
        return { ...c, studentCount };
      }),
    );

    return result;
  }

  async listForStudent(studentId: string, institutionId: string) {
    // Find active enrollments
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { student: { userId: studentId }, institutionId, status: 'ACTIVE' },
      select: { groupId: true, academicYearId: true },
    });

    if (enrollments.length === 0) return [];

    // Find classrooms for the student's groups
    const classrooms = await this.prisma.classroom.findMany({
      where: {
        isActive: true,
        teacherAssignment: {
          OR: enrollments.map(e => ({
            groupId: e.groupId,
            academicYearId: e.academicYearId,
            endDate: null,
          })),
        },
      },
      include: {
        teacherAssignment: {
          include: {
            group: { include: { grade: true } },
            subject: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: {
          select: { sections: true, activities: true, announcements: true },
        },
      },
      orderBy: { teacherAssignment: { subject: { name: 'asc' } } },
    });

    return classrooms;
  }

  async getAvailableAssignments(teacherId: string, institutionId: string) {
    // Assignments that don't yet have a classroom
    return this.prisma.teacherAssignment.findMany({
      where: {
        teacherId,
        institutionId,
        endDate: null,
        classroom: null,
      },
      include: {
        group: { include: { grade: true } },
        subject: true,
      },
      orderBy: [{ group: { grade: { name: 'asc' } } }, { subject: { name: 'asc' } }],
    });
  }

  async create(teacherId: string, institutionId: string, dto: {
    teacherAssignmentId: string;
    title?: string;
    description?: string;
    color?: string;
  }) {
    // Validate ownership
    const assignment = await this.prisma.teacherAssignment.findFirst({
      where: { id: dto.teacherAssignmentId, teacherId, institutionId, endDate: null },
      include: { group: { include: { grade: true } }, subject: true },
    });
    if (!assignment) throw new ForbiddenException('Asignación no encontrada o no pertenece al docente');

    // Check if classroom already exists
    const existing = await this.prisma.classroom.findUnique({
      where: { teacherAssignmentId: dto.teacherAssignmentId },
    });
    if (existing) throw new ForbiddenException('Ya existe un aula para esta asignación');

    const title = dto.title || `${assignment.subject.name} - ${assignment.group.grade.name} ${assignment.group.name}`;

    return this.prisma.classroom.create({
      data: {
        institutionId,
        teacherAssignmentId: dto.teacherAssignmentId,
        title,
        description: dto.description,
        color: dto.color,
      },
      include: {
        teacherAssignment: {
          include: {
            group: { include: { grade: true } },
            subject: true,
          },
        },
      },
    });
  }

  async getById(classroomId: string, userId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        teacherAssignment: {
          include: {
            group: { include: { grade: true } },
            subject: true,
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        sections: {
          where: { /* all visible to teacher, filtered for students in controller */ },
          orderBy: { sortOrder: 'asc' },
          include: {
            materials: { orderBy: { sortOrder: 'asc' } },
            activities: {
              where: { isPublished: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, title: true, dueDate: true, isPublished: true, maxScore: true },
            },
          },
        },
        announcements: {
          orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
          take: 20,
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        _count: { select: { activities: true } },
      },
    });

    if (!classroom) throw new NotFoundException('Aula no encontrada');
    return classroom;
  }

  async update(classroomId: string, teacherId: string, dto: {
    title?: string;
    description?: string;
    color?: string;
    coverImage?: string;
    isActive?: boolean;
  }) {
    await this.validateClassroomOwnership(classroomId, teacherId);
    return this.prisma.classroom.update({
      where: { id: classroomId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async getStudents(classroomId: string, teacherId: string) {
    const classroom = await this.validateClassroomOwnership(classroomId, teacherId);
    return this.prisma.studentEnrollment.findMany({
      where: {
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { student: { user: { lastName: 'asc' } } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async createSection(classroomId: string, teacherId: string, dto: {
    title: string;
    description?: string;
  }) {
    await this.validateClassroomOwnership(classroomId, teacherId);
    const maxSort = await this.prisma.classroomSection.aggregate({
      where: { classroomId },
      _max: { sortOrder: true },
    });
    return this.prisma.classroomSection.create({
      data: {
        classroomId,
        title: dto.title,
        description: dto.description,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 100,
      },
      include: { materials: true },
    });
  }

  async updateSection(sectionId: string, teacherId: string, dto: {
    title?: string;
    description?: string;
    isVisible?: boolean;
    sortOrder?: number;
  }) {
    await this.validateSectionOwnership(sectionId, teacherId);
    return this.prisma.classroomSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteSection(sectionId: string, teacherId: string) {
    await this.validateSectionOwnership(sectionId, teacherId);
    await this.prisma.classroomSection.delete({ where: { id: sectionId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATERIALS
  // ═══════════════════════════════════════════════════════════════════════════

  async createMaterial(sectionId: string, teacherId: string, dto: {
    type: string;
    title: string;
    content?: string;
    fileUrl?: string;
  }) {
    await this.validateSectionOwnership(sectionId, teacherId);
    const maxSort = await this.prisma.classroomMaterial.aggregate({
      where: { sectionId },
      _max: { sortOrder: true },
    });
    return this.prisma.classroomMaterial.create({
      data: {
        sectionId,
        type: dto.type as any,
        title: dto.title,
        content: dto.content,
        fileUrl: dto.fileUrl,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 100,
      },
    });
  }

  async updateMaterial(materialId: string, teacherId: string, dto: {
    title?: string;
    content?: string;
    fileUrl?: string;
    isVisible?: boolean;
    sortOrder?: number;
  }) {
    await this.validateMaterialOwnership(materialId, teacherId);
    return this.prisma.classroomMaterial.update({
      where: { id: materialId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.fileUrl !== undefined && { fileUrl: dto.fileUrl }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async deleteMaterial(materialId: string, teacherId: string) {
    await this.validateMaterialOwnership(materialId, teacherId);
    await this.prisma.classroomMaterial.delete({ where: { id: materialId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  async createAnnouncement(classroomId: string, teacherId: string, dto: {
    title: string;
    content: string;
    isPinned?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  }) {
    await this.validateClassroomOwnership(classroomId, teacherId);
    return this.prisma.classroomAnnouncement.create({
      data: {
        classroomId,
        authorId: teacherId,
        title: dto.title,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
        attachmentUrl: dto.attachmentUrl,
        attachmentName: dto.attachmentName,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async updateAnnouncement(announcementId: string, teacherId: string, dto: {
    title?: string;
    content?: string;
    isPinned?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  }) {
    const ann = await this.prisma.classroomAnnouncement.findUnique({
      where: { id: announcementId },
      include: { classroom: { select: { teacherAssignment: { select: { teacherId: true } } } } },
    });
    if (!ann || ann.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Anuncio no encontrado o no tiene permisos');
    }
    return this.prisma.classroomAnnouncement.update({
      where: { id: announcementId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.attachmentUrl !== undefined && { attachmentUrl: dto.attachmentUrl }),
        ...(dto.attachmentName !== undefined && { attachmentName: dto.attachmentName }),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deleteAnnouncement(announcementId: string, teacherId: string) {
    const ann = await this.prisma.classroomAnnouncement.findUnique({
      where: { id: announcementId },
      include: { classroom: { select: { teacherAssignment: { select: { teacherId: true } } } } },
    });
    if (!ann || ann.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Anuncio no encontrado o no tiene permisos');
    }
    await this.prisma.classroomAnnouncement.delete({ where: { id: announcementId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ═══════════════════════════════════════════════════════════════════════════

  async createActivity(classroomId: string, teacherId: string, dto: {
    sectionId: string;
    type: string;
    title: string;
    description?: string;
    maxScore?: number;
    dueDate?: string;
    openDate?: string;
    allowLateSubmit?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  }) {
    const classroom = await this.validateClassroomOwnership(classroomId, teacherId);
    // Validate section belongs to this classroom
    const section = await this.prisma.classroomSection.findFirst({
      where: { id: dto.sectionId, classroom: { id: classroomId } },
    });
    if (!section) throw new ForbiddenException('Sección no encontrada en esta aula');

    return this.prisma.classroomActivity.create({
      data: {
        classroomId,
        sectionId: dto.sectionId,
        type: dto.type as any,
        title: dto.title,
        description: dto.description,
        maxScore: dto.maxScore,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        openDate: dto.openDate ? new Date(dto.openDate) : undefined,
        allowLateSubmit: dto.allowLateSubmit ?? false,
        metadata: dto.attachmentUrl ? { attachmentUrl: dto.attachmentUrl, attachmentName: dto.attachmentName } : undefined,
        isPublished: false,
      },
      include: {
        section: { select: { id: true, title: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async listActivities(classroomId: string, userId: string, role: 'teacher' | 'student') {
    if (role === 'teacher') {
      // Teachers see all activities
      return this.prisma.classroomActivity.findMany({
        where: { classroomId },
        include: {
          section: { select: { id: true, title: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      });
    }

    // Students see only published activities
    return this.prisma.classroomActivity.findMany({
      where: { classroomId, isPublished: true, isVisible: true },
      include: {
        section: { select: { id: true, title: true } },
        submissions: {
          where: {
            studentEnrollment: { student: { userId } },
          },
          select: {
            id: true, status: true, score: true, submittedAt: true, feedback: true, attemptNumber: true,
          },
          orderBy: { attemptNumber: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getActivity(activityId: string, userId: string, role: 'teacher' | 'student') {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        section: { select: { id: true, title: true } },
        classroom: {
          select: {
            id: true, title: true,
            teacherAssignment: { select: { teacherId: true, groupId: true, academicYearId: true } },
          },
        },
        _count: { select: { submissions: true } },
      },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    if (role === 'teacher') {
      if (activity.classroom.teacherAssignment.teacherId !== userId) {
        throw new ForbiddenException('No tiene permisos sobre esta actividad');
      }
      return activity;
    }

    // Student: must be published
    if (!activity.isPublished || !activity.isVisible) {
      throw new NotFoundException('Actividad no encontrada');
    }
    return activity;
  }

  async updateActivity(activityId: string, teacherId: string, dto: {
    title?: string;
    description?: string;
    maxScore?: number;
    dueDate?: string;
    openDate?: string;
    allowLateSubmit?: boolean;
    isVisible?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
  }) {
    await this.validateActivityOwnership(activityId, teacherId);

    const data: any = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.maxScore !== undefined) data.maxScore = dto.maxScore;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.openDate !== undefined) data.openDate = dto.openDate ? new Date(dto.openDate) : null;
    if (dto.allowLateSubmit !== undefined) data.allowLateSubmit = dto.allowLateSubmit;
    if (dto.isVisible !== undefined) data.isVisible = dto.isVisible;
    if (dto.attachmentUrl !== undefined) {
      data.metadata = { attachmentUrl: dto.attachmentUrl, attachmentName: dto.attachmentName };
    }

    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data,
      include: {
        section: { select: { id: true, title: true } },
        _count: { select: { submissions: true } },
      },
    });
  }

  async publishActivity(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);
    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: { isPublished: true },
    });
  }

  async unpublishActivity(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);
    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: { isPublished: false },
    });
  }

  async deleteActivity(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);
    await this.prisma.classroomActivity.delete({ where: { id: activityId } });
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMISSIONS (Student submits, Teacher grades)
  // ═══════════════════════════════════════════════════════════════════════════

  async submitTask(activityId: string, studentUserId: string, dto: {
    content?: string;
    fileUrl?: string;
  }) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: {
          select: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
        },
      },
    });
    if (!activity || !activity.isPublished) throw new NotFoundException('Actividad no encontrada');

    // Find student enrollment
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId: studentUserId },
        groupId: activity.classroom.teacherAssignment.groupId,
        academicYearId: activity.classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No estás matriculado en este grupo');

    // Check due date
    const now = new Date();
    const isLate = activity.dueDate && now > activity.dueDate;
    if (isLate && !activity.allowLateSubmit) {
      throw new ForbiddenException('La fecha límite ha pasado y no se permiten entregas tardías');
    }

    // Count existing attempts
    const existingAttempts = await this.prisma.activitySubmission.count({
      where: { activityId, studentEnrollmentId: enrollment.id },
    });
    if (existingAttempts >= activity.maxAttempts) {
      throw new ForbiddenException(`Has alcanzado el máximo de ${activity.maxAttempts} intento(s)`);
    }

    return this.prisma.activitySubmission.create({
      data: {
        activityId,
        studentEnrollmentId: enrollment.id,
        attemptNumber: existingAttempts + 1,
        status: isLate ? 'LATE' : 'SUBMITTED',
        content: dto.content,
        fileUrl: dto.fileUrl,
        submittedAt: now,
      },
      include: {
        activity: { select: { id: true, title: true, maxScore: true } },
      },
    });
  }

  async listSubmissions(activityId: string, teacherId: string) {
    const activity = await this.validateActivityOwnership(activityId, teacherId);

    return this.prisma.activitySubmission.findMany({
      where: { activityId },
      include: {
        studentEnrollment: {
          include: {
            student: {
              select: { id: true, firstName: true, lastName: true, secondLastName: true, photo: true },
            },
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }],
    });
  }

  async gradeSubmission(submissionId: string, teacherId: string, dto: {
    score: number;
    feedback?: string;
  }) {
    const submission = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        activity: {
          include: {
            classroom: { select: { teacherAssignment: { select: { teacherId: true } } } },
          },
        },
      },
    });
    if (!submission || submission.activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Entrega no encontrada o no tiene permisos');
    }

    return this.prisma.activitySubmission.update({
      where: { id: submissionId },
      data: {
        score: dto.score,
        feedback: dto.feedback,
        status: 'GRADED',
        gradedAt: new Date(),
        gradedById: teacherId,
      },
      include: {
        studentEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        activity: { select: { id: true, title: true, maxScore: true } },
      },
    });
  }

  async returnSubmission(submissionId: string, teacherId: string, dto: { feedback?: string }) {
    const submission = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        activity: {
          include: {
            classroom: { select: { teacherAssignment: { select: { teacherId: true } } } },
          },
        },
      },
    });
    if (!submission || submission.activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Entrega no encontrada o no tiene permisos');
    }

    return this.prisma.activitySubmission.update({
      where: { id: submissionId },
      data: {
        status: 'RETURNED',
        feedback: dto.feedback,
      },
    });
  }

  async getMySubmission(activityId: string, studentUserId: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId: studentUserId },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!enrollment) return null;

    return this.prisma.activitySubmission.findFirst({
      where: { activityId, studentEnrollmentId: enrollment.id },
      orderBy: { attemptNumber: 'desc' },
      include: {
        activity: { select: { id: true, title: true, maxScore: true, dueDate: true } },
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORUM
  // ═══════════════════════════════════════════════════════════════════════════

  async createForumPost(classroomId: string, authorId: string, dto: {
    title: string;
    content: string;
    parentId?: string;
  }) {
    // Verify user has access (teacher or enrolled student)
    await this.verifyClassroomAccess(classroomId, authorId);

    return this.prisma.forumPost.create({
      data: {
        classroomId,
        authorId,
        title: dto.parentId ? undefined : dto.title,
        content: dto.content,
        parentId: dto.parentId || undefined,
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { replies: true } },
      },
    });
  }

  async listForumPosts(classroomId: string, userId: string) {
    await this.verifyClassroomAccess(classroomId, userId);

    return this.prisma.forumPost.findMany({
      where: { classroomId, parentId: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { replies: true } },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getForumPost(postId: string, userId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        replies: {
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            replies: {
              include: {
                author: { select: { id: true, firstName: true, lastName: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!post) throw new NotFoundException('Tema no encontrado');
    if (post.classroomId) await this.verifyClassroomAccess(post.classroomId, userId);
    return post;
  }

  async togglePinForumPost(postId: string, teacherId: string) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post || !post.classroomId) throw new NotFoundException('Tema no encontrado');
    await this.validateClassroomOwnership(post.classroomId, teacherId);

    return this.prisma.forumPost.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
    });
  }

  async deleteForumPost(postId: string, userId: string, isTeacher: boolean) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    // Author can delete own post, teacher can delete any
    if (post.authorId !== userId) {
      if (!isTeacher || !post.classroomId) throw new ForbiddenException('No tiene permisos');
      await this.validateClassroomOwnership(post.classroomId, userId);
    }

    await this.prisma.forumPost.delete({ where: { id: postId } });
    return { success: true };
  }

  private async verifyClassroomAccess(classroomId: string, userId: string) {
    // Check if teacher
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { teacherAssignment: { select: { teacherId: true, groupId: true, academicYearId: true } } },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');
    if (classroom.teacherAssignment.teacherId === userId) return classroom;

    // Check if enrolled student
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: classroom.teacherAssignment.groupId,
        academicYearId: classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No tiene acceso a esta aula');
    return classroom;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDATION HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async validateClassroomOwnership(classroomId: string, teacherId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { teacherAssignment: { select: { teacherId: true, groupId: true, academicYearId: true } } },
    });
    if (!classroom || classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Aula no encontrada o no tiene permisos');
    }
    return classroom;
  }

  private async validateSectionOwnership(sectionId: string, teacherId: string) {
    const section = await this.prisma.classroomSection.findUnique({
      where: { id: sectionId },
      include: {
        classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
      },
    });
    if (!section || section.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Sección no encontrada o no tiene permisos');
    }
    return section;
  }

  private async validateMaterialOwnership(materialId: string, teacherId: string) {
    const material = await this.prisma.classroomMaterial.findUnique({
      where: { id: materialId },
      include: {
        section: {
          include: {
            classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
          },
        },
      },
    });
    if (!material || material.section.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Material no encontrado o no tiene permisos');
    }
    return material;
  }

  private async validateActivityOwnership(activityId: string, teacherId: string) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
      },
    });
    if (!activity || activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Actividad no encontrada o no tiene permisos');
    }
    return activity;
  }
}
