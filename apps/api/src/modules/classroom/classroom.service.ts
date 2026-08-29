import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LearningIdentityService } from '../gamification/learning-identity.service';
import { CompetencyEvidenceService } from '../learning-route/competency-evidence.service';
import { ActivityGatingService } from './gating/activity-gating.service';
import { validateNewDependency, DependencyEdge } from './gating/activity-graph.util';
import { findLevelForGrade } from '../../common/utils/academic-level.util';

const COLOMBIA_TIMEZONE_OFFSET = '-05:00';
const HAS_TIMEZONE_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function parseClassroomDate(value: string): Date {
  const normalized = HAS_TIMEZONE_OFFSET.test(value)
    ? value
    : DATE_ONLY.test(value)
      ? `${value}T00:00:00${COLOMBIA_TIMEZONE_OFFSET}`
      : `${value}${COLOMBIA_TIMEZONE_OFFSET}`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Fecha inválida');
  }
  return date;
}

@Injectable()
export class ClassroomService {
  private readonly logger = new Logger(ClassroomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identity: LearningIdentityService,
    private readonly evidence: CompetencyEvidenceService,
    private readonly gating: ActivityGatingService,
  ) {}

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
      select: { id: true, groupId: true, academicYearId: true },
    });

    if (enrollments.length === 0) return [];

    // Create a map of groupId+academicYearId -> enrollmentId for quick lookup
    const enrollmentMap = new Map<string, string>();
    for (const e of enrollments) {
      enrollmentMap.set(`${e.groupId}-${e.academicYearId}`, e.id);
    }

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

    // Add studentEnrollmentId to each classroom for Live Quiz tracking
    return classrooms.map(c => ({
      ...c,
      studentEnrollmentId: enrollmentMap.get(`${c.teacherAssignment.groupId}-${c.teacherAssignment.academicYearId}`),
    }));
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
            academicTerm: { select: { id: true, name: true, order: true } },
            activities: {
              where: { isPublished: true },
              orderBy: { sortOrder: 'asc' },
              select: { id: true, type: true, title: true, dueDate: true, isPublished: true, maxScore: true, academicTermId: true, publishedAt: true, createdAt: true },
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

    // Período académico actual del año del aula (para mostrarlo a docente y estudiante
    // sin exponer el endpoint de términos, restringido a personal). Se prioriza el
    // período cuyo rango de fechas contiene hoy; si no, el primer período ABIERTO.
    const periods = await this.prisma.academicTerm.findMany({
      where: { academicYearId: classroom.teacherAssignment.academicYearId, type: 'PERIOD' },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true, startDate: true, endDate: true, status: true },
    });
    const now = new Date();
    const currentPeriod =
      periods.find(p => p.startDate && p.endDate && now >= p.startDate && now <= p.endDate) ||
      periods.find(p => p.status === 'OPEN') ||
      periods[periods.length - 1] ||
      null;

    // Add studentEnrollmentId for students (needed for Live Quiz tracking)
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (student) {
      const enrollment = await this.prisma.studentEnrollment.findFirst({
        where: {
          studentId: student.id,
          groupId: classroom.teacherAssignment.groupId,
          academicYearId: classroom.teacherAssignment.academicYearId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      return { ...classroom, studentEnrollmentId: enrollment?.id, currentPeriod, academicPeriods: periods };
    }

    return { ...classroom, currentPeriod, academicPeriods: periods };
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
    academicTermId?: string | null;
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
        academicTermId: dto.academicTermId || null,
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
    academicTermId?: string | null;
  }) {
    await this.validateSectionOwnership(sectionId, teacherId);
    return this.prisma.classroomSection.update({
      where: { id: sectionId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.academicTermId !== undefined && { academicTermId: dto.academicTermId || null }),
      },
    });
  }

  async deleteSection(sectionId: string, teacherId: string, force = false) {
    await this.validateSectionOwnership(sectionId, teacherId);

    // Verificar si hay actividades con entregas en esta sección
    const activitiesWithSubmissions = await this.prisma.classroomActivity.findMany({
      where: { sectionId },
      select: {
        id: true,
        title: true,
        _count: { select: { submissions: true } },
      },
    });

    const totalSubmissions = activitiesWithSubmissions.reduce((sum, a) => sum + a._count.submissions, 0);

    if (totalSubmissions > 0 && !force) {
      return {
        success: false,
        requiresConfirmation: true,
        activitiesCount: activitiesWithSubmissions.length,
        submissionsCount: totalSubmissions,
        message: `Esta sección tiene ${activitiesWithSubmissions.length} actividad(es) con ${totalSubmissions} entrega(s). Las actividades quedarán sin sección pero NO se perderán las entregas. ¿Continuar?`,
      };
    }

    // Las actividades quedarán con sectionId = null (SetNull en schema)
    // pero NO se borrarán las entregas
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

  async copyAnnouncementToClassroom(announcementId: string, targetClassroomId: string, teacherId: string) {
    const ann = await this.prisma.classroomAnnouncement.findUnique({
      where: { id: announcementId },
      include: { classroom: { select: { teacherAssignment: { select: { teacherId: true } } } } },
    });
    if (!ann || ann.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Anuncio no encontrado o no tiene permisos');
    }

    await this.validateClassroomOwnership(targetClassroomId, teacherId);

    return this.prisma.classroomAnnouncement.create({
      data: {
        classroomId: targetClassroomId,
        authorId: teacherId,
        title: ann.title,
        content: ann.content,
        isPinned: false,
        attachmentUrl: ann.attachmentUrl,
        attachmentName: ann.attachmentName,
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
    sectionId?: string | null;
    academicTermId?: string | null;
    type: string;
    title: string;
    description?: string;
    maxScore?: number;
    dueDate?: string | null;
    openDate?: string | null;
    allowLateSubmit?: boolean;
    attachmentUrl?: string;
    attachmentName?: string;
    shuffleQuestions?: boolean;
    showResults?: boolean;
    maxAttempts?: number;
    timeLimitMinutes?: number;
    rubricId?: string;
    gameType?: string; // juego suelto (WORDSEARCH/CROSSWORD): marca para rotular sin abrir la lección
    audioResponse?: boolean; // TASK con respuesta en audio: el alumno graba/sube un audio
  }) {
    const classroom = await this.validateClassroomOwnership(classroomId, teacherId);
    // Sección OPCIONAL: si se pasa, debe pertenecer al aula; si no, actividad sin sección.
    if (dto.sectionId) {
      const section = await this.prisma.classroomSection.findFirst({
        where: { id: dto.sectionId, classroom: { id: classroomId } },
      });
      if (!section) throw new ForbiddenException('Sección no encontrada en esta aula');
    }

    // Build metadata
    let metadata: any = undefined;
    if (dto.attachmentUrl) {
      metadata = { attachmentUrl: dto.attachmentUrl, attachmentName: dto.attachmentName };
    }
    if (dto.gameType) {
      metadata = { ...(metadata || {}), gameType: dto.gameType };
    }
    if (dto.audioResponse) {
      metadata = { ...(metadata || {}), audioResponse: true };
    }

    return this.prisma.classroomActivity.create({
      data: {
        classroomId,
        sectionId: dto.sectionId || null,
        academicTermId: dto.academicTermId || null,
        type: dto.type as any,
        title: dto.title,
        description: dto.description,
        maxScore: dto.maxScore,
        dueDate: dto.dueDate ? parseClassroomDate(dto.dueDate) : undefined,
        openDate: dto.openDate ? parseClassroomDate(dto.openDate) : undefined,
        allowLateSubmit: dto.allowLateSubmit ?? false,
        shuffleQuestions: dto.shuffleQuestions ?? false,
        showResults: dto.showResults ?? true,
        maxAttempts: dto.maxAttempts ?? 1,
        timeLimitMinutes: dto.timeLimitMinutes,
        metadata,
        rubricId: dto.rubricId || undefined,
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
      // Teachers see all activities EXCEPT las propias de una ruta (isRouteScoped),
      // que se gestionan desde el mapa de la ruta, no en esta lista.
      const activities = await this.prisma.classroomActivity.findMany({
        where: { classroomId, isRouteScoped: false },
        include: {
          section: { select: { id: true, title: true, academicTermId: true } },
          _count: { select: { submissions: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      });

      // Conteo de entregas pendientes por calificar (SUBMITTED/LATE) por actividad.
      // Aditivo: alimenta el centro de control del docente ("Por calificar (n)") sin migración.
      const pendingGroups = await this.prisma.activitySubmission.groupBy({
        by: ['activityId'],
        where: { activity: { classroomId }, status: { in: ['SUBMITTED', 'LATE'] } },
        _count: { _all: true },
      });
      const pendingMap = new Map(pendingGroups.map((g) => [g.activityId, g._count._all]));

      // Prerrequisitos configurados por actividad (Fase 4), para que el docente los edite.
      const prereqMap = await this.getDependencyMapForClassroom(classroomId);

      return activities.map((a) => ({
        ...a,
        gradingPending: pendingMap.get(a.id) || 0,
        prerequisites: prereqMap.get(a.id) || [],
      }));
    }

    // Students see only published activities — ordered by publication date (newest first).
    // Las propias de una ruta se hacen desde el mapa de la ruta, no en esta lista.
    //
    // La matrícula se resuelve ANTES de consultar: hace falta tanto para ocultar las
    // actividades restringidas a estudiantes concretos (recuperación, refuerzo) como
    // para el candado por dependencias.
    const enr = await this.resolveStudentEnrollment(classroomId, userId);

    // Actividad restringida (isRestrictedToAssigned) → solo la ven los asignados.
    // Sin matrícula resuelta no se puede probar la asignación: se muestran solo las abiertas.
    const assignedFilter = enr
      ? { OR: [{ isRestrictedToAssigned: false }, { assignedStudents: { some: { studentEnrollmentId: enr } } }] }
      : { isRestrictedToAssigned: false };

    const activities = await this.prisma.classroomActivity.findMany({
      where: { classroomId, isPublished: true, isVisible: true, isRouteScoped: false, ...assignedFilter },
      include: {
        section: { select: { id: true, title: true, academicTermId: true } },
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
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    // Estado de candado por dependencias (Fase 4). Backend autoritativo; la UI solo pinta.
    // Sin reglas o sin matrícula → todo libre (retrocompatible).
    let gate = new Map<string, { locked: boolean; requirements: any[] }>();
    if (enr) gate = await this.gating.evaluateForStudent(classroomId, enr);

    return activities.map((a) => {
      const g = gate.get(a.id);
      return { ...a, locked: g?.locked ?? false, requirements: g?.requirements ?? [] };
    });
  }

  /** Enrollment ACTIVO del estudiante en el aula (por grupo/año del teacherAssignment). */
  private async resolveStudentEnrollment(classroomId: string, userId: string): Promise<string | null> {
    const cr = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { teacherAssignment: { select: { groupId: true, academicYearId: true } } },
    });
    if (!cr) return null;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: cr.teacherAssignment.groupId,
        academicYearId: cr.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    return enrollment?.id ?? null;
  }

  /** Mapa activityId → prerrequisitos configurados (con título/condición) del aula. */
  private async getDependencyMapForClassroom(classroomId: string) {
    const rows = await this.prisma.activityDependency.findMany({
      where: { activity: { classroomId } },
      select: {
        id: true, activityId: true, prerequisiteId: true, condition: true, minScore: true,
        prerequisite: { select: { title: true, type: true } },
      },
    });
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const list = map.get(r.activityId) || [];
      list.push({
        id: r.id,
        prerequisiteId: r.prerequisiteId,
        title: r.prerequisite?.title || 'Actividad',
        type: r.prerequisite?.type,
        condition: r.condition,
        minScore: r.minScore != null ? Number(r.minScore) : null,
      });
      map.set(r.activityId, list);
    }
    return map;
  }

  /** Reemplaza el conjunto de prerrequisitos de una actividad (Fase 4). */
  async setActivityDependencies(
    activityId: string,
    teacherId: string,
    prerequisites: { prerequisiteId: string; condition?: string; minScore?: number | null }[],
  ) {
    const activity = await this.validateActivityOwnership(activityId, teacherId);
    const classroomId = activity.classroomId;

    const validIds = new Set(
      (await this.prisma.classroomActivity.findMany({ where: { classroomId }, select: { id: true } })).map((a) => a.id),
    );

    // Grafo actual SIN las aristas de esta actividad (se reemplazan).
    const otherEdges = (await this.gating.getClassroomEdges(classroomId)).filter((e) => e.activityId !== activityId);
    const accepted: DependencyEdge[] = [...otherEdges];

    const valid = ['SUBMITTED', 'GRADED', 'MIN_SCORE', 'COMPLETED'];
    const clean: { prerequisiteId: string; condition: string; minScore: number | null }[] = [];
    const seen = new Set<string>();
    for (const p of prerequisites || []) {
      const prerequisiteId = p?.prerequisiteId;
      if (!prerequisiteId || seen.has(prerequisiteId)) continue;
      seen.add(prerequisiteId);
      if (prerequisiteId === activityId) throw new BadRequestException('Una actividad no puede depender de sí misma');
      if (!validIds.has(prerequisiteId)) throw new BadRequestException('El prerrequisito debe pertenecer a la misma aula');
      if (validateNewDependency(accepted, activityId, prerequisiteId) === 'CYCLE') {
        throw new BadRequestException('Esa configuración crearía un ciclo de dependencias');
      }
      const condition = valid.includes(p.condition || '') ? (p.condition as string) : 'SUBMITTED';
      const minScore = condition === 'MIN_SCORE' && p.minScore != null ? p.minScore : null;
      accepted.push({ activityId, prerequisiteId });
      clean.push({ prerequisiteId, condition, minScore });
    }

    await this.prisma.$transaction([
      this.prisma.activityDependency.deleteMany({ where: { activityId } }),
      ...clean.map((c) =>
        this.prisma.activityDependency.create({
          data: { activityId, prerequisiteId: c.prerequisiteId, condition: c.condition as any, minScore: c.minScore },
        }),
      ),
    ]);

    return (await this.getDependencyMapForClassroom(classroomId)).get(activityId) || [];
  }

  async getActivity(activityId: string, userId: string, role: 'teacher' | 'student') {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        section: { select: { id: true, title: true } },
        classroom: {
          select: {
            id: true, title: true, institutionId: true,
            teacherAssignment: { select: { teacherId: true, groupId: true, academicYearId: true } },
          },
        },
        rubric: {
          include: {
            criteria: {
              include: { levels: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
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

    // Restringida a estudiantes concretos: solo la abren los asignados. Se responde
    // 404 (no 403) para no revelar que la actividad existe.
    if (activity.isRestrictedToAssigned) {
      const enr = await this.resolveStudentEnrollment(activity.classroom.id, userId);
      const assigned = enr
        ? await this.prisma.activityAssignment.count({ where: { activityId, studentEnrollmentId: enr } })
        : 0;
      if (!assigned) throw new NotFoundException('Actividad no encontrada');
    }
    return activity;
  }

  async updateActivity(activityId: string, teacherId: string, dto: {
    title?: string;
    description?: string;
    maxScore?: number;
    dueDate?: string | null;
    openDate?: string | null;
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
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? parseClassroomDate(dto.dueDate) : null;
    if (dto.openDate !== undefined) data.openDate = dto.openDate ? parseClassroomDate(dto.openDate) : null;
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

  async publishActivity(activityId: string, teacherId: string, dto?: { scheduledPublishAt?: string }) {
    await this.validateActivityOwnership(activityId, teacherId);

    // Si se envía una fecha programada, no publicar aún
    if (dto?.scheduledPublishAt) {
      return this.prisma.classroomActivity.update({
        where: { id: activityId },
        data: { scheduledPublishAt: parseClassroomDate(dto.scheduledPublishAt), isPublished: false },
      });
    }

    // Publicar inmediatamente y limpiar cualquier programación previa
    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: { isPublished: true, isVisible: true, scheduledPublishAt: null, publishedAt: new Date() },
    });
  }

  async unpublishActivity(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);
    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: { isPublished: false, scheduledPublishAt: null },
    });
  }

  /**
   * Procesa actividades con publicación programada cuya fecha ya pasó.
   * Llamado por el cron job cada minuto.
   */
  async processScheduledPublications(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.classroomActivity.updateMany({
      where: {
        isPublished: false,
        scheduledPublishAt: { lte: now },
      },
      data: {
        isPublished: true,
        isVisible: true,
        scheduledPublishAt: null,
        publishedAt: now,
      },
    });
    return result.count;
  }

  /**
   * Asignar estudiantes específicos a una actividad (para recuperación, refuerzo, etc.)
   */
  async assignStudentsToActivity(activityId: string, teacherId: string, dto: {
    studentEnrollmentIds: string[];
    isRestrictedToAssigned: boolean;
  }) {
    await this.validateActivityOwnership(activityId, teacherId);

    // Clear existing assignments
    await this.prisma.activityAssignment.deleteMany({
      where: { activityId },
    });

    // Create new assignments
    if (dto.studentEnrollmentIds.length > 0) {
      await this.prisma.activityAssignment.createMany({
        data: dto.studentEnrollmentIds.map(studentEnrollmentId => ({
          activityId,
          studentEnrollmentId,
        })),
      });
    }

    // Update restriction flag
    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: { isRestrictedToAssigned: dto.isRestrictedToAssigned },
      include: {
        assignedStudents: {
          include: {
            studentEnrollment: {
              include: { student: { select: { firstName: true, lastName: true, secondLastName: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * Obtener estudiantes asignados a una actividad
   */
  async getActivityAssignments(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);

    return this.prisma.activityAssignment.findMany({
      where: { activityId },
      include: {
        studentEnrollment: {
          include: { student: { select: { id: true, firstName: true, lastName: true, secondLastName: true, photo: true } } },
        },
      },
    });
  }

  /**
   * Obtener estudiantes del aula para asignar a actividades
   */
  async getClassroomStudentsForAssignment(classroomId: string, teacherId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: {
        id: true,
        teacherAssignment: {
          select: {
            teacherId: true,
            group: {
              select: {
                id: true,
                studentEnrollments: {
                  where: { status: 'ACTIVE' },
                  select: {
                    id: true,
                    student: { select: { id: true, firstName: true, lastName: true, secondLastName: true, photo: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!classroom || classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene acceso a este aula');
    }

    return classroom.teacherAssignment.group.studentEnrollments.map(e => ({
      enrollmentId: e.id,
      studentId: e.student.id,
      firstName: e.student.firstName,
      lastName: e.student.lastName,
      secondLastName: e.student.secondLastName,
      photo: e.student.photo,
    }));
  }

  async deleteActivity(activityId: string, teacherId: string, force = false) {
    await this.validateActivityOwnership(activityId, teacherId);

    const submissionCount = await this.prisma.activitySubmission.count({ where: { activityId } });

    if (submissionCount > 0 && !force) {
      return {
        success: false,
        requiresConfirmation: true,
        submissionCount,
        message: `Esta actividad tiene ${submissionCount} entrega(s). ¿Está seguro de eliminarla? Se perderán todas las entregas y calificaciones.`,
      };
    }

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

    // Enforcement de dependencias (Fase 3): no se entrega una actividad bloqueada.
    // Fail-open: si no tiene reglas, pasa. Sticky: si ya la había iniciado/entregado, pasa.
    if (!(await this.gating.isUnlockedForStudent(activityId, activity.classroomId, enrollment.id))) {
      throw new ForbiddenException('Esta actividad está bloqueada: primero completa las actividades requeridas');
    }

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
            classroom: { select: { teacherAssignment: { select: { teacherId: true, subject: { select: { name: true } } } } } },
          },
        },
      },
    });
    if (!submission || submission.activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Entrega no encontrada o no tiene permisos');
    }

    // Validar que la nota no exceda la nota máxima de la actividad
    const maxScore = submission.activity.maxScore ? Number(submission.activity.maxScore) : null;
    if (dto.score < 0) {
      throw new BadRequestException('La nota no puede ser negativa');
    }
    if (maxScore !== null && dto.score > maxScore) {
      throw new BadRequestException(`La nota no puede ser mayor a ${maxScore}`);
    }

    // Gamificación: XP por DOMINIO al calificar (proporcional a la nota, hasta 30 XP),
    // una sola vez por actividad y estudiante. Cubre tareas calificadas a mano (no solo
    // lecciones/quizzes). Nunca rompe el flujo del docente.
    try {
      if (maxScore && maxScore > 0 && dto.score > 0) {
        const enrollment = await this.prisma.studentEnrollment.findUnique({
          where: { id: submission.studentEnrollmentId },
          select: { studentId: true, institutionId: true },
        });
        if (enrollment) {
          const xpAmount = Math.round(Math.min(dto.score / maxScore, 1) * 30);
          if (xpAmount > 0) {
            await this.identity.grantXp({
              institutionId: enrollment.institutionId,
              studentId: enrollment.studentId,
              studentEnrollmentId: submission.studentEnrollmentId,
              source: 'QUIZ_GRADED',
              amount: xpAmount,
              skill: submission.activity.classroom.teacherAssignment.subject?.name ?? null,
              reason: `Actividad calificada: ${submission.activity.title}`,
              idempotencyKey: `grade:activity:${submission.activityId}:enrollment:${submission.studentEnrollmentId}`,
            });
          }
          // Evidencia de competencias (si la actividad es paso de una ruta con can-do).
          await this.evidence.recordFromActivity({
            institutionId: enrollment.institutionId,
            studentId: enrollment.studentId,
            studentEnrollmentId: submission.studentEnrollmentId,
            activityId: submission.activityId,
            scorePercent: Math.min(dto.score / maxScore, 1) * 100,
            source: 'ACTIVITY', sourceRef: submissionId,
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`XP/evidencia de calificación no concedido (no crítico): ${err?.message || err}`);
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
            classroom: { select: { teacherAssignment: { select: { teacherId: true, subject: { select: { name: true } } } } } },
          },
        },
      },
    });
    if (!submission || submission.activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Entrega no encontrada o no tiene permisos');
    }

    const updated = await this.prisma.activitySubmission.update({
      where: { id: submissionId },
      data: {
        status: 'RETURNED',
        feedback: dto.feedback,
      },
    });

    // Devolver una lección/juego = que el alumno la rehaga: se resetea su progreso.
    // El XP ya ganado se conserva (devolver es una corrección más suave que borrar).
    await this.resetLessonAttempt(submission.activity, submission.studentEnrollmentId, false);

    return updated;
  }

  async updateSubmission(submissionId: string, studentUserId: string, dto: {
    content?: string;
    fileUrl?: string;
  }) {
    // Buscar la entrega con la actividad
    const submission = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        activity: {
          select: {
            id: true,
            type: true,
            dueDate: true,
            allowLateSubmit: true,
            classroom: { select: { teacherAssignment: { select: { groupId: true, academicYearId: true } } } },
          },
        },
        studentEnrollment: { select: { id: true, student: { select: { userId: true } } } },
      },
    });

    if (!submission) {
      throw new NotFoundException('Entrega no encontrada');
    }

    // Verificar que el estudiante sea el dueño de la entrega
    if (submission.studentEnrollment.student.userId !== studentUserId) {
      throw new ForbiddenException('No tienes permiso para editar esta entrega');
    }

    // Solo permitir edición de TASK (tareas), no QUIZ ni EXAM
    if (submission.activity.type !== 'TASK') {
      throw new ForbiddenException('Solo se pueden editar entregas de tareas. Los quizzes y exámenes funcionan por intentos.');
    }

    // Verificar que no esté calificada
    if (submission.status === 'GRADED') {
      throw new ForbiddenException('No puedes editar una entrega que ya fue calificada');
    }

    // Verificar que la fecha límite no haya pasado
    const now = new Date();
    if (submission.activity.dueDate && now > submission.activity.dueDate) {
      throw new ForbiddenException('La fecha límite ha pasado. No puedes editar tu entrega.');
    }

    return this.prisma.activitySubmission.update({
      where: { id: submissionId },
      data: {
        content: dto.content,
        fileUrl: dto.fileUrl,
        submittedAt: now, // Actualizar fecha de envío
      },
      include: {
        activity: { select: { id: true, title: true, maxScore: true, dueDate: true } },
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

  async getMyGrades(classroomId: string, studentUserId: string) {
    // Get classroom to find the group
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      select: { teacherAssignment: { select: { groupId: true } } },
    });
    if (!classroom) return { submissions: [], pending: [] };

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId: studentUserId },
        status: 'ACTIVE',
        groupId: classroom.teacherAssignment.groupId,
      },
      select: { id: true },
    });
    if (!enrollment) return { submissions: [], pending: [] };

    const submissions = await this.prisma.activitySubmission.findMany({
      where: {
        studentEnrollmentId: enrollment.id,
        activity: { classroomId, isPublished: true },
      },
      orderBy: { submittedAt: 'desc' },
      include: {
        activity: {
          select: { id: true, title: true, type: true, maxScore: true, dueDate: true, section: { select: { title: true } } },
        },
      },
    });

    // Also get activities without submissions (pending)
    const activities = await this.prisma.classroomActivity.findMany({
      where: { classroomId, isPublished: true, isVisible: true },
      select: { id: true, title: true, type: true, maxScore: true, dueDate: true, section: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const submittedIds = new Set(submissions.map(s => s.activity.id));
    const pending = activities.filter(a => !submittedIds.has(a.id));

    return { submissions, pending };
  }

  /**
   * Elimina un intento de quiz/examen (solo el docente puede hacerlo)
   * Esto permite al estudiante volver a intentar
   */
  async deleteSubmission(submissionId: string, teacherId: string) {
    const submission = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        activity: {
          include: {
            classroom: { select: { teacherAssignment: { select: { teacherId: true, subject: { select: { name: true } } } } } },
          },
        },
        studentEnrollment: {
          include: { student: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!submission || submission.activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Entrega no encontrada o no tiene permisos');
    }

    // Delete answers first (if quiz)
    await this.prisma.questionAnswer.deleteMany({
      where: { submissionId },
    });

    // Delete the submission
    await this.prisma.activitySubmission.delete({
      where: { id: submissionId },
    });

    // Si era una lección/juego: resetea el progreso para que el alumno la rehaga y
    // revierte el XP + insignias de ese intento (borrado administrativo).
    await this.resetLessonAttempt(submission.activity, submission.studentEnrollmentId, true);

    return {
      success: true,
      message: `Intento eliminado para ${submission.studentEnrollment.student.firstName} ${submission.studentEnrollment.student.lastName}`,
    };
  }

  /**
   * El docente reinicia una lección para un estudiante puntual, aunque ya no exista
   * la entrega (p. ej. intentos borrados con el bug antiguo, que dejaban el progreso
   * en "completado" sin entrega). Borra la entrega si existe, resetea el progreso y
   * revierte XP/insignias → el estudiante puede volver a hacerla.
   */
  async resetLessonForStudent(activityId: string, teacherId: string, studentEnrollmentId: string) {
    const activity = await this.validateActivityOwnership(activityId, teacherId);
    if (activity.type !== 'LESSON' && activity.type !== 'GAME') {
      throw new BadRequestException('Solo aplica a lecciones interactivas');
    }
    await this.prisma.activitySubmission.deleteMany({ where: { activityId, studentEnrollmentId } });
    await this.resetLessonAttempt({ id: activity.id, type: activity.type }, studentEnrollmentId, true);
    return { success: true };
  }

  /**
   * Al borrar/devolver el intento de una lección interactiva (o juego), resetea su
   * LessonProgress para que el estudiante pueda volver a hacerla. Si `revokeXp`,
   * revierte además el XP y reevalúa las insignias. No-op para otros tipos.
   */
  private async resetLessonAttempt(
    activity: { id: string; type: string },
    studentEnrollmentId: string,
    revokeXp: boolean,
  ) {
    if (activity.type !== 'LESSON' && activity.type !== 'GAME') return;
    const lesson = await this.prisma.lesson.findFirst({ where: { activityId: activity.id }, select: { id: true } });
    if (!lesson) return;
    await this.prisma.lessonProgress.deleteMany({ where: { lessonId: lesson.id, studentEnrollmentId } });
    if (revokeXp) await this.identity.revokeLessonRewards(studentEnrollmentId, lesson.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Question Contexts CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createContext(activityId: string, teacherId: string, dto: {
    title?: string; text?: string; imageUrl?: string; viewPolicy?: string;
  }) {
    await this.validateActivityOwnership(activityId, teacherId);
    const maxSort = await this.prisma.questionContext.aggregate({
      where: { activityId },
      _max: { sortOrder: true },
    });
    return this.prisma.questionContext.create({
      data: {
        activityId,
        title: dto.title,
        text: dto.text,
        imageUrl: dto.imageUrl,
        viewPolicy: dto.viewPolicy || 'ALWAYS',
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async updateContext(contextId: string, teacherId: string, dto: {
    title?: string; text?: string; imageUrl?: string; viewPolicy?: string;
  }) {
    const ctx = await this.prisma.questionContext.findUnique({
      where: { id: contextId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!ctx) throw new NotFoundException('Contexto no encontrado');
    await this.validateClassroomOwnership(ctx.activity.classroomId, teacherId);
    return this.prisma.questionContext.update({
      where: { id: contextId },
      data: {
        title: dto.title,
        text: dto.text,
        imageUrl: dto.imageUrl,
        viewPolicy: dto.viewPolicy,
      },
    });
  }

  async deleteContext(contextId: string, teacherId: string) {
    const ctx = await this.prisma.questionContext.findUnique({
      where: { id: contextId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!ctx) throw new NotFoundException('Contexto no encontrado');
    await this.validateClassroomOwnership(ctx.activity.classroomId, teacherId);
    // Unlink questions, then delete
    await this.prisma.activityQuestion.updateMany({
      where: { contextId },
      data: { contextId: null },
    });
    await this.prisma.questionContext.delete({ where: { id: contextId } });
    return { success: true };
  }

  async listContexts(activityId: string) {
    return this.prisma.questionContext.findMany({
      where: { activityId },
      orderBy: { sortOrder: 'asc' },
      include: { questions: { select: { id: true, text: true, sortOrder: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Questions CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async addQuestion(activityId: string, teacherId: string, dto: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
    subjectArea?: string; competency?: string; contextId?: string;
  }) {
    const activity = await this.validateActivityOwnership(activityId, teacherId);
    const maxSort = await this.prisma.activityQuestion.aggregate({
      where: { activityId },
      _max: { sortOrder: true },
    });
    return this.prisma.activityQuestion.create({
      data: {
        activityId,
        contextId: dto.contextId || null,
        type: dto.type as any,
        text: dto.text,
        options: dto.options,
        correctAnswer: dto.correctAnswer,
        points: dto.points ?? 1,
        explanation: dto.explanation,
        imageUrl: dto.imageUrl,
        subjectArea: dto.subjectArea,
        competency: dto.competency,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Importar preguntas desde un JSON "limpio" (el que produce una IA).
  //
  // El docente le pide a una IA un banco de preguntas y lo pega/sube aquí. El
  // formato interno de ActivityQuestion es incómodo para una IA (correctAnswer a
  // veces es un JSON stringificado, options tiene forma distinta por tipo), así
  // que aceptamos un esquema humano y tolerante y lo traducimos nosotros:
  //
  //   { "questions": [
  //     { "type":"MULTIPLE_CHOICE", "text":"...", "options":["a","b"], "correct":"a" },
  //     { "type":"TRUE_FALSE", "text":"...", "correct":true },
  //     { "type":"MULTIPLE_SELECT", "text":"...", "options":[...], "correct":["a","c"] },
  //     { "type":"SHORT_ANSWER", "text":"...", "correct":"respuesta" },
  //     { "type":"FILL_BLANK", "text":"El {{}} es azul", "answers":["cielo"] },
  //     { "type":"ORDERING", "text":"...", "items":["1","2","3"] },
  //     { "type":"MATCHING", "text":"...", "pairs":[{"left":"Perú","right":"Lima"}] }
  //   ] }
  //
  // También acepta un array suelto en la raíz y sinónimos en español (pregunta,
  // opciones, respuesta, puntos, explicacion). Devuelve las creadas y las que se
  // omitieron con el motivo, para que el docente corrija sin perder el resto.
  async importQuestions(activityId: string, teacherId: string, payload: any) {
    await this.validateActivityOwnership(activityId, teacherId);

    const rawList: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.questions)
        ? payload.questions
        : Array.isArray(payload?.preguntas)
          ? payload.preguntas
          : [];
    if (!rawList.length) {
      throw new BadRequestException('No se encontraron preguntas. Esperaba { "questions": [...] } o un arreglo de preguntas.');
    }
    if (rawList.length > 200) {
      throw new BadRequestException('Máximo 200 preguntas por importación.');
    }

    const pick = (o: any, ...keys: string[]) => {
      for (const k of keys) if (o?.[k] !== undefined && o?.[k] !== null) return o[k];
      return undefined;
    };
    const norm = (s: any) => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Resuelve un "correct" que puede venir como texto, índice (0/1..) o letra (A/B..)
    // contra la lista de opciones. Devuelve el TEXTO exacto de la opción, o null.
    const resolveOption = (value: any, options: string[]): string | null => {
      if (value === undefined || value === null) return null;
      // Índice numérico (0-based o 1-based si el 0-based no existe pero el 1-based sí)
      if (typeof value === 'number' && Number.isInteger(value)) {
        if (options[value] !== undefined) return options[value];
        if (options[value - 1] !== undefined) return options[value - 1];
        return null;
      }
      const s = String(value).trim();
      // Letra sola: A/B/C...
      if (/^[a-zA-Z]$/.test(s)) {
        const idx = s.toUpperCase().charCodeAt(0) - 65;
        if (idx >= 0 && options[idx] !== undefined) return options[idx];
      }
      // Número como string
      if (/^\d+$/.test(s)) {
        const idx = parseInt(s, 10);
        if (options[idx] !== undefined) return options[idx];
        if (options[idx - 1] !== undefined) return options[idx - 1];
      }
      // Coincidencia de texto (exacta y luego normalizada)
      const exact = options.find(o => o === s);
      if (exact !== undefined) return exact;
      const fuzzy = options.find(o => norm(o) === norm(s));
      return fuzzy ?? null;
    };

    const TYPE_ALIASES: Record<string, string> = {
      multiple_choice: 'MULTIPLE_CHOICE', multiplechoice: 'MULTIPLE_CHOICE', mc: 'MULTIPLE_CHOICE',
      single: 'MULTIPLE_CHOICE', opcion_multiple: 'MULTIPLE_CHOICE', opcionmultiple: 'MULTIPLE_CHOICE', unica: 'MULTIPLE_CHOICE',
      multiple_select: 'MULTIPLE_SELECT', multipleselect: 'MULTIPLE_SELECT', multi: 'MULTIPLE_SELECT', checkbox: 'MULTIPLE_SELECT',
      seleccion_multiple: 'MULTIPLE_SELECT', seleccionmultiple: 'MULTIPLE_SELECT', varias: 'MULTIPLE_SELECT',
      true_false: 'TRUE_FALSE', truefalse: 'TRUE_FALSE', boolean: 'TRUE_FALSE', vf: 'TRUE_FALSE',
      verdadero_falso: 'TRUE_FALSE', verdaderofalso: 'TRUE_FALSE',
      short_answer: 'SHORT_ANSWER', shortanswer: 'SHORT_ANSWER', short: 'SHORT_ANSWER', text: 'SHORT_ANSWER',
      abierta: 'SHORT_ANSWER', respuesta_corta: 'SHORT_ANSWER', respuestacorta: 'SHORT_ANSWER',
      fill_blank: 'FILL_BLANK', fillblank: 'FILL_BLANK', fill: 'FILL_BLANK', blank: 'FILL_BLANK',
      completar: 'FILL_BLANK', huecos: 'FILL_BLANK', rellenar: 'FILL_BLANK',
      ordering: 'ORDERING', order: 'ORDERING', ordenar: 'ORDERING', secuencia: 'ORDERING', orden: 'ORDERING',
      matching: 'MATCHING', match: 'MATCHING', emparejar: 'MATCHING', relacionar: 'MATCHING', pares: 'MATCHING', unir: 'MATCHING',
      numeric: 'NUMERIC', number: 'NUMERIC', numero: 'NUMERIC', numerica: 'NUMERIC', num: 'NUMERIC',
      categorize: 'CATEGORIZE', categorise: 'CATEGORIZE', categorizar: 'CATEGORIZE', clasificar: 'CATEGORIZE', clasificacion: 'CATEGORIZE', grupos: 'CATEGORIZE',
    };

    const created: any[] = [];
    const skipped: Array<{ index: number; reason: string }> = [];
    const toCreate: any[] = [];

    // sortOrder continúa después de las preguntas existentes.
    const maxSort = await this.prisma.activityQuestion.aggregate({
      where: { activityId }, _max: { sortOrder: true },
    });
    let sort = (maxSort._max.sortOrder ?? -1) + 1;

    rawList.forEach((raw, index) => {
      try {
        const text = String(pick(raw, 'text', 'pregunta', 'question', 'enunciado') ?? '').trim();
        if (!text) { skipped.push({ index, reason: 'Sin enunciado (text).' }); return; }

        const rawType = pick(raw, 'type', 'tipo');
        let type = rawType ? TYPE_ALIASES[norm(rawType).replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')] || TYPE_ALIASES[norm(rawType).replace(/[^a-z0-9]+/g, '')] : undefined;

        const rawOptions = pick(raw, 'options', 'opciones', 'items', 'choices');
        const optionsArr: string[] = Array.isArray(rawOptions)
          ? rawOptions.map((o: any) => String(o).trim()).filter(Boolean)
          : [];
        const correct = pick(raw, 'correct', 'correctAnswer', 'answer', 'respuesta', 'correcta');
        const pairs = pick(raw, 'pairs', 'pares', 'matches');

        // Inferir el tipo si no vino o no se reconoció.
        if (!type) {
          if (pairs) type = 'MATCHING';
          else if (Array.isArray(correct)) type = 'MULTIPLE_SELECT';
          else if (optionsArr.length) type = 'MULTIPLE_CHOICE';
          else type = 'SHORT_ANSWER';
        }

        const base: any = {
          activityId,
          type,
          text,
          points: (() => { const p = Number(pick(raw, 'points', 'puntos')); return Number.isFinite(p) && p > 0 ? p : 1; })(),
          explanation: (() => { const e = pick(raw, 'explanation', 'explicacion', 'feedback'); return e ? String(e) : null; })(),
          imageUrl: (() => { const i = pick(raw, 'imageUrl', 'imagen', 'image'); return i ? String(i) : null; })(),
          subjectArea: (() => { const s = pick(raw, 'subjectArea', 'area', 'materia'); return s ? String(s) : null; })(),
          contextId: null,
          sortOrder: sort++,
          options: undefined as any,
          correctAnswer: null as any,
        };

        if (type === 'MULTIPLE_CHOICE') {
          if (optionsArr.length < 2) { skipped.push({ index, reason: 'Opción múltiple necesita al menos 2 opciones.' }); return; }
          const resolved = resolveOption(correct, optionsArr);
          if (resolved === null) { skipped.push({ index, reason: 'La respuesta correcta no coincide con ninguna opción.' }); return; }
          base.options = optionsArr;
          base.correctAnswer = resolved;
        } else if (type === 'TRUE_FALSE') {
          const s = norm(correct);
          let val: string | null = null;
          if (correct === true || ['true', 'verdadero', 'v', 't', 'si', 'sí', '1'].includes(s)) val = 'Verdadero';
          else if (correct === false || ['false', 'falso', 'f', 'no', '0'].includes(s)) val = 'Falso';
          if (!val) { skipped.push({ index, reason: 'Verdadero/Falso necesita "correct" true o false.' }); return; }
          base.options = ['Verdadero', 'Falso'];
          base.correctAnswer = val;
        } else if (type === 'MULTIPLE_SELECT') {
          if (optionsArr.length < 2) { skipped.push({ index, reason: 'Selección múltiple necesita al menos 2 opciones.' }); return; }
          const correctList = Array.isArray(correct) ? correct : (correct !== undefined ? [correct] : []);
          const resolved = correctList.map((c: any) => resolveOption(c, optionsArr)).filter((v): v is string => v !== null);
          if (!resolved.length) { skipped.push({ index, reason: 'Ninguna respuesta correcta coincide con las opciones.' }); return; }
          base.options = optionsArr;
          base.correctAnswer = JSON.stringify([...new Set(resolved)]);
        } else if (type === 'SHORT_ANSWER') {
          const ans = String(correct ?? '').trim();
          if (!ans) { skipped.push({ index, reason: 'Respuesta corta necesita "correct".' }); return; }
          base.correctAnswer = ans;
        } else if (type === 'FILL_BLANK') {
          const rawAns = pick(raw, 'answers', 'respuestas', 'blanks', 'correct', 'correctAnswer');
          const list = (Array.isArray(rawAns) ? rawAns.map((a: any) => String(a).trim()) : (rawAns !== undefined ? [String(rawAns).trim()] : [])).filter((a) => a !== '');
          if (!list.length) { skipped.push({ index, reason: 'Completar necesita al menos una respuesta.' }); return; }
          // El alumno ve los huecos partiendo el texto por "___". Si la IA no puso
          // marcadores (o usó otros), el hueco no aparece y no se puede responder.
          // Normalizamos: rachas de guiones bajos y {{...}} → "___".
          let blankText = String(text).replace(/_{2,}/g, '___').replace(/\{\{[^}]*\}\}/g, '___');
          let count = (blankText.match(/___/g) || []).length;
          // Sin marcadores: intentar incrustar cada respuesta dentro del enunciado.
          if (count === 0) {
            for (const ans of list) {
              if (!ans) continue;
              const re = new RegExp(escapeRegExp(ans), 'i');
              if (re.test(blankText)) blankText = blankText.replace(re, '___');
            }
            count = (blankText.match(/___/g) || []).length;
            // Última opción: una sola respuesta → añadir un hueco al final.
            if (count === 0 && list.length === 1) { blankText = blankText.replace(/\s*$/, ' ___'); count = 1; }
          }
          if (count !== list.length) {
            skipped.push({ index, reason: `Completar: el texto tiene ${count} hueco(s) “___” pero hay ${list.length} respuesta(s); deben coincidir.` });
            return;
          }
          base.text = blankText;
          base.correctAnswer = JSON.stringify(list);
        } else if (type === 'ORDERING') {
          if (optionsArr.length < 2) { skipped.push({ index, reason: 'Ordenar necesita al menos 2 elementos (en el orden correcto).' }); return; }
          base.options = optionsArr;
        } else if (type === 'MATCHING') {
          let pairList: Array<{ left: string; right: string }> = [];
          if (Array.isArray(pairs)) {
            pairList = pairs
              .map((p: any) => ({ left: String(pick(p, 'left', 'izquierda', 'a') ?? '').trim(), right: String(pick(p, 'right', 'derecha', 'b') ?? '').trim() }))
              .filter((p) => p.left && p.right);
          } else if (correct && typeof correct === 'object' && !Array.isArray(correct)) {
            pairList = Object.entries(correct).map(([k, v]) => ({ left: String(k).trim(), right: String(v).trim() })).filter((p) => p.left && p.right);
          }
          if (pairList.length < 1) { skipped.push({ index, reason: 'Emparejar necesita al menos un par {left, right}.' }); return; }
          const map: Record<string, string> = {};
          pairList.forEach((p) => { map[p.left] = p.right; });
          base.options = { left: pairList.map((p) => p.left), right: [...new Set(pairList.map((p) => p.right))] };
          base.correctAnswer = JSON.stringify(map);
        } else if (type === 'NUMERIC') {
          // Respuesta numérica con tolerancia. correctAnswer = número; options.tolerance = ±.
          const numRaw = pick(raw, 'correct', 'correctAnswer', 'answer', 'respuesta', 'value', 'valor');
          const num = Number(String(numRaw ?? '').replace(',', '.'));
          if (!Number.isFinite(num)) { skipped.push({ index, reason: 'Respuesta numérica: "correct" debe ser un número.' }); return; }
          const tolRaw = pick(raw, 'tolerance', 'tolerancia', 'margen');
          const tol = Number(String(tolRaw ?? '0').replace(',', '.'));
          base.correctAnswer = String(num);
          base.options = { tolerance: Number.isFinite(tol) && tol >= 0 ? tol : 0 };
        } else if (type === 'CATEGORIZE') {
          // Clasificar ítems en categorías. Mismo formato que MATCHING: item→categoría.
          // Acepta items:[{text, category}] o correct/pairs como { item: categoria }.
          const items = pick(raw, 'items', 'elementos');
          let pairList: Array<{ left: string; right: string }> = [];
          if (Array.isArray(items)) {
            pairList = items
              .map((it: any) => ({ left: String(pick(it, 'text', 'item', 'elemento', 'left') ?? '').trim(), right: String(pick(it, 'category', 'categoria', 'grupo', 'right') ?? '').trim() }))
              .filter((p) => p.left && p.right);
          } else if (correct && typeof correct === 'object' && !Array.isArray(correct)) {
            pairList = Object.entries(correct).map(([k, v]) => ({ left: String(k).trim(), right: String(v).trim() })).filter((p) => p.left && p.right);
          } else if (Array.isArray(pairs)) {
            pairList = pairs
              .map((p: any) => ({ left: String(pick(p, 'item', 'elemento', 'left', 'text') ?? '').trim(), right: String(pick(p, 'category', 'categoria', 'right', 'grupo') ?? '').trim() }))
              .filter((p) => p.left && p.right);
          }
          if (pairList.length < 2) { skipped.push({ index, reason: 'Categorizar necesita al menos 2 ítems con su categoría.' }); return; }
          // Categorías declaradas (para incluir vacías) o derivadas de los ítems.
          const declared = pick(raw, 'categories', 'categorias', 'grupos');
          const cats = Array.isArray(declared) && declared.length
            ? [...new Set(declared.map((c: any) => String(c).trim()).filter(Boolean))]
            : [...new Set(pairList.map((p) => p.right))];
          if (cats.length < 2) { skipped.push({ index, reason: 'Categorizar necesita al menos 2 categorías distintas.' }); return; }
          const map: Record<string, string> = {};
          pairList.forEach((p) => { map[p.left] = p.right; });
          base.options = { left: pairList.map((p) => p.left), right: cats };
          base.correctAnswer = JSON.stringify(map);
        } else {
          skipped.push({ index, reason: `Tipo no reconocido: ${rawType ?? '(vacío)'}.` });
          return;
        }

        toCreate.push(base);
      } catch (e: any) {
        skipped.push({ index, reason: e?.message || 'Pregunta inválida.' });
      }
    });

    if (!toCreate.length) {
      throw new BadRequestException(`No se pudo importar ninguna pregunta. ${skipped.length} con errores. Primer error: ${skipped[0]?.reason ?? ''}`);
    }

    // Creación atómica: o entran todas las válidas, o ninguna.
    await this.prisma.$transaction(
      toCreate.map((data) => this.prisma.activityQuestion.create({ data })),
    ).then((rows) => created.push(...rows));

    return { created: created.length, skipped, total: rawList.length, questions: created };
  }

  async updateQuestion(questionId: string, teacherId: string, dto: {
    text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
    subjectArea?: string; competency?: string; contextId?: string | null;
  }) {
    const q = await this.prisma.activityQuestion.findUnique({
      where: { id: questionId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    await this.validateClassroomOwnership(q.activity.classroomId, teacherId);

    const data: any = {
      text: dto.text,
      options: dto.options,
      correctAnswer: dto.correctAnswer,
      points: dto.points,
      explanation: dto.explanation,
      imageUrl: dto.imageUrl,
      subjectArea: dto.subjectArea,
      competency: dto.competency,
    };
    if (dto.contextId !== undefined) data.contextId = dto.contextId;

    return this.prisma.activityQuestion.update({
      where: { id: questionId },
      data,
    });
  }

  async deleteQuestion(questionId: string, teacherId: string) {
    const q = await this.prisma.activityQuestion.findUnique({
      where: { id: questionId },
      include: { activity: { select: { classroomId: true } } },
    });
    if (!q) throw new NotFoundException('Pregunta no encontrada');
    await this.validateClassroomOwnership(q.activity.classroomId, teacherId);
    await this.prisma.activityQuestion.delete({ where: { id: questionId } });
    return { success: true };
  }

  async listQuestions(activityId: string, userId: string, includeAnswers: boolean) {
    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId },
      orderBy: { sortOrder: 'asc' },
      include: { context: true },
    });
    if (!includeAnswers) {
      return questions.map(q => ({ ...q, correctAnswer: undefined, explanation: undefined }));
    }
    return questions;
  }

  async reorderQuestions(activityId: string, teacherId: string, questionIds: string[]) {
    await this.validateActivityOwnership(activityId, teacherId);
    const ops = questionIds.map((id, i) =>
      this.prisma.activityQuestion.update({ where: { id }, data: { sortOrder: i } })
    );
    await this.prisma.$transaction(ops);
    return { success: true };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Taking & Auto-grading
  // ═══════════════════════════════════════════════════════════════════════════

  async startQuiz(activityId: string, userId: string) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: { classroom: { include: { teacherAssignment: true } } },
    });
    if (!activity || !activity.isPublished) throw new NotFoundException('Actividad no encontrada');

    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        student: { userId },
        groupId: activity.classroom.teacherAssignment.groupId,
        academicYearId: activity.classroom.teacherAssignment.academicYearId,
        status: 'ACTIVE',
      },
    });
    if (!enrollment) throw new ForbiddenException('No está matriculado');

    // Enforcement de dependencias (Fase 3): no se inicia un quiz bloqueado.
    if (!(await this.gating.isUnlockedForStudent(activityId, activity.classroomId, enrollment.id))) {
      throw new ForbiddenException('Este quiz está bloqueado: primero completa las actividades requeridas');
    }

    // Check max attempts
    const existingCount = await this.prisma.activitySubmission.count({
      where: { activityId, studentEnrollmentId: enrollment.id },
    });
    if (existingCount >= activity.maxAttempts) {
      throw new ForbiddenException(`Ha alcanzado el máximo de ${activity.maxAttempts} intento(s)`);
    }

    // Check for existing DRAFT (resume it)
    const draft = await this.prisma.activitySubmission.findFirst({
      where: { activityId, studentEnrollmentId: enrollment.id, status: 'DRAFT' },
    });
    if (draft) {
      const questions = await this.prisma.activityQuestion.findMany({
        where: { activityId },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true },
      });
      const existingAnswers = await this.prisma.questionAnswer.findMany({
        where: { submissionId: draft.id },
      });
      return { submission: draft, questions, answers: existingAnswers };
    }

    // Create new submission
    const submission = await this.prisma.activitySubmission.create({
      data: {
        activityId,
        studentEnrollmentId: enrollment.id,
        attemptNumber: existingCount + 1,
        status: 'DRAFT',
        startedAt: new Date(),
      },
    });

    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId },
      orderBy: activity.shuffleQuestions ? undefined : { sortOrder: 'asc' },
      select: { id: true, type: true, text: true, imageUrl: true, options: true, points: true, sortOrder: true },
    });

    // Shuffle if needed
    const finalQuestions = activity.shuffleQuestions
      ? questions.sort(() => Math.random() - 0.5)
      : questions;

    return { submission, questions: finalQuestions, answers: [] };
  }

  async saveQuizAnswer(submissionId: string, userId: string, dto: {
    questionId: string; answer?: string; selectedOptions?: any;
  }) {
    const sub = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: { studentEnrollment: { include: { student: true } } },
    });
    if (!sub || sub.studentEnrollment.student.userId !== userId) throw new ForbiddenException('No autorizado');
    if (sub.status !== 'DRAFT') throw new ForbiddenException('El quiz ya fue enviado');

    // Upsert answer
    return this.prisma.questionAnswer.upsert({
      where: { submissionId_questionId: { submissionId, questionId: dto.questionId } },
      create: { submissionId, questionId: dto.questionId, answer: dto.answer, selectedOptions: dto.selectedOptions },
      update: { answer: dto.answer, selectedOptions: dto.selectedOptions },
    });
  }

  async submitQuiz(submissionId: string, userId: string) {
    const sub = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        studentEnrollment: { include: { student: true } },
        activity: {
          include: {
            classroom: { select: { teacherAssignment: { select: { subject: { select: { name: true } } } } } },
          },
        },
      },
    });
    if (!sub || sub.studentEnrollment.student.userId !== userId) throw new ForbiddenException('No autorizado');
    if (sub.status !== 'DRAFT') throw new ForbiddenException('Ya fue enviado');

    // Auto-grade
    const questions = await this.prisma.activityQuestion.findMany({
      where: { activityId: sub.activityId },
    });
    const answers = await this.prisma.questionAnswer.findMany({
      where: { submissionId },
    });

    let totalScore = 0;
    const answerUpdates: any[] = [];

    for (const q of questions) {
      const ans = answers.find(a => a.questionId === q.id);
      if (!ans) continue;

      let isCorrect = false;
      let pointsEarned = 0;

      if (q.type === 'MULTIPLE_CHOICE' || q.type === 'TRUE_FALSE') {
        isCorrect = ans.answer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
        pointsEarned = isCorrect ? Number(q.points) : 0;
      } else if (q.type === 'MULTIPLE_SELECT') {
        const selected = (ans.selectedOptions as string[] || []).sort();
        const correct = (JSON.parse(q.correctAnswer || '[]') as string[]).sort();
        isCorrect = JSON.stringify(selected) === JSON.stringify(correct);
        pointsEarned = isCorrect ? Number(q.points) : 0;
      } else if (q.type === 'SHORT_ANSWER') {
        isCorrect = ans.answer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
        pointsEarned = isCorrect ? Number(q.points) : 0;
      } else if (q.type === 'FILL_BLANK') {
        // FILL_BLANK: correctAnswer is JSON array of blanks in order
        // answer is JSON array of student responses
        try {
          const correctBlanks = JSON.parse(q.correctAnswer || '[]') as string[];
          const studentBlanks = JSON.parse(ans.answer || '[]') as string[];
          const allCorrect = correctBlanks.every((c, i) => 
            c.trim().toLowerCase() === (studentBlanks[i] || '').trim().toLowerCase()
          );
          isCorrect = allCorrect && correctBlanks.length === studentBlanks.length;
          pointsEarned = isCorrect ? Number(q.points) : 0;
        } catch {
          isCorrect = false;
          pointsEarned = 0;
        }
      } else if (q.type === 'ORDERING') {
        // ORDERING: options contains items in correct order
        // answer is JSON array of items in student's order
        try {
          const correctOrder = q.options as string[];
          const studentOrder = JSON.parse(ans.answer || '[]') as string[];
          isCorrect = JSON.stringify(correctOrder) === JSON.stringify(studentOrder);
          pointsEarned = isCorrect ? Number(q.points) : 0;
        } catch {
          isCorrect = false;
          pointsEarned = 0;
        }
      } else if (q.type === 'NUMERIC') {
        // Respuesta numérica: correcta si |respuesta - esperada| <= tolerancia.
        const expected = parseFloat(String(q.correctAnswer ?? '').replace(',', '.'));
        const given = parseFloat(String(ans.answer ?? '').replace(',', '.'));
        const tol = Number((q.options as any)?.tolerance) || 0;
        isCorrect = Number.isFinite(expected) && Number.isFinite(given) && Math.abs(given - expected) <= tol;
        pointsEarned = isCorrect ? Number(q.points) : 0;
      } else if (q.type === 'MATCHING' || q.type === 'CATEGORIZE') {
        // MATCHING/CATEGORIZE: correctAnswer is JSON object { leftItem: rightItem, ... }
        // (CATEGORIZE = item -> categoría). answer is JSON object con las respuestas.
        try {
          const correctPairs = JSON.parse(q.correctAnswer || '{}') as Record<string, string>;
          const studentPairs = JSON.parse(ans.answer || '{}') as Record<string, string>;
          const allCorrect = Object.keys(correctPairs).every(k => 
            correctPairs[k] === studentPairs[k]
          );
          isCorrect = allCorrect && Object.keys(correctPairs).length === Object.keys(studentPairs).length;
          pointsEarned = isCorrect ? Number(q.points) : 0;
        } catch {
          isCorrect = false;
          pointsEarned = 0;
        }
      }

      totalScore += pointsEarned;
      answerUpdates.push(
        this.prisma.questionAnswer.update({
          where: { id: ans.id },
          data: { isCorrect, pointsEarned },
        })
      );
    }

    // Normalize score to maxScore scale
    const totalPoints = questions.reduce((sum, q) => sum + Number(q.points), 0);
    const maxScore = sub.activity.maxScore ? Number(sub.activity.maxScore) : totalPoints;
    const normalizedScore = totalPoints > 0 ? (totalScore / totalPoints) * maxScore : 0;

    const now = new Date();
    const timeSpent = sub.startedAt ? Math.floor((now.getTime() - sub.startedAt.getTime()) / 1000) : null;

    await this.prisma.$transaction([
      ...answerUpdates,
      this.prisma.activitySubmission.update({
        where: { id: submissionId },
        data: {
          status: 'AUTO_GRADED',
          score: Math.round(normalizedScore * 10) / 10,
          submittedAt: now,
          timeSpentSeconds: timeSpent,
          gradedAt: now,
        },
      }),
    ]);

    // Gamificación: XP por DOMINIO normalizado (hasta 30 XP según % de acierto),
    // una sola vez por actividad y estudiante (anti-farming). Nunca rompe el flujo.
    try {
      const fraction = maxScore > 0 ? Math.min(normalizedScore / maxScore, 1) : 0;
      const xpAmount = Math.round(fraction * 30);
      if (xpAmount > 0) {
        await this.identity.grantXp({
          institutionId: sub.studentEnrollment.institutionId,
          studentId: sub.studentEnrollment.studentId,
          studentEnrollmentId: sub.studentEnrollmentId,
          source: 'QUIZ_GRADED',
          amount: xpAmount,
          skill: sub.activity.classroom.teacherAssignment.subject?.name ?? null,
          reason: `Quiz: ${sub.activity.title}`,
          idempotencyKey: `quiz:activity:${sub.activityId}:enrollment:${sub.studentEnrollmentId}`,
        });
      }
    } catch (err: any) {
      this.logger.warn(`XP de quiz no concedido (no crítico): ${err?.message || err}`);
    }

    // Evidencia de competencias: si esta actividad es paso de una ruta con can-do.
    await this.evidence.recordFromActivity({
      institutionId: sub.studentEnrollment.institutionId,
      studentId: sub.studentEnrollment.studentId,
      studentEnrollmentId: sub.studentEnrollmentId,
      activityId: sub.activityId,
      scorePercent: maxScore > 0 ? Math.min(normalizedScore / maxScore, 1) * 100 : 0,
      source: 'QUIZ', sourceRef: submissionId,
    });

    // Return result
    return this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        answers: { include: { question: true } },
        activity: { select: { title: true, maxScore: true, showResults: true } },
      },
    });
  }

  async getQuizResult(submissionId: string, userId: string) {
    const sub = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        studentEnrollment: { include: { student: true } },
        answers: { include: { question: true } },
        activity: { select: { id: true, title: true, maxScore: true, showResults: true } },
      },
    });
    if (!sub) throw new NotFoundException('Entrega no encontrada');

    // Student can only see own results
    const isOwner = sub.studentEnrollment.student.userId === userId;
    // Teacher can see any
    if (!isOwner) {
      await this.validateClassroomOwnership(
        (await this.prisma.classroomActivity.findUnique({ where: { id: sub.activityId } }))?.classroomId || '',
        userId
      );
    }

    // If showResults is false and student viewing, hide correct answers
    if (!sub.activity.showResults && isOwner) {
      return {
        ...sub,
        answers: sub.answers.map(a => ({
          ...a,
          question: { ...a.question, correctAnswer: undefined, explanation: undefined },
        })),
      };
    }

    return sub;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ICFES SIMULATOR – Results by area
  // ═══════════════════════════════════════════════════════════════════════════

  async getIcfesResults(submissionId: string, userId: string) {
    const sub = await this.prisma.activitySubmission.findUnique({
      where: { id: submissionId },
      include: {
        studentEnrollment: { include: { student: true } },
        answers: { include: { question: true } },
        activity: { select: { id: true, title: true, maxScore: true, showResults: true, type: true } },
      },
    });
    if (!sub) throw new NotFoundException('Entrega no encontrada');

    const isOwner = sub.studentEnrollment.student.userId === userId;
    if (!isOwner) {
      await this.validateClassroomOwnership(
        (await this.prisma.classroomActivity.findUnique({ where: { id: sub.activityId } }))?.classroomId || '',
        userId
      );
    }

    // Group answers by subjectArea
    const areaMap: Record<string, { correct: number; total: number; points: number; maxPoints: number; answers: any[] }> = {};
    for (const a of sub.answers) {
      const area = a.question.subjectArea || 'General';
      if (!areaMap[area]) areaMap[area] = { correct: 0, total: 0, points: 0, maxPoints: 0, answers: [] };
      areaMap[area].total++;
      areaMap[area].maxPoints += Number(a.question.points);
      if (a.isCorrect) {
        areaMap[area].correct++;
        areaMap[area].points += Number(a.pointsEarned || 0);
      }
      areaMap[area].answers.push(a);
    }

    const areas = Object.entries(areaMap).map(([name, data]) => ({
      name,
      correct: data.correct,
      total: data.total,
      percentage: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      points: data.points,
      maxPoints: data.maxPoints,
      answers: sub.activity.showResults || !isOwner ? data.answers : data.answers.map(a => ({
        ...a, question: { ...a.question, correctAnswer: undefined, explanation: undefined },
      })),
    }));

    // Calculate global ICFES-style score (0-500)
    const totalCorrect = sub.answers.filter(a => a.isCorrect).length;
    const totalQuestions = sub.answers.length;
    const globalPercentage = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
    const icfesGlobalScore = Math.round(globalPercentage * 5); // Scale to 0-500

    return {
      id: sub.id,
      status: sub.status,
      score: sub.score,
      maxScore: sub.activity.maxScore,
      startedAt: sub.startedAt,
      submittedAt: sub.submittedAt,
      timeSpentSeconds: sub.timeSpentSeconds,
      activity: sub.activity,
      student: { firstName: sub.studentEnrollment.student.firstName, lastName: sub.studentEnrollment.student.lastName },
      totalCorrect,
      totalQuestions,
      globalPercentage: Math.round(globalPercentage),
      icfesGlobalScore,
      areas,
    };
  }

  async getIcfesClassroomResults(activityId: string, teacherId: string) {
    await this.validateActivityOwnership(activityId, teacherId);
    const submissions = await this.prisma.activitySubmission.findMany({
      where: { activityId, status: { in: ['AUTO_GRADED', 'GRADED'] } },
      include: {
        studentEnrollment: { include: { student: { select: { firstName: true, lastName: true, secondLastName: true } } } },
        answers: { include: { question: { select: { subjectArea: true, points: true } } } },
      },
      orderBy: { score: 'desc' },
    });

    return submissions.map(sub => {
      const areaMap: Record<string, { correct: number; total: number }> = {};
      for (const a of sub.answers) {
        const area = a.question.subjectArea || 'General';
        if (!areaMap[area]) areaMap[area] = { correct: 0, total: 0 };
        areaMap[area].total++;
        if (a.isCorrect) areaMap[area].correct++;
      }
      const areas = Object.entries(areaMap).map(([name, d]) => ({
        name, correct: d.correct, total: d.total, percentage: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0,
      }));
      const totalCorrect = sub.answers.filter(a => a.isCorrect).length;
      const totalQuestions = sub.answers.length;
      return {
        id: sub.id,
        student: sub.studentEnrollment.student,
        score: sub.score,
        totalCorrect,
        totalQuestions,
        globalPercentage: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
        icfesGlobalScore: totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 500) : 0,
        areas,
        submittedAt: sub.submittedAt,
        timeSpentSeconds: sub.timeSpentSeconds,
      };
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

  async updateForumPost(postId: string, userId: string, isTeacher: boolean, dto: { title?: string; content?: string }) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Publicación no encontrada');

    if (post.authorId !== userId) {
      if (!isTeacher || !post.classroomId) throw new ForbiddenException('No tiene permisos');
      await this.validateClassroomOwnership(post.classroomId, userId);
    }

    return this.prisma.forumPost.update({
      where: { id: postId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
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

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY CLASSROOM
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Copia el contenido de un aula a otras aulas del mismo docente
   * Copia: secciones, materiales, actividades (sin entregas), preguntas de quiz
   */
  async copyClassroomTo(sourceClassroomId: string, targetTeacherAssignmentIds: string[], teacherId: string) {
    // Validate source classroom ownership
    const source = await this.prisma.classroom.findUnique({
      where: { id: sourceClassroomId },
      include: {
        teacherAssignment: { select: { teacherId: true } },
        sections: {
          include: {
            materials: true,
            activities: {
              include: { questions: true },
            },
          },
        },
        announcements: true,
      },
    });

    if (!source || source.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Aula origen no encontrada o no tiene permisos');
    }

    const results: { targetId: string; classroomId?: string; error?: string }[] = [];

    // Copy forum topics created by the teacher (root posts only)
    const forumTopics = await this.prisma.forumPost.findMany({
      where: {
        classroomId: sourceClassroomId,
        parentId: null,
        authorId: teacherId,
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const targetAssignmentId of targetTeacherAssignmentIds) {
      try {
        // Validate target assignment belongs to same teacher
        const targetAssignment = await this.prisma.teacherAssignment.findFirst({
          where: { id: targetAssignmentId, teacherId, endDate: null },
          include: { group: { include: { grade: true } }, subject: true },
        });

        if (!targetAssignment) {
          results.push({ targetId: targetAssignmentId, error: 'Asignación no encontrada o no pertenece al docente' });
          continue;
        }

        // Check if classroom already exists for this assignment
        let targetClassroom = await this.prisma.classroom.findUnique({
          where: { teacherAssignmentId: targetAssignmentId },
        });

        // Create classroom if it doesn't exist
        if (!targetClassroom) {
          const title = `${targetAssignment.subject.name} - ${targetAssignment.group.grade.name} ${targetAssignment.group.name}`;
          targetClassroom = await this.prisma.classroom.create({
            data: {
              institutionId: targetAssignment.institutionId,
              teacherAssignmentId: targetAssignmentId,
              title,
              color: source.color,
            },
          });
        }

        // Copy sections with materials and activities
        for (const section of source.sections) {
          const newSection = await this.prisma.classroomSection.create({
            data: {
              classroomId: targetClassroom.id,
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder,
              isVisible: section.isVisible,
            },
          });

          // Copy materials
          for (const material of section.materials) {
            await this.prisma.classroomMaterial.create({
              data: {
                sectionId: newSection.id,
                type: material.type,
                title: material.title,
                content: material.content,
                fileUrl: material.fileUrl, // Keep same file reference
                sortOrder: material.sortOrder,
                isVisible: material.isVisible,
              },
            });
          }

          // Copy activities (without submissions)
          for (const activity of section.activities) {
            const newActivity = await this.prisma.classroomActivity.create({
              data: {
                sectionId: newSection.id,
                classroomId: targetClassroom.id,
                type: activity.type,
                title: activity.title,
                description: activity.description,
                maxScore: activity.maxScore,
                dueDate: null, // Reset due date
                openDate: null,
                timeLimitMinutes: activity.timeLimitMinutes,
                allowLateSubmit: activity.allowLateSubmit,
                maxAttempts: activity.maxAttempts,
                shuffleQuestions: activity.shuffleQuestions,
                showResults: activity.showResults,
                isVisible: false, // Start as not visible
                isPublished: false, // Start as not published
                sortOrder: activity.sortOrder,
                metadata: activity.metadata as any,
              },
            });

            // Copy questions for quiz/exam
            for (const question of activity.questions) {
              await this.prisma.activityQuestion.create({
                data: {
                  activityId: newActivity.id,
                  type: question.type,
                  text: question.text,
                  imageUrl: question.imageUrl,
                  options: question.options as any,
                  correctAnswer: question.correctAnswer,
                  points: question.points,
                  explanation: question.explanation,
                  subjectArea: question.subjectArea,
                  sortOrder: question.sortOrder,
                },
              });
            }
          }
        }

        // Copy forum topics (teacher-created) to target classroom
        for (const topic of forumTopics) {
          await this.prisma.forumPost.create({
            data: {
              classroomId: targetClassroom.id,
              authorId: teacherId,
              parentId: null,
              title: topic.title,
              content: topic.content,
              isAnonymous: topic.isAnonymous,
              isPinned: topic.isPinned,
            },
          });
        }

        results.push({ targetId: targetAssignmentId, classroomId: targetClassroom.id });
      } catch (error: any) {
        results.push({ targetId: targetAssignmentId, error: error.message || 'Error desconocido' });
      }
    }

    return { copied: results.filter(r => r.classroomId).length, results };
  }

  /**
   * Lista las aulas disponibles del docente para copiar contenido
   */
  async listTeacherClassroomsForCopy(teacherId: string, institutionId: string, excludeClassroomId?: string) {
    const assignments = await this.prisma.teacherAssignment.findMany({
      where: { teacherId, institutionId, endDate: null },
      select: { id: true },
    });
    const assignmentIds = assignments.map(a => a.id);

    return this.prisma.classroom.findMany({
      where: {
        teacherAssignmentId: { in: assignmentIds },
        isActive: true,
        ...(excludeClassroomId && { id: { not: excludeClassroomId } }),
      },
      select: {
        id: true,
        title: true,
        color: true,
        teacherAssignment: {
          select: {
            id: true,
            group: { select: { id: true, name: true, grade: { select: { name: true } } } },
            subject: { select: { name: true } },
          },
        },
      },
      orderBy: { title: 'asc' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DUPLICATE MATERIAL/ACTIVITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Duplica un material a otra sección (puede ser de otra aula)
   */
  async duplicateMaterial(materialId: string, targetSectionId: string, teacherId: string) {
    // Validate source material ownership
    const material = await this.validateMaterialOwnership(materialId, teacherId);

    // Validate target section ownership
    const targetSection = await this.validateSectionOwnership(targetSectionId, teacherId);

    // Get max sortOrder in target section
    const maxSort = await this.prisma.classroomMaterial.aggregate({
      where: { sectionId: targetSectionId },
      _max: { sortOrder: true },
    });

    const newMaterial = await this.prisma.classroomMaterial.create({
      data: {
        sectionId: targetSectionId,
        type: material.type,
        title: `${material.title} (copia)`,
        content: material.content,
        fileUrl: material.fileUrl,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        isVisible: false,
      },
    });

    return newMaterial;
  }

  /**
   * Duplica una actividad a otra sección/aula (con preguntas si es quiz)
   */
  async duplicateActivity(activityId: string, targetSectionId: string, teacherId: string) {
    // Validate source activity ownership
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
        questions: true,
      },
    });

    if (!activity || activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Actividad no encontrada o no tiene permisos');
    }

    // Validate target section ownership
    const targetSection = await this.prisma.classroomSection.findUnique({
      where: { id: targetSectionId },
      include: {
        classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
      },
    });

    if (!targetSection || targetSection.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Sección destino no encontrada o no tiene permisos');
    }

    // Get max sortOrder in target section
    const maxSort = await this.prisma.classroomActivity.aggregate({
      where: { sectionId: targetSectionId },
      _max: { sortOrder: true },
    });

    // Create duplicated activity
    const newActivity = await this.prisma.classroomActivity.create({
      data: {
        sectionId: targetSectionId,
        classroomId: targetSection.classroomId,
        type: activity.type,
        title: `${activity.title} (copia)`,
        description: activity.description,
        maxScore: activity.maxScore,
        dueDate: null,
        openDate: null,
        timeLimitMinutes: activity.timeLimitMinutes,
        allowLateSubmit: activity.allowLateSubmit,
        maxAttempts: activity.maxAttempts,
        shuffleQuestions: activity.shuffleQuestions,
        showResults: activity.showResults,
        isVisible: true,
        isPublished: false,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        metadata: activity.metadata as any,
      },
    });

    // Copy questions if any
    for (const question of activity.questions) {
      await this.prisma.activityQuestion.create({
        data: {
          activityId: newActivity.id,
          type: question.type,
          text: question.text,
          imageUrl: question.imageUrl,
          options: question.options as any,
          correctAnswer: question.correctAnswer,
          points: question.points,
          explanation: question.explanation,
          subjectArea: question.subjectArea,
          sortOrder: question.sortOrder,
        },
      });
    }

    return newActivity;
  }

  /**
   * Copia una sección completa (con materiales y actividades) a otro aula
   */
  async copySectionToClassroom(
    sectionId: string,
    targetClassroomId: string,
    teacherId: string,
  ) {
    // Validate source section ownership
    const sourceSection = await this.prisma.classroomSection.findUnique({
      where: { id: sectionId },
      include: {
        classroom: { include: { teacherAssignment: { select: { teacherId: true } } } },
        materials: { orderBy: { sortOrder: 'asc' } },
        activities: {
          orderBy: { sortOrder: 'asc' },
          include: { questions: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });

    if (!sourceSection || sourceSection.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Sección no encontrada o no tiene permisos');
    }

    // Validate target classroom ownership
    const targetClassroom = await this.prisma.classroom.findUnique({
      where: { id: targetClassroomId },
      include: { teacherAssignment: { select: { teacherId: true } } },
    });

    if (!targetClassroom || targetClassroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('Aula destino no encontrada o no tiene permisos');
    }

    // Check if section with same name already exists in target classroom
    const existingSection = await this.prisma.classroomSection.findFirst({
      where: {
        classroomId: targetClassroomId,
        title: sourceSection.title,
      },
    });

    if (existingSection) {
      throw new BadRequestException(
        `Ya existe una sección llamada "${sourceSection.title}" en el aula destino. Renombre la sección existente o la sección a copiar antes de continuar.`,
      );
    }

    // Get max sortOrder in target classroom sections
    const maxSort = await this.prisma.classroomSection.aggregate({
      where: { classroomId: targetClassroomId },
      _max: { sortOrder: true },
    });

    // Create new section in target classroom
    const newSection = await this.prisma.classroomSection.create({
      data: {
        classroomId: targetClassroomId,
        title: sourceSection.title,
        description: sourceSection.description,
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        isVisible: sourceSection.isVisible,
      },
    });

    // Copy materials
    for (const material of sourceSection.materials) {
      await this.prisma.classroomMaterial.create({
        data: {
          sectionId: newSection.id,
          type: material.type,
          title: material.title,
          content: material.content,
          fileUrl: material.fileUrl, // Keep same file reference
          sortOrder: material.sortOrder,
          isVisible: material.isVisible,
        },
      });
    }

    // Copy activities (without submissions)
    for (const activity of sourceSection.activities) {
      const newActivity = await this.prisma.classroomActivity.create({
        data: {
          sectionId: newSection.id,
          classroomId: targetClassroomId,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          maxScore: activity.maxScore,
          dueDate: null, // Reset due date
          openDate: null,
          timeLimitMinutes: activity.timeLimitMinutes,
          allowLateSubmit: activity.allowLateSubmit,
          maxAttempts: activity.maxAttempts,
          shuffleQuestions: activity.shuffleQuestions,
          showResults: activity.showResults,
          isVisible: false, // Start as not visible
          isPublished: false, // Start as not published
          sortOrder: activity.sortOrder,
          metadata: activity.metadata as any,
        },
      });

      // Copy questions for quiz/exam
      for (const question of activity.questions) {
        await this.prisma.activityQuestion.create({
          data: {
            activityId: newActivity.id,
            type: question.type,
            text: question.text,
            imageUrl: question.imageUrl,
            options: question.options as any,
            correctAnswer: question.correctAnswer,
            points: question.points,
            explanation: question.explanation,
            subjectArea: question.subjectArea,
            sortOrder: question.sortOrder,
          },
        });
      }
    }

    return {
      success: true,
      newSectionId: newSection.id,
      materialsCopied: sourceSection.materials.length,
      activitiesCopied: sourceSection.activities.length,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADEBOOK SYNC — Activities → Planilla de Notas
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Resolve grading scale from Institution.academicLevelsConfig JSON.
   * Matches by grade stage/name against levels' grades[] array.
   */
  private async resolveScale(institutionId: string, gradeStage: string, gradeName: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { academicLevelsConfig: true, gradingConfig: true },
    });
    const levels = (institution?.academicLevelsConfig as any[]) || [];
    // El nivel se resuelve por ETAPA (BASICA_PRIMARIA ↔ "Primaria"). Antes se comparaba
    // el enum contra el código del nivel sin normalizar, así que nunca casaba y la
    // escala POR NIVEL se ignoraba en silencio (caía siempre a 1–5 / aprueba 3).
    const level = findLevelForGrade(levels, gradeStage, gradeName);
    return {
      min: level?.minGrade ?? 1,
      max: level?.maxGrade ?? 5,
      passing: level?.minPassingGrade ?? 3,
      gradingConfig: institution?.gradingConfig as any,
    };
  }

  /**
   * Get gradebook configuration for a classroom (evaluative processes, active term, scale).
   * Chain: Classroom → TeacherAssignment → Group → Grade → AcademicLevel → gradingConfig
   */
  async getGradebookConfig(classroomId: string, teacherId: string) {
    const classroom = await this.prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        teacherAssignment: {
          include: {
            group: {
              include: { grade: true },
            },
          },
        },
      },
    });
    if (!classroom || classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene permisos sobre esta aula');
    }

    const ta = classroom.teacherAssignment;
    const grade = ta.group.grade;

    // Resolve scale from Institution.academicLevelsConfig JSON
    const scaleInfo = await this.resolveScale(classroom.institutionId, grade.stage, grade.name);

    // Include OPEN and CLOSED terms so the user has full visibility; only OPEN is selectable.
    // FINALIZED is excluded (the academic year is locked).
    const allTerms = await this.prisma.academicTerm.findMany({
      where: {
        academicYearId: ta.academicYearId,
        status: { in: ['OPEN', 'CLOSED'] },
      },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, status: true, order: true },
    });

    // Default active term: most recent OPEN (no fallback to CLOSED — CLOSED is not selectable for sync)
    const activeTerm = [...allTerms].reverse().find(t => t.status === 'OPEN') ?? null;

    // Get existing PartialGrades grouped by term so the frontend can switch periods instantly
    const allTermIds = allTerms.map(t => t.id);
    const allExistingGrades = allTermIds.length > 0 ? await this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId: ta.id,
        academicTermId: { in: allTermIds },
      },
      select: { academicTermId: true, componentType: true, activityIndex: true, activityName: true },
    }) : [];

    // Group by termId, distinct by (componentType, activityIndex)
    const existingSlotsByTerm: Record<string, Array<{ componentType: string; activityIndex: number; activityName: string | null }>> = {};
    for (const t of allTerms) existingSlotsByTerm[t.id] = [];
    const seen = new Set<string>();
    for (const g of allExistingGrades) {
      const key = `${g.academicTermId}:${g.componentType}:${g.activityIndex}`;
      if (seen.has(key)) continue;
      seen.add(key);
      existingSlotsByTerm[g.academicTermId].push({
        componentType: g.componentType,
        activityIndex: g.activityIndex,
        activityName: g.activityName,
      });
    }
    // Backwards-compat flat list for the default term
    const existingGrades = activeTerm ? existingSlotsByTerm[activeTerm.id] : [];

    // Get activities already linked to gradebook
    const linkedActivities = await this.prisma.classroomActivity.findMany({
      where: { classroomId, syncToGradebook: true },
      select: { id: true, title: true, gradebookComponent: true, gradebookIndex: true },
    });

    // FASE 2 — La estructura de evaluación sale de la tabla de componentes, que es
    // la MISMA fuente de la que el motor hereda los pesos. Antes esto se leía de un
    // JSON aparte, así que el docente veía una estructura y la nota se calculaba con
    // otra. Se conserva el JSON como respaldo mientras una institución no tenga
    // estructura creada.
    const roots = await this.prisma.evaluationComponent.findMany({
      where: { institutionId: classroom.institutionId, parentId: null },
      include: { children: true },
    });

    let processes: any[];
    if (roots.length > 0) {
      processes = [...roots]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
        .map((p) => ({
          code: p.code,
          name: p.name,
          weight: p.weightPercentage ?? 0,
          subprocesses: [...p.children]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name))
            .map((c) => ({
              code: c.code,
              name: c.name,
              weightPercentage: c.weightPercentage ?? 0,
            })),
        }));
    } else {
      const gradingCfg = scaleInfo.gradingConfig || { evaluationProcesses: [] };
      processes = (gradingCfg.evaluationProcesses || []).map((p: any) => ({
        code: p.code || p.name?.toUpperCase().replace(/\s+/g, '_'),
        name: p.name,
        weight: p.weightPercentage,
        subprocesses: p.subprocesses || [],
      }));
    }

    return {
      teacherAssignmentId: ta.id,
      academicTermId: activeTerm?.id || null,
      academicTermName: activeTerm?.name || null,
      academicTermStatus: activeTerm?.status || null,
      availableTerms: allTerms,
      scale: { min: scaleInfo.min, max: scaleInfo.max, passing: scaleInfo.passing },
      processes,
      existingSlots: existingGrades,
      existingSlotsByTerm,
      linkedActivities,
    };
  }

  /**
   * Update gradebook link for an activity (configure sync destination).
   */
  async updateGradebookLink(activityId: string, teacherId: string, dto: {
    syncToGradebook: boolean;
    gradebookComponent?: string;
    gradebookIndex?: number;
  }) {
    await this.validateActivityOwnership(activityId, teacherId);

    return this.prisma.classroomActivity.update({
      where: { id: activityId },
      data: {
        syncToGradebook: dto.syncToGradebook,
        gradebookComponent: dto.syncToGradebook ? dto.gradebookComponent : null,
        gradebookIndex: dto.syncToGradebook ? dto.gradebookIndex : null,
      },
      select: { id: true, syncToGradebook: true, gradebookComponent: true, gradebookIndex: true },
    });
  }

  /**
   * Preview sync: shows what would happen without writing anything.
   */
  async previewGradebookSync(activityId: string, teacherId: string, academicTermId?: string) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: {
          include: {
            teacherAssignment: {
              include: {
                group: { include: { grade: true } },
              },
            },
          },
        },
      },
    });
    if (!activity || activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene permisos');
    }
    if (!activity.syncToGradebook || !activity.gradebookComponent || activity.gradebookIndex == null) {
      throw new BadRequestException('La actividad no está vinculada a la planilla');
    }

    const ta = activity.classroom.teacherAssignment;
    const maxScore = activity.maxScore ? Number(activity.maxScore) : 5;

    // Get scale
    const scaleInfo = await this.resolveScale(activity.classroom.institutionId, ta.group.grade.stage, ta.group.grade.name);
    const scaleMin = scaleInfo.min;
    const scaleMax = scaleInfo.max;

    // Get target term: must be OPEN. Use explicit termId if provided, otherwise the most-recent OPEN.
    let activeTerm: { id: string; name: string; status: string } | null = null;
    if (academicTermId) {
      activeTerm = await this.prisma.academicTerm.findUnique({
        where: { id: academicTermId },
        select: { id: true, name: true, status: true },
      });
      if (!activeTerm) throw new BadRequestException('Período académico no encontrado');
    } else {
      activeTerm = await this.prisma.academicTerm.findFirst({
        where: { academicYearId: ta.academicYearId, status: 'OPEN' },
        orderBy: { order: 'desc' },
        select: { id: true, name: true, status: true },
      });
    }
    if (!activeTerm) throw new BadRequestException('No hay período académico abierto');
    if (activeTerm.status === 'CLOSED') throw new ForbiddenException('El período está cerrado — no se permite sincronizar a períodos cerrados');
    if (activeTerm.status === 'FINALIZED') throw new ForbiddenException('El período está finalizado');

    // Get all enrolled students
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { groupId: ta.groupId, academicYearId: ta.academicYearId, status: 'ACTIVE' },
      include: { student: { select: { firstName: true, lastName: true } } },
    });

    // Get best submission per student (MAX score across attempts)
    const submissions = await this.prisma.activitySubmission.findMany({
      where: {
        activityId: activity.id,
        status: { in: ['GRADED', 'AUTO_GRADED'] },
      },
      select: { studentEnrollmentId: true, score: true, gradedAt: true, attemptNumber: true, syncedToGradebook: true },
    });

    // Build best score per student
    const bestScores = new Map<string, { score: number; gradedAt: Date | null; attempts: number; synced: boolean }>();
    for (const sub of submissions) {
      const score = sub.score ? Number(sub.score) : 0;
      const existing = bestScores.get(sub.studentEnrollmentId);
      if (!existing || score > existing.score) {
        bestScores.set(sub.studentEnrollmentId, {
          score,
          gradedAt: sub.gradedAt,
          attempts: (existing?.attempts || 0) + 1,
          synced: sub.syncedToGradebook,
        });
      } else {
        existing.attempts++;
      }
    }

    // Get existing PartialGrades for this slot
    const existingGrades = await this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId: ta.id,
        academicTermId: activeTerm.id,
        componentType: activity.gradebookComponent!,
        activityIndex: activity.gradebookIndex!,
      },
      select: { studentEnrollmentId: true, score: true, updatedAt: true },
    });
    const existingGradeMap = new Map(existingGrades.map(g => [g.studentEnrollmentId, { score: Number(g.score), updatedAt: g.updatedAt }]));

    // Build preview rows
    const rows = enrollments.map(enr => {
      const best = bestScores.get(enr.id);
      const existing = existingGradeMap.get(enr.id);

      // Normalize score to institutional scale
      const activityScore = best?.score || 0;
      const normalizedScore = maxScore > 0
        ? Math.round(((activityScore / maxScore) * (scaleMax - scaleMin) + scaleMin) * 10) / 10
        : scaleMin;
      const clampedScore = Math.min(Math.max(normalizedScore, scaleMin), scaleMax);

      let action: 'create' | 'update' | 'skip' | 'conflict' | 'no_submission' = 'no_submission';
      if (!best) {
        action = 'no_submission';
      } else if (!existing) {
        action = 'create';
      } else if (existing.score === clampedScore) {
        action = 'skip'; // Already in sync
      } else if (best.gradedAt && existing.updatedAt > best.gradedAt) {
        action = 'conflict'; // Teacher edited in planilla after grading
      } else {
        action = 'update';
      }

      return {
        studentEnrollmentId: enr.id,
        studentName: `${enr.student.firstName} ${enr.student.lastName}`,
        activityScore: best ? activityScore : null,
        normalizedScore: best ? clampedScore : null,
        existingGrade: existing?.score ?? null,
        action,
        attempts: best?.attempts || 0,
      };
    });

    return {
      activityId: activity.id,
      activityTitle: activity.title,
      destination: {
        component: activity.gradebookComponent,
        index: activity.gradebookIndex,
        termName: activeTerm.name,
        termId: activeTerm.id,
      },
      scale: { min: scaleMin, max: scaleMax },
      maxScore,
      rows,
      summary: {
        total: rows.length,
        toCreate: rows.filter(r => r.action === 'create').length,
        toUpdate: rows.filter(r => r.action === 'update').length,
        conflicts: rows.filter(r => r.action === 'conflict').length,
        noSubmission: rows.filter(r => r.action === 'no_submission').length,
        alreadySynced: rows.filter(r => r.action === 'skip').length,
      },
    };
  }

  /**
   * Execute sync: write grades to planilla (PartialGrade).
   * Only writes for specified students (from preview confirmation).
   */
  async syncToGradebook(activityId: string, teacherId: string, dto: {
    studentEnrollmentIds?: string[]; // If empty, sync all eligible
    includeConflicts?: boolean; // Force overwrite planilla edits
    includeNoSubmission?: boolean; // Write minGrade for students without submissions
    academicTermId?: string; // Explicit target period (defaults to most-recent OPEN/CLOSED)
  }) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: {
          include: {
            teacherAssignment: {
              include: {
                group: { include: { grade: true } },
              },
            },
          },
        },
      },
    });
    if (!activity || activity.classroom.teacherAssignment.teacherId !== teacherId) {
      throw new ForbiddenException('No tiene permisos');
    }
    if (!activity.syncToGradebook || !activity.gradebookComponent || activity.gradebookIndex == null) {
      throw new BadRequestException('La actividad no está vinculada a la planilla');
    }

    const ta = activity.classroom.teacherAssignment;
    const maxScore = activity.maxScore ? Number(activity.maxScore) : 5;

    // Get scale
    const scaleInfo2 = await this.resolveScale(activity.classroom.institutionId, ta.group.grade.stage, ta.group.grade.name);
    const scaleMin = scaleInfo2.min;
    const scaleMax = scaleInfo2.max;

    // Get target term: must be OPEN. Use explicit termId if provided, otherwise the most-recent OPEN.
    let activeTerm: { id: string; status: string } | null = null;
    if (dto.academicTermId) {
      activeTerm = await this.prisma.academicTerm.findUnique({
        where: { id: dto.academicTermId },
        select: { id: true, status: true },
      });
      if (!activeTerm) throw new BadRequestException('Período académico no encontrado');
    } else {
      activeTerm = await this.prisma.academicTerm.findFirst({
        where: { academicYearId: ta.academicYearId, status: 'OPEN' },
        orderBy: { order: 'desc' },
        select: { id: true, status: true },
      });
    }
    if (!activeTerm) throw new BadRequestException('No hay período académico abierto');
    if (activeTerm.status === 'CLOSED') throw new ForbiddenException('El período está cerrado — no se permite sincronizar a períodos cerrados');
    if (activeTerm.status === 'FINALIZED') throw new ForbiddenException('El período está finalizado');

    // Get enrollments
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { groupId: ta.groupId, academicYearId: ta.academicYearId, status: 'ACTIVE' },
      select: { id: true },
    });
    const targetIds = dto.studentEnrollmentIds?.length
      ? enrollments.filter(e => dto.studentEnrollmentIds!.includes(e.id)).map(e => e.id)
      : enrollments.map(e => e.id);

    // Get best submission per student
    const submissions = await this.prisma.activitySubmission.findMany({
      where: {
        activityId: activity.id,
        status: { in: ['GRADED', 'AUTO_GRADED'] },
        studentEnrollmentId: { in: targetIds },
      },
      select: { id: true, studentEnrollmentId: true, score: true, gradedAt: true },
      orderBy: { score: 'desc' },
    });

    const bestSubmissions = new Map<string, { id: string; score: number; gradedAt: Date | null }>();
    for (const sub of submissions) {
      if (!bestSubmissions.has(sub.studentEnrollmentId)) {
        bestSubmissions.set(sub.studentEnrollmentId, {
          id: sub.id,
          score: sub.score ? Number(sub.score) : 0,
          gradedAt: sub.gradedAt,
        });
      }
    }

    // Get existing planilla grades for conflict detection
    const existingGrades = await this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId: ta.id,
        academicTermId: activeTerm.id,
        componentType: activity.gradebookComponent!,
        activityIndex: activity.gradebookIndex!,
        studentEnrollmentId: { in: targetIds },
      },
      select: { studentEnrollmentId: true, updatedAt: true },
    });
    const existingMap = new Map(existingGrades.map(g => [g.studentEnrollmentId, g.updatedAt]));

    let synced = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const enrollmentId of targetIds) {
      const best = bestSubmissions.get(enrollmentId);

      if (!best && !dto.includeNoSubmission) {
        skipped++;
        continue;
      }

      const activityScore = best?.score || 0;
      const normalizedScore = maxScore > 0
        ? Math.round(((activityScore / maxScore) * (scaleMax - scaleMin) + scaleMin) * 10) / 10
        : scaleMin;
      const clampedScore = Math.min(Math.max(normalizedScore, scaleMin), scaleMax);

      // Conflict check: if planilla was edited after grading, skip unless forced
      const existingUpdatedAt = existingMap.get(enrollmentId);
      if (existingUpdatedAt && best?.gradedAt && existingUpdatedAt > best.gradedAt && !dto.includeConflicts) {
        skipped++;
        continue;
      }

      try {
        await this.prisma.partialGrade.upsert({
          where: {
            studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
              studentEnrollmentId: enrollmentId,
              teacherAssignmentId: ta.id,
              academicTermId: activeTerm.id,
              componentType: activity.gradebookComponent!,
              activityIndex: activity.gradebookIndex!,
            },
          },
          update: {
            score: clampedScore,
            activityName: activity.title,
            activityType: activity.type,
          },
          create: {
            institutionId: activity.classroom.institutionId,
            studentEnrollmentId: enrollmentId,
            teacherAssignmentId: ta.id,
            academicTermId: activeTerm.id,
            componentType: activity.gradebookComponent!,
            activityIndex: activity.gradebookIndex!,
            activityName: activity.title,
            activityType: activity.type,
            score: clampedScore,
          },
        });

        // Mark submission as synced
        if (best) {
          await this.prisma.activitySubmission.update({
            where: { id: best.id },
            data: { syncedToGradebook: true },
          });
        }

        synced++;
      } catch (err: any) {
        errors.push(`Error for enrollment ${enrollmentId}: ${err.message}`);
      }
    }

    return { synced, skipped, errors, total: targetIds.length };
  }
}
