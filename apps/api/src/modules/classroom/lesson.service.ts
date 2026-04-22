import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LessonService {
  constructor(private readonly prisma: PrismaService) {}

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
    if (activity.type !== 'LESSON') throw new BadRequestException('La actividad debe ser de tipo LESSON');

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
      include: { activity: { select: { isPublished: true } } },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    if (!lesson.activity.isPublished) throw new ForbiddenException('Esta lección no está publicada');

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

    // If ACTIVITY slide, grade the answer
    if (slide.type === 'ACTIVITY' && data.answer !== undefined && slide.activityData) {
      const actData = slide.activityData as any;
      const points = actData.points || 10;
      maxScoreIncrement = points;

      const isCorrect = this.gradeAnswer(actData, data.answer);
      if (isCorrect) {
        scoreIncrement = points;
      }

      answers[data.slideId] = {
        answer: data.answer,
        isCorrect,
        points: isCorrect ? points : 0,
        maxPoints: points,
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

    // Calculate total max score
    const totalMaxScore = lesson.slides
      .filter(s => s.type === 'ACTIVITY' && s.activityData)
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

    return {
      ...updatedProgress,
      isComplete,
      slideResult: slide.type === 'ACTIVITY' ? answers[data.slideId] : null,
    };
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
    // This is a template generator. The actual AI generation happens via Valeria API
    // which will call this structure format. Here we provide a fallback structure.
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

  private gradeAnswer(activityData: any, answer: any): boolean {
    const type = activityData.questionType;
    const correct = activityData.correctAnswer;

    if (!correct) return false;

    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      return String(answer).trim().toLowerCase() === String(correct).trim().toLowerCase();
    }

    if (type === 'SHORT_ANSWER') {
      return String(answer).trim().toLowerCase() === String(correct).trim().toLowerCase();
    }

    if (type === 'FILL_BLANK') {
      if (Array.isArray(correct) && Array.isArray(answer)) {
        return correct.every((c: string, i: number) =>
          String(answer[i] || '').trim().toLowerCase() === String(c).trim().toLowerCase(),
        );
      }
      return String(answer).trim().toLowerCase() === String(correct).trim().toLowerCase();
    }

    if (type === 'ORDERING') {
      if (Array.isArray(correct) && Array.isArray(answer)) {
        return JSON.stringify(answer) === JSON.stringify(correct);
      }
    }

    return false;
  }
}
