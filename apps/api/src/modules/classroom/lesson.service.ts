import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';
import { LearningIdentityService, GrantXpResult } from '../gamification/learning-identity.service';
import { CompetencyEvidenceService } from '../learning-route/competency-evidence.service';
import { ActivityGatingService } from './gating/activity-gating.service';

@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  // XP por completar una lección (además del XP por cada acierto).
  private static readonly LESSON_COMPLETE_XP = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly apdAi: ApdAiService,
    private readonly identity: LearningIdentityService,
    private readonly evidence: CompetencyEvidenceService,
    private readonly gating: ActivityGatingService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER: CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async createLesson(activityId: string, data: {
    title: string;
    description?: string;
    coverImage?: string;
    badgeEmoji?: string;
    badgeTitle?: string;
    badgeColor?: string;
    estimatedMinutes?: number;
    slides?: Array<{
      type: string;
      sortOrder: number;
      title?: string;
      body?: string;
      imageUrl?: string;
      videoUrl?: string;
      audioUrl?: string;
      layout?: string;
      activityData?: any;
      badgeEmoji?: string;
      badgeTitle?: string;
    }>;
  }) {
    // Verify activity exists and is LESSON type
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    // LESSON = lección multi-diapositiva; GAME = juego suelto (sopa/crucigrama) que
    // se apoya en el mismo motor de lecciones (una sola diapositiva de actividad).
    if (activity.type !== 'LESSON' && activity.type !== 'GAME') throw new BadRequestException('La actividad debe ser de tipo LESSON o GAME');

    // Check no lesson already exists
    const existing = await this.prisma.lesson.findUnique({ where: { activityId } });
    if (existing) throw new BadRequestException('Ya existe una lección para esta actividad');

    return this.prisma.lesson.create({
      data: {
        activityId,
        title: data.title,
        description: data.description,
        coverImage: data.coverImage,
        badgeEmoji: data.badgeEmoji || '🏆',
        badgeTitle: data.badgeTitle || 'Lección completada',
        badgeColor: data.badgeColor || '#8B5CF6',
        estimatedMinutes: data.estimatedMinutes,
        slides: data.slides?.length ? {
          create: data.slides.map((s, i) => ({
            type: s.type as any,
            sortOrder: s.sortOrder ?? i,
            title: s.title,
            body: s.body,
            imageUrl: s.imageUrl,
            videoUrl: s.videoUrl,
            audioUrl: s.audioUrl,
            layout: s.layout,
            activityData: s.activityData || undefined,
            blocks: (s as any).blocks ?? undefined,
            badgeEmoji: s.badgeEmoji,
            badgeTitle: s.badgeTitle,
          })),
        } : undefined,
      },
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async getLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        slides: { orderBy: { sortOrder: 'asc' } },
        activity: { select: { id: true, classroomId: true, title: true, isPublished: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    return lesson;
  }

  async getLessonByActivity(activityId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { activityId },
      include: {
        slides: { orderBy: { sortOrder: 'asc' } },
        activity: { select: { id: true, classroomId: true, title: true, isPublished: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada para esta actividad');
    return lesson;
  }

  async updateLesson(lessonId: string, data: {
    title?: string;
    description?: string;
    coverImage?: string;
    badgeEmoji?: string;
    badgeTitle?: string;
    badgeColor?: string;
    estimatedMinutes?: number;
  }) {
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data,
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async deleteLesson(lessonId: string) {
    return this.prisma.lesson.delete({ where: { id: lessonId } });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SEGURIDAD DEL EDITOR: autoguardado · recuperación · historial de versiones
  // ═══════════════════════════════════════════════════════════════════════════

  private static readonly MAX_AUTOSAVES = 15;

  /** Guarda un snapshot de la lección (autoguardado o manual). Poda autosaves viejos. */
  async saveVersion(lessonId: string, userId: string | undefined, dto: { kind?: string; label?: string; snapshot: any }) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { id: true } });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    if (!dto?.snapshot || typeof dto.snapshot !== 'object') throw new BadRequestException('Snapshot inválido');
    const kind = ['AUTOSAVE', 'MANUAL', 'PUBLISH'].includes(dto.kind || '') ? dto.kind : 'AUTOSAVE';

    const version = await this.prisma.lessonVersion.create({
      data: { lessonId, kind: kind as any, label: dto.label?.slice(0, 120) || null, snapshot: dto.snapshot, createdById: userId || null },
      select: { id: true, kind: true, label: true, createdAt: true },
    });

    // Poda: conserva los últimos N autosaves (los manuales/publish no se podan).
    if (kind === 'AUTOSAVE') {
      const autos = await this.prisma.lessonVersion.findMany({
        where: { lessonId, kind: 'AUTOSAVE' },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
        skip: LessonService.MAX_AUTOSAVES,
      });
      if (autos.length) {
        await this.prisma.lessonVersion.deleteMany({ where: { id: { in: autos.map(a => a.id) } } });
      }
    }
    return version;
  }

  /** Lista el historial (metadatos, sin el snapshot completo) — recientes primero. */
  async listVersions(lessonId: string) {
    return this.prisma.lessonVersion.findMany({
      where: { lessonId },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, kind: true, label: true, createdAt: true },
    });
  }

  /** El snapshot completo de una versión (para previsualizar/restaurar en el editor). */
  async getVersion(versionId: string) {
    const v = await this.prisma.lessonVersion.findUnique({ where: { id: versionId } });
    if (!v) throw new NotFoundException('Versión no encontrada');
    return v;
  }

  /** Pista de Valeria para una actividad (P4): orienta sin revelar la respuesta. */
  async activityHint(lessonId: string, slideId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        slides: { where: { id: slideId }, select: { activityData: true, type: true } },
        activity: { select: { classroom: { select: { teacherAssignment: { select: { group: { select: { grade: { select: { name: true } } } } } } } } } },
      },
    });
    const slide = lesson?.slides?.[0];
    const act = slide?.activityData as any;
    if (!act?.question) return { hint: '' };
    const gradeName = lesson?.activity?.classroom?.teacherAssignment?.group?.grade?.name || undefined;
    return this.apdAi.generateActivityHint({ question: act.question, options: Array.isArray(act.options) ? act.options : undefined, gradeName });
  }

  /** ¿Hay un autoguardado más nuevo que el último guardado de la lección?
   * (para ofrecer "recuperar borrador" al abrir el editor tras un cierre inesperado). */
  async getRecovery(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId }, select: { updatedAt: true } });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    const latest = await this.prisma.lessonVersion.findFirst({
      where: { lessonId, kind: 'AUTOSAVE' },
      orderBy: { createdAt: 'desc' },
    });
    // Margen de 5s para no ofrecer recuperación por el autosave inmediato tras guardar.
    const hasNewer = !!latest && latest.createdAt.getTime() > lesson.updatedAt.getTime() + 5000;
    return { hasRecovery: hasNewer, version: hasNewer ? latest : null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER: SLIDES CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  async addSlide(lessonId: string, data: {
    type: string;
    sortOrder?: number;
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    layout?: string;
    activityData?: any;
    badgeEmoji?: string;
    badgeTitle?: string;
  }) {
    // Auto-calculate sortOrder if not provided
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const max = await this.prisma.lessonSlide.aggregate({
        where: { lessonId },
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.lessonSlide.create({
      data: {
        lessonId,
        type: data.type as any,
        sortOrder,
        title: data.title,
        body: data.body,
        imageUrl: data.imageUrl,
        videoUrl: data.videoUrl,
        audioUrl: data.audioUrl,
        layout: data.layout,
        activityData: data.activityData || undefined,
        badgeEmoji: data.badgeEmoji,
        badgeTitle: data.badgeTitle,
      },
    });
  }

  async updateSlide(slideId: string, data: {
    type?: string;
    sortOrder?: number;
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    layout?: string;
    activityData?: any;
    badgeEmoji?: string;
    badgeTitle?: string;
  }) {
    return this.prisma.lessonSlide.update({
      where: { id: slideId },
      data: {
        ...data,
        type: data.type as any,
        activityData: data.activityData !== undefined ? (data.activityData || undefined) : undefined,
      },
    });
  }

  async deleteSlide(slideId: string) {
    return this.prisma.lessonSlide.delete({ where: { id: slideId } });
  }

  async reorderSlides(lessonId: string, slideIds: string[]) {
    const ops = slideIds.map((id, index) =>
      this.prisma.lessonSlide.update({ where: { id }, data: { sortOrder: index } }),
    );
    await this.prisma.$transaction(ops);
    return this.prisma.lessonSlide.findMany({
      where: { lessonId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async bulkUpdateSlides(lessonId: string, slides: Array<{
    id?: string;
    type: string;
    sortOrder: number;
    title?: string;
    body?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    layout?: string;
    activityData?: any;
    blocks?: any;
    badgeEmoji?: string;
    badgeTitle?: string;
  }>) {
    // Delete slides that are not in the new list
    const existingSlideIds = slides.filter(s => s.id).map(s => s.id!);
    await this.prisma.lessonSlide.deleteMany({
      where: { lessonId, id: { notIn: existingSlideIds } },
    });

    // Upsert each slide
    for (const slide of slides) {
      if (slide.id) {
        await this.prisma.lessonSlide.update({
          where: { id: slide.id },
          data: {
            type: slide.type as any,
            sortOrder: slide.sortOrder,
            title: slide.title,
            body: slide.body,
            imageUrl: slide.imageUrl,
            videoUrl: slide.videoUrl,
            audioUrl: slide.audioUrl,
            layout: slide.layout,
            activityData: slide.activityData || undefined,
            blocks: slide.blocks ?? undefined,
            badgeEmoji: slide.badgeEmoji,
            badgeTitle: slide.badgeTitle,
          },
        });
      } else {
        await this.prisma.lessonSlide.create({
          data: {
            lessonId,
            type: slide.type as any,
            sortOrder: slide.sortOrder,
            title: slide.title,
            body: slide.body,
            imageUrl: slide.imageUrl,
            videoUrl: slide.videoUrl,
            audioUrl: slide.audioUrl,
            layout: slide.layout,
            activityData: slide.activityData || undefined,
            blocks: slide.blocks ?? undefined,
            badgeEmoji: slide.badgeEmoji,
            badgeTitle: slide.badgeTitle,
          },
        });
      }
    }

    return this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENT: PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════

  async getMyProgress(lessonId: string, studentEnrollmentId: string) {
    let progress = await this.prisma.lessonProgress.findUnique({
      where: { lessonId_studentEnrollmentId: { lessonId, studentEnrollmentId } },
    });
    if (!progress) {
      // Return default (not started)
      return {
        lessonId,
        studentEnrollmentId,
        status: 'NOT_STARTED',
        currentSlideIndex: 0,
        completedSlides: [],
        answers: {},
        score: 0,
        maxScore: 0,
        badgeEarned: false,
        lastCheckpointIndex: 0,
        startedAt: null,
        completedAt: null,
        timeSpentSeconds: 0,
      };
    }
    return progress;
  }

  async startLesson(lessonId: string, studentEnrollmentId: string) {
    // Verify lesson exists and is published
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { activity: { select: { isPublished: true, classroomId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    if (!lesson.activity.isPublished) throw new ForbiddenException('Esta lección no está publicada');

    // Enforcement de dependencias (Fase 3): no se inicia una lección bloqueada.
    if (!(await this.gating.isUnlockedForStudent(lesson.activityId, lesson.activity.classroomId, studentEnrollmentId))) {
      throw new ForbiddenException('Esta lección está bloqueada: primero completa las actividades requeridas');
    }

    return this.prisma.lessonProgress.upsert({
      where: { lessonId_studentEnrollmentId: { lessonId, studentEnrollmentId } },
      create: {
        lessonId,
        studentEnrollmentId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        currentSlideIndex: 0,
        completedSlides: [],
        answers: {},
      },
      update: {
        // If already completed, don't reset
        // If NOT_STARTED, set to IN_PROGRESS
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });
  }

  async advanceSlide(lessonId: string, studentEnrollmentId: string, data: {
    slideIndex: number;
    slideId: string;
    answer?: any; // For ACTIVITY slides
    attempt?: number; // Nº de intento con el que acertó (para XP decreciente, P4)
    timeSpentDelta?: number; // Seconds spent on this slide
  }) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');

    let progress = await this.prisma.lessonProgress.findUnique({
      where: { lessonId_studentEnrollmentId: { lessonId, studentEnrollmentId } },
    });
    if (!progress) throw new BadRequestException('Debes iniciar la lección primero');
    if (progress.status === 'COMPLETED') throw new BadRequestException('La lección ya fue completada');

    const slide = lesson.slides.find(s => s.id === data.slideId);
    if (!slide) throw new NotFoundException('Slide no encontrado');

    const completedSlides: string[] = Array.isArray(progress.completedSlides) ? (progress.completedSlides as string[]) : [];
    const answers: Record<string, any> = (progress.answers as Record<string, any>) || {};

    // Mark slide as completed
    if (!completedSlides.includes(data.slideId)) {
      completedSlides.push(data.slideId);
    }

    let scoreIncrement = 0;
    let maxScoreIncrement = 0;
    let activityCorrect = false; // para XP por dominio (solo si acertó)
    let activityPoints = 0; // puntaje académico (no decrece)
    let activityXp = 0; // XP de gamificación (decrece por intento, P4)

    // If ACTIVITY slide, grade the answer (las flashcards son estudio, no se puntúan)
    if (
      slide.type === 'ACTIVITY' &&
      data.answer !== undefined &&
      slide.activityData &&
      (slide.activityData as any).questionType !== 'FLASHCARDS'
    ) {
      const actData = slide.activityData as any;
      const points = actData.points || 10;
      maxScoreIncrement = points;
      activityPoints = points;

      const isCorrect = this.gradeAnswer(actData, data.answer);
      if (isCorrect) {
        scoreIncrement = points; // el puntaje académico es el total al acertar
        activityCorrect = true;
        // XP decreciente por intento (P4): 1er intento = points; cada intento resta
        // `xpDecrement`, con piso `xpMin` (por defecto 25% del valor). Si el docente
        // no configura descuento, por defecto el acierto en un intento posterior vale
        // menos XP (25% del valor por intento); poner xpDecrement=0 lo desactiva.
        const behavior = (actData.behavior || {}) as any;
        const attempt = Math.max(1, Number(data.attempt) || 1);
        const dec = behavior.xpDecrement != null
          ? Math.max(0, Number(behavior.xpDecrement) || 0)
          : Math.ceil(points * 0.25);
        const floor = behavior.xpMin != null ? Math.max(0, Number(behavior.xpMin)) : Math.ceil(points * 0.25);
        activityXp = Math.max(floor, points - dec * (attempt - 1));
      }

      answers[data.slideId] = {
        answer: data.answer,
        isCorrect,
        points: isCorrect ? points : 0,
        maxPoints: points,
        attempt: Math.max(1, Number(data.attempt) || 1),
      };
    }

    // Update checkpoint if this is a CHECKPOINT slide
    let lastCheckpointIndex = progress.lastCheckpointIndex;
    if (slide.type === 'CHECKPOINT') {
      lastCheckpointIndex = data.slideIndex;
    }

    // Check if lesson is complete (all slides done)
    const totalSlides = lesson.slides.length;
    const isComplete = completedSlides.length >= totalSlides;
    const nextSlideIndex = Math.min(data.slideIndex + 1, totalSlides - 1);

    // Calculate total max score (las flashcards no puntúan → fuera del denominador)
    const totalMaxScore = lesson.slides
      .filter(s => s.type === 'ACTIVITY' && s.activityData && (s.activityData as any).questionType !== 'FLASHCARDS')
      .reduce((sum, s) => sum + ((s.activityData as any)?.points || 10), 0);

    const updatedProgress = await this.prisma.lessonProgress.update({
      where: { lessonId_studentEnrollmentId: { lessonId, studentEnrollmentId } },
      data: {
        currentSlideIndex: nextSlideIndex,
        completedSlides,
        answers,
        score: { increment: scoreIncrement },
        maxScore: totalMaxScore,
        lastCheckpointIndex,
        timeSpentSeconds: { increment: data.timeSpentDelta || 0 },
        ...(isComplete ? {
          status: 'COMPLETED',
          completedAt: new Date(),
          badgeEarned: true,
        } : {}),
      },
    });

    // Nota al COMPLETAR la lección (como un quiz): se crea una entrega AUTO_GRADED en la
    // actividad-lección con el desempeño del estudiante normalizado a la maxScore de la
    // actividad (misma base que los quizzes). El docente luego la vincula al libro de
    // calificaciones como cualquier otra actividad. Solo si hay actividades puntuables.
    // Nunca rompe el cierre de la lección.
    if (isComplete && totalMaxScore > 0 && lesson.activityId) {
      try {
        const activity = await this.prisma.classroomActivity.findUnique({
          where: { id: lesson.activityId },
          select: { maxScore: true },
        });
        const activityMax = activity?.maxScore ? Number(activity.maxScore) : 5;
        const finalScore = Math.round(((Number(updatedProgress.score) / totalMaxScore) * activityMax) * 10) / 10;
        const now = new Date();
        await this.prisma.activitySubmission.upsert({
          where: { activityId_studentEnrollmentId_attemptNumber: { activityId: lesson.activityId, studentEnrollmentId, attemptNumber: 1 } },
          create: {
            activityId: lesson.activityId, studentEnrollmentId, attemptNumber: 1,
            status: 'AUTO_GRADED', score: finalScore, submittedAt: now, gradedAt: now,
          },
          update: { status: 'AUTO_GRADED', score: finalScore, gradedAt: now },
        });
      } catch { /* la nota es best-effort; nunca rompe el cierre de la lección */ }
    }

    // Gamificación: XP por DOMINIO (acertar) y por completar la lección. Idempotente
    // por slide/lección para que reintentos no dupliquen XP. Nunca rompe el flujo.
    const xp = await this.awardLessonXp({
      studentEnrollmentId, lessonId, lessonTitle: lesson.title,
      slideId: data.slideId, activityCorrect, activityPoints, activityXp, isComplete,
      activityId: lesson.activityId,
      scorePercent: totalMaxScore > 0 ? Math.min(Number(updatedProgress.score) / totalMaxScore, 1) * 100 : 100,
    });

    return {
      ...updatedProgress,
      isComplete,
      xp,
      slideResult: slide.type === 'ACTIVITY' ? answers[data.slideId] : null,
    };
  }

  /**
   * Concede el XP de una lección: por acertar la actividad (dominio) y por
   * completarla. Idempotente. Devuelve un resumen para que la UI muestre el XP
   * ganado / subida de nivel. Nunca lanza: la gamificación no puede romper el flujo.
   */
  private async awardLessonXp(p: {
    studentEnrollmentId: string;
    lessonId: string;
    lessonTitle: string;
    slideId: string;
    activityCorrect: boolean;
    activityPoints: number;
    activityXp?: number;
    isComplete: boolean;
    activityId: string;
    scorePercent: number;
  }): Promise<{ awarded: number; leveledUp: boolean; level: number | null; currentStreak: number | null; newBadges: GrantXpResult['newBadges'] } | null> {
    if (!p.activityCorrect && !p.isComplete) return null;
    try {
      const enrollment = await this.prisma.studentEnrollment.findUnique({
        where: { id: p.studentEnrollmentId },
        select: { studentId: true, institutionId: true },
      });
      if (!enrollment) return null;

      // Evidencia de competencias al completar la lección (si es paso de una ruta con can-do).
      if (p.isComplete) {
        await this.evidence.recordFromActivity({
          institutionId: enrollment.institutionId,
          studentId: enrollment.studentId,
          studentEnrollmentId: p.studentEnrollmentId,
          activityId: p.activityId,
          scorePercent: p.scorePercent,
          source: 'LESSON', sourceRef: p.lessonId,
        });
      }

      // Materia (skill) para el desglose de XP por habilidad.
      const lessonSubject = await this.prisma.lesson.findUnique({
        where: { id: p.lessonId },
        select: { activity: { select: { classroom: { select: { teacherAssignment: { select: { subject: { select: { name: true } } } } } } } } },
      });
      const skill = lessonSubject?.activity?.classroom?.teacherAssignment?.subject?.name ?? null;

      let awarded = 0;
      let leveledUp = false;
      let last: GrantXpResult['identity'] = null;
      const newBadges: GrantXpResult['newBadges'] = [];

      if (p.activityCorrect) {
        const r = await this.identity.grantXp({
          institutionId: enrollment.institutionId,
          studentId: enrollment.studentId,
          studentEnrollmentId: p.studentEnrollmentId,
          source: 'LESSON_ACTIVITY',
          amount: p.activityXp ?? p.activityPoints,
          skill,
          reason: `Acierto en lección: ${p.lessonTitle}`,
          idempotencyKey: `lesson:${p.lessonId}:slide:${p.slideId}:correct:${p.studentEnrollmentId}`,
        });
        awarded += r.awarded;
        leveledUp = leveledUp || r.leveledUp;
        last = r.identity ?? last;
        newBadges.push(...r.newBadges);
      }

      if (p.isComplete) {
        const r = await this.identity.grantXp({
          institutionId: enrollment.institutionId,
          studentId: enrollment.studentId,
          studentEnrollmentId: p.studentEnrollmentId,
          source: 'LESSON_COMPLETE',
          amount: LessonService.LESSON_COMPLETE_XP,
          skill,
          reason: `Lección completada: ${p.lessonTitle}`,
          idempotencyKey: `lesson:${p.lessonId}:complete:${p.studentEnrollmentId}`,
        });
        awarded += r.awarded;
        leveledUp = leveledUp || r.leveledUp;
        last = r.identity ?? last;
        newBadges.push(...r.newBadges);
      }

      return { awarded, leveledUp, level: last?.level ?? null, currentStreak: last?.currentStreak ?? null, newBadges };
    } catch (err: any) {
      this.logger.warn(`awardLessonXp falló (no crítico): ${err?.message || err}`);
      return null;
    }
  }

  // Teacher: get all students' progress
  async getAllProgress(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { slides: true },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');

    const progressList = await this.prisma.lessonProgress.findMany({
      where: { lessonId },
      include: {
        studentEnrollment: {
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const totalSlides = lesson.slides.length;

    return progressList.map(p => ({
      id: p.id,
      studentEnrollmentId: p.studentEnrollmentId,
      studentName: `${p.studentEnrollment.student.user?.firstName || ''} ${p.studentEnrollment.student.user?.lastName || ''}`.trim(),
      status: p.status,
      currentSlideIndex: p.currentSlideIndex,
      totalSlides,
      progressPercent: totalSlides > 0 ? Math.round((Array.isArray(p.completedSlides) ? (p.completedSlides as any[]).length : 0) / totalSlides * 100) : 0,
      score: p.score,
      maxScore: p.maxScore,
      badgeEarned: p.badgeEarned,
      timeSpentSeconds: p.timeSpentSeconds,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
    }));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AI: Generate lesson from text/topic
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Genera una lección con IA real (Valeria) cuando está habilitada. Si la IA no
   * está configurada o falla, cae con gracia al generador de plantilla local
   * (`generateLessonStructure`) para no romper nunca el flujo del docente.
   * El campo `source` indica qué motor produjo el resultado, para avisar en UI.
   */
  async generateLesson(params: {
    topic: string;
    content?: string;
    gradeName?: string;
    subjectName?: string;
  }): Promise<{
    title: string;
    description: string;
    slides: Array<{ type: string; sortOrder: number; title?: string; body?: string; activityData?: any; badgeEmoji?: string; badgeTitle?: string }>;
    source: 'AI' | 'TEMPLATE';
  }> {
    if (this.apdAi.isEnabled()) {
      try {
        const draft = await this.apdAi.generateLessonSlides({
          topic: params.topic,
          content: params.content,
          gradeName: params.gradeName,
          subjectName: params.subjectName,
        });
        return {
          title: draft.title,
          description: draft.description,
          slides: draft.slides.map((s, i) => ({
            type: s.type,
            sortOrder: i,
            title: s.title,
            body: s.body,
            activityData: s.activityData,
            badgeEmoji: s.badgeEmoji,
            badgeTitle: s.badgeTitle,
          })),
          source: 'AI',
        };
      } catch (err: any) {
        // No romper: registrar y caer al fallback de plantilla.
        this.logger.warn(`generateLesson: IA falló, usando plantilla. ${err?.message || err}`);
      }
    }
    const template = this.generateLessonStructure(params.topic, params.content || '', params.gradeName);
    return { ...template, source: 'TEMPLATE' };
  }

  generateLessonStructure(topic: string, content: string, gradeName?: string): {
    title: string;
    description: string;
    slides: Array<{
      type: string;
      sortOrder: number;
      title?: string;
      body?: string;
      activityData?: any;
    }>;
  } {
    // Fallback de plantilla: se usa cuando la IA (Valeria) no está habilitada o falla.
    // La generación real con LLM vive en ApdAiService.generateLessonSlides (ver generateLesson()).
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);

    if (paragraphs.length === 0) {
      return {
        title: topic || 'Nueva lección',
        description: `Lección interactiva sobre ${topic}`,
        slides: [
          { type: 'CONTENT', sortOrder: 0, title: topic, body: `<p>${content || 'Agrega contenido aquí...'}</p>` },
          { type: 'BADGE_REVEAL', sortOrder: 1 },
        ],
      };
    }

    const slides: any[] = [];
    let order = 0;

    // Title slide
    slides.push({
      type: 'CONTENT',
      sortOrder: order++,
      title: topic || 'Introducción',
      body: `<p>${paragraphs[0]}</p>`,
    });

    // Content slides with activities interspersed
    for (let i = 1; i < paragraphs.length; i++) {
      slides.push({
        type: 'CONTENT',
        sortOrder: order++,
        title: `Sección ${i}`,
        body: `<p>${paragraphs[i]}</p>`,
      });

      // Add activity every 2-3 content slides
      if (i % 2 === 0 && i < paragraphs.length - 1) {
        slides.push({
          type: 'ACTIVITY',
          sortOrder: order++,
          title: 'Actividad',
          activityData: {
            questionType: 'MULTIPLE_CHOICE',
            question: `¿Qué aprendiste sobre ${topic} en la sección anterior?`,
            options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
            correctAnswer: 'Opción A',
            explanation: 'Revisa la sección anterior para confirmar tu respuesta.',
            points: 10,
          },
        });
      }

      // Add checkpoint every section
      if (i % 3 === 0) {
        slides.push({ type: 'CHECKPOINT', sortOrder: order++ });
      }
    }

    // Final badge
    slides.push({ type: 'BADGE_REVEAL', sortOrder: order++ });

    return {
      title: topic || 'Nueva lección',
      description: `Lección interactiva sobre ${topic}${gradeName ? ` para ${gradeName}` : ''}`,
      slides,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  // Normalización espejo del frontend (grading.ts): trim + minúsculas + colapsa espacios.
  private norm(s: any): string {
    return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  // Pares de MATCHING en `options` como "izquierda::derecha" (camino A).
  private parsePairs(options?: any[]): { left: string; right: string }[] {
    return (options || [])
      .map((o: any) => {
        const [left, right] = String(o).split('::');
        return { left: (left || '').trim(), right: (right || '').trim() };
      })
      .filter(p => p.left && p.right);
  }

  // IMPORTANTE: debe puntuar EXACTAMENTE igual que el frontend (grading.ts).
  // Si divergen, el alumno ve "correcto" pero el score guardado dice otra cosa.
  private gradeAnswer(activityData: any, answer: any): boolean {
    const type = activityData.questionType;
    const correct = activityData.correctAnswer;

    if (type === 'MATCHING') {
      const pairs = this.parsePairs(activityData.options);
      return pairs.length > 0 && !!answer && typeof answer === 'object' &&
        pairs.every(p => this.norm(answer[p.left]) === this.norm(p.right));
    }

    if (type === 'ORDERING') {
      // Forma legada: correctAnswer como array. Camino A: string (la frase).
      if (Array.isArray(correct) && Array.isArray(answer)) {
        return JSON.stringify(answer) === JSON.stringify(correct);
      }
      return this.norm((Array.isArray(answer) ? answer : []).join(' ')) === this.norm(correct);
    }

    if (type === 'WORDSEARCH') {
      // La respuesta es el array de palabras encontradas; correcto si están todas.
      const target = (activityData.options || []).map((o: any) => this.norm(o)).filter(Boolean);
      const found = (Array.isArray(answer) ? answer : []).map((o: any) => this.norm(o));
      return target.length > 0 && target.every((w: string) => found.includes(w));
    }

    if (type === 'CROSSWORD' || type === 'MEMORY') {
      // Respuesta = array de parejas resueltas; correcto si están todas (izq de los pares).
      const target = this.parsePairs(activityData.options).map(p => this.norm(p.left)).filter(Boolean);
      const solved = (Array.isArray(answer) ? answer : []).map((o: any) => this.norm(o));
      return target.length > 0 && target.every((w: string) => solved.includes(w));
    }

    if (type === 'LABEL_IMAGE') {
      // Respuesta = etiquetas por punto (en orden); correcto si cada punto tiene la suya.
      const labels = (activityData.options || []).map((o: any) => this.norm(String(o).split('::')[0]));
      return labels.length > 0 && Array.isArray(answer) && labels.every((lbl: string, i: number) => this.norm(answer[i]) === lbl);
    }

    if (type === 'PUZZLE') {
      // Respuesta = arreglo de piezas; correcto = resuelto (identidad, tamaño N*N).
      const n = parseInt((activityData.options?.[0]) || '3') || 3;
      return Array.isArray(answer) && answer.length === n * n && answer.every((v: number, i: number) => v === i);
    }

    if (type === 'FILL_BLANK' && Array.isArray(correct) && Array.isArray(answer)) {
      // Forma legada multi-hueco.
      return correct.every((c: string, i: number) => this.norm(answer[i]) === this.norm(c));
    }

    // MULTIPLE_CHOICE, TRUE_FALSE, SHORT_ANSWER, FILL_BLANK (hueco simple)
    if (!correct) return false;
    return this.norm(answer) === this.norm(correct);
  }
}
