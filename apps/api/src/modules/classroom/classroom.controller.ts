import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomService } from './classroom.service';
import { AttitudinalService } from './attitudinal.service';
import { LessonService } from './lesson.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { AttitudinalRubricType } from '@prisma/client';

@Controller('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomController {
  constructor(
    private readonly service: ClassroomService,
    private readonly attitudinalService: AttitudinalService,
    private readonly lessonService: LessonService,
    private readonly prisma: PrismaService,
  ) {}

  private async resolveCtx(req: any) {
    const userId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { userId, institutionId };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSROOMS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async list(@Request() req: any, @Query('role') role?: string) {
    const { userId, institutionId } = await this.resolveCtx(req);
    if (role === 'student') {
      return this.service.listForStudent(userId, institutionId);
    }
    return this.service.listForTeacher(userId, institutionId);
  }

  @Get('available-assignments')
  @Roles('DOCENTE', 'COORDINADOR')
  async getAvailableAssignments(@Request() req: any) {
    const { userId, institutionId } = await this.resolveCtx(req);
    return this.service.getAvailableAssignments(userId, institutionId);
  }

  @Post()
  @Roles('DOCENTE', 'COORDINADOR')
  async create(@Request() req: any, @Body() body: {
    teacherAssignmentId: string;
    title?: string;
    description?: string;
    color?: string;
  }) {
    const { userId, institutionId } = await this.resolveCtx(req);
    return this.service.create(userId, institutionId, body);
  }

  @Get(':id')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async getById(@Param('id') id: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getById(id, userId);
  }

  @Put(':id')
  @Roles('DOCENTE', 'COORDINADOR')
  async update(@Param('id') id: string, @Request() req: any, @Body() body: {
    title?: string;
    description?: string;
    color?: string;
    coverImage?: string;
    isActive?: boolean;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.update(id, userId, body);
  }

  @Get(':id/students')
  @Roles('DOCENTE', 'COORDINADOR')
  async getStudents(@Param('id') id: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getStudents(id, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/sections')
  @Roles('DOCENTE', 'COORDINADOR')
  async createSection(@Param('id') classroomId: string, @Request() req: any, @Body() body: {
    title: string;
    description?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createSection(classroomId, userId, body);
  }

  @Put('sections/:sectionId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateSection(@Param('sectionId') sectionId: string, @Request() req: any, @Body() body: {
    title?: string;
    description?: string;
    isVisible?: boolean;
    sortOrder?: number;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateSection(sectionId, userId, body);
  }

  @Delete('sections/:sectionId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteSection(
    @Param('sectionId') sectionId: string,
    @Query('force') force: string,
    @Request() req: any,
  ) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteSection(sectionId, userId, force === 'true');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MATERIALS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('sections/:sectionId/materials')
  @Roles('DOCENTE', 'COORDINADOR')
  async createMaterial(@Param('sectionId') sectionId: string, @Request() req: any, @Body() body: {
    type: string;
    title: string;
    content?: string;
    fileUrl?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createMaterial(sectionId, userId, body);
  }

  @Put('materials/:materialId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateMaterial(@Param('materialId') materialId: string, @Request() req: any, @Body() body: {
    title?: string;
    content?: string;
    fileUrl?: string;
    isVisible?: boolean;
    sortOrder?: number;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateMaterial(materialId, userId, body);
  }

  @Delete('materials/:materialId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteMaterial(@Param('materialId') materialId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteMaterial(materialId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANNOUNCEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/announcements')
  @Roles('DOCENTE', 'COORDINADOR')
  async createAnnouncement(@Param('id') classroomId: string, @Request() req: any, @Body() body: {
    title: string;
    content: string;
    isPinned?: boolean;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createAnnouncement(classroomId, userId, body);
  }

  @Put('announcements/:announcementId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateAnnouncement(@Param('announcementId') announcementId: string, @Request() req: any, @Body() body: {
    title?: string;
    content?: string;
    isPinned?: boolean;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateAnnouncement(announcementId, userId, body);
  }

  @Post('announcements/:announcementId/copy')
  @Roles('DOCENTE', 'COORDINADOR')
  async copyAnnouncement(@Param('announcementId') announcementId: string, @Request() req: any, @Body() body: { targetClassroomId: string }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.copyAnnouncementToClassroom(announcementId, body.targetClassroomId, userId);
  }

  @Delete('announcements/:announcementId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteAnnouncement(@Param('announcementId') announcementId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteAnnouncement(announcementId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITIES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/activities')
  @Roles('DOCENTE', 'COORDINADOR')
  async createActivity(@Param('id') classroomId: string, @Request() req: any, @Body() body: {
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
    rubricId?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createActivity(classroomId, userId, body);
  }

  @Get(':id/activities')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async listActivities(@Param('id') classroomId: string, @Request() req: any, @Query('role') role?: string) {
    const { userId } = await this.resolveCtx(req);
    return this.service.listActivities(classroomId, userId, role === 'student' ? 'student' : 'teacher');
  }

  @Get('activities/:activityId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async getActivity(@Param('activityId') activityId: string, @Request() req: any, @Query('role') role?: string) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getActivity(activityId, userId, role === 'student' ? 'student' : 'teacher');
  }

  @Put('activities/:activityId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateActivity(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
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
    const { userId } = await this.resolveCtx(req);
    return this.service.updateActivity(activityId, userId, body);
  }

  @Put('activities/:activityId/publish')
  @Roles('DOCENTE', 'COORDINADOR')
  async publishActivity(@Param('activityId') activityId: string, @Request() req: any, @Body() body?: { scheduledPublishAt?: string }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.publishActivity(activityId, userId, body);
  }

  @Put('activities/:activityId/unpublish')
  @Roles('DOCENTE', 'COORDINADOR')
  async unpublishActivity(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.unpublishActivity(activityId, userId);
  }

  @Put('activities/:activityId/assign-students')
  @Roles('DOCENTE', 'COORDINADOR')
  async assignStudentsToActivity(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    studentEnrollmentIds: string[];
    isRestrictedToAssigned: boolean;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.assignStudentsToActivity(activityId, userId, body);
  }

  @Get('activities/:activityId/assignments')
  @Roles('DOCENTE', 'COORDINADOR')
  async getActivityAssignments(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getActivityAssignments(activityId, userId);
  }

  @Get(':id/students-for-assignment')
  @Roles('DOCENTE', 'COORDINADOR')
  async getClassroomStudentsForAssignment(@Param('id') classroomId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getClassroomStudentsForAssignment(classroomId, userId);
  }

  @Delete('activities/:activityId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteActivity(@Param('activityId') activityId: string, @Request() req: any, @Query('force') force?: string) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteActivity(activityId, userId, force === 'true');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMISSIONS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/submit')
  @Roles('ESTUDIANTE')
  async submitTask(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    content?: string;
    fileUrl?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.submitTask(activityId, userId, body);
  }

  @Put('submissions/:submissionId')
  @Roles('ESTUDIANTE')
  async updateSubmission(@Param('submissionId') submissionId: string, @Request() req: any, @Body() body: {
    content?: string;
    fileUrl?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateSubmission(submissionId, userId, body);
  }

  @Get('activities/:activityId/submissions')
  @Roles('DOCENTE', 'COORDINADOR')
  async listSubmissions(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.listSubmissions(activityId, userId);
  }

  @Get('activities/:activityId/my-submission')
  @Roles('ESTUDIANTE')
  async getMySubmission(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getMySubmission(activityId, userId);
  }

  @Get(':id/my-grades')
  @Roles('ESTUDIANTE')
  async getMyGrades(@Param('id') classroomId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getMyGrades(classroomId, userId);
  }

  @Put('submissions/:submissionId/grade')
  @Roles('DOCENTE', 'COORDINADOR')
  async gradeSubmission(@Param('submissionId') submissionId: string, @Request() req: any, @Body() body: {
    score: number;
    feedback?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.gradeSubmission(submissionId, userId, body);
  }

  @Put('submissions/:submissionId/return')
  @Roles('DOCENTE', 'COORDINADOR')
  async returnSubmission(@Param('submissionId') submissionId: string, @Request() req: any, @Body() body: {
    feedback?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.returnSubmission(submissionId, userId, body);
  }

  @Delete('submissions/:submissionId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteSubmission(@Param('submissionId') submissionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteSubmission(submissionId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Question Contexts
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/contexts')
  @Roles('DOCENTE', 'COORDINADOR')
  async createContext(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    title?: string; text?: string; imageUrl?: string; viewPolicy?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createContext(activityId, userId, body);
  }

  @Get('activities/:activityId/contexts')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listContexts(@Param('activityId') activityId: string) {
    return this.service.listContexts(activityId);
  }

  @Put('contexts/:contextId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateContext(@Param('contextId') contextId: string, @Request() req: any, @Body() body: {
    title?: string; text?: string; imageUrl?: string; viewPolicy?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateContext(contextId, userId, body);
  }

  @Delete('contexts/:contextId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteContext(@Param('contextId') contextId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteContext(contextId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Questions
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/questions')
  @Roles('DOCENTE', 'COORDINADOR')
  async addQuestion(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string; contextId?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.addQuestion(activityId, userId, body);
  }

  @Get('activities/:activityId/questions')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listQuestions(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    const isTeacher = req.user.roles?.some((r: any) => ['DOCENTE', 'COORDINADOR'].includes(r.role || r));
    return this.service.listQuestions(activityId, userId, !!isTeacher);
  }

  @Put('questions/:questionId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateQuestion(@Param('questionId') questionId: string, @Request() req: any, @Body() body: {
    text?: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateQuestion(questionId, userId, body);
  }

  @Delete('questions/:questionId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteQuestion(@Param('questionId') questionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteQuestion(questionId, userId);
  }

  @Put('activities/:activityId/questions/reorder')
  @Roles('DOCENTE', 'COORDINADOR')
  async reorderQuestions(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    questionIds: string[];
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.reorderQuestions(activityId, userId, body.questionIds);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ICFES SIMULATOR – Results
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('submissions/:submissionId/icfes-result')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async getIcfesResult(@Param('submissionId') submissionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getIcfesResults(submissionId, userId);
  }

  @Get('activities/:activityId/icfes-results')
  @Roles('DOCENTE', 'COORDINADOR')
  async getIcfesClassroomResults(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getIcfesClassroomResults(activityId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Taking
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/start-quiz')
  @Roles('ESTUDIANTE')
  async startQuiz(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.startQuiz(activityId, userId);
  }

  @Put('submissions/:submissionId/answer')
  @Roles('ESTUDIANTE')
  async saveQuizAnswer(@Param('submissionId') submissionId: string, @Request() req: any, @Body() body: {
    questionId: string; answer?: string; selectedOptions?: any;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.saveQuizAnswer(submissionId, userId, body);
  }

  @Post('submissions/:submissionId/submit-quiz')
  @Roles('ESTUDIANTE')
  async submitQuiz(@Param('submissionId') submissionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.submitQuiz(submissionId, userId);
  }

  @Get('submissions/:submissionId/result')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async getQuizResult(@Param('submissionId') submissionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getQuizResult(submissionId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FORUM
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/forum')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async createForumPost(@Param('id') classroomId: string, @Request() req: any, @Body() body: {
    title: string;
    content: string;
    parentId?: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.createForumPost(classroomId, userId, body);
  }

  @Get(':id/forum')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async listForumPosts(@Param('id') classroomId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.listForumPosts(classroomId, userId);
  }

  @Get('forum/:postId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async getForumPost(@Param('postId') postId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getForumPost(postId, userId);
  }

  @Put('forum/:postId/pin')
  @Roles('DOCENTE', 'COORDINADOR')
  async togglePinForumPost(@Param('postId') postId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.togglePinForumPost(postId, userId);
  }

  @Put('forum/:postId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async updateForumPost(@Param('postId') postId: string, @Request() req: any, @Body() body: { title?: string; content?: string }) {
    const { userId } = await this.resolveCtx(req);
    const isTeacher = req.user.roles?.some((r: any) => ['DOCENTE', 'COORDINADOR'].includes(r.role || r));
    return this.service.updateForumPost(postId, userId, !!isTeacher, body);
  }

  @Delete('forum/:postId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteForumPost(@Param('postId') postId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    const isTeacher = req.user.roles?.some((r: any) => ['DOCENTE', 'COORDINADOR'].includes(r.role || r));
    return this.service.deleteForumPost(postId, userId, !!isTeacher);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COPY CLASSROOM & DUPLICATE RESOURCES
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':id/copy-to')
  @Roles('DOCENTE', 'COORDINADOR')
  async copyClassroomTo(@Param('id') id: string, @Request() req: any, @Body() body: {
    targetTeacherAssignmentIds: string[];
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.copyClassroomTo(id, body.targetTeacherAssignmentIds, userId);
  }

  @Get(':id/classrooms-for-copy')
  @Roles('DOCENTE', 'COORDINADOR')
  async listClassroomsForCopy(@Param('id') id: string, @Request() req: any) {
    const { userId, institutionId } = await this.resolveCtx(req);
    return this.service.listTeacherClassroomsForCopy(userId, institutionId, id);
  }

  @Post('materials/:materialId/duplicate-to')
  @Roles('DOCENTE', 'COORDINADOR')
  async duplicateMaterial(@Param('materialId') materialId: string, @Request() req: any, @Body() body: {
    targetSectionId: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.duplicateMaterial(materialId, body.targetSectionId, userId);
  }

  @Post('activities/:activityId/duplicate-to')
  @Roles('DOCENTE', 'COORDINADOR')
  async duplicateActivity(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    targetSectionId: string;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.duplicateActivity(activityId, body.targetSectionId, userId);
  }

  @Post('sections/:sectionId/copy-to')
  @Roles('DOCENTE', 'COORDINADOR')
  async copySectionToClassroom(
    @Param('sectionId') sectionId: string,
    @Request() req: any,
    @Body() body: { targetClassroomId: string },
  ) {
    const { userId } = await this.resolveCtx(req);
    return this.service.copySectionToClassroom(sectionId, body.targetClassroomId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GRADEBOOK SYNC
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':classroomId/gradebook-config')
  @Roles('DOCENTE', 'COORDINADOR')
  async getGradebookConfig(@Param('classroomId') classroomId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.getGradebookConfig(classroomId, userId);
  }

  @Put('activities/:activityId/gradebook-link')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateGradebookLink(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    syncToGradebook: boolean;
    gradebookComponent?: string;
    gradebookIndex?: number;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.updateGradebookLink(activityId, userId, body);
  }

  @Get('activities/:activityId/sync-preview')
  @Roles('DOCENTE', 'COORDINADOR')
  async previewGradebookSync(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.previewGradebookSync(activityId, userId);
  }

  @Post('activities/:activityId/sync-gradebook')
  @Roles('DOCENTE', 'COORDINADOR')
  async syncToGradebook(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    studentEnrollmentIds?: string[];
    includeConflicts?: boolean;
    includeNoSubmission?: boolean;
  }) {
    const { userId } = await this.resolveCtx(req);
    return this.service.syncToGradebook(activityId, userId, body);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIÓN ACTITUDINAL - RÚBRICAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('rubrics')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMIN_INSTITUTIONAL')
  async listRubrics(@Request() req: any, @Query('type') type?: AttitudinalRubricType) {
    const { institutionId } = await this.resolveCtx(req);
    return this.attitudinalService.listRubrics(institutionId, type);
  }

  @Get('rubrics/:id')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMIN_INSTITUTIONAL')
  async getRubric(@Param('id') id: string) {
    return this.attitudinalService.getRubric(id);
  }

  @Post('rubrics')
  @Roles('COORDINADOR', 'ADMIN_INSTITUTIONAL')
  async createRubric(@Request() req: any, @Body() body: {
    name: string;
    description?: string;
    type: AttitudinalRubricType;
    targetProcess?: string;
    isDefault?: boolean;
    criteria: {
      name: string;
      description?: string;
      weight: number;
      order: number;
      levels: { score: number; label: string; description?: string; order: number }[];
    }[];
  }) {
    const { institutionId, userId } = await this.resolveCtx(req);
    return this.attitudinalService.createRubric({ ...body, institutionId, createdById: userId });
  }

  @Put('rubrics/:id')
  @Roles('COORDINADOR', 'ADMIN_INSTITUTIONAL')
  async updateRubric(@Param('id') id: string, @Body() body: {
    name?: string;
    description?: string;
    targetProcess?: string;
    isDefault?: boolean;
    isActive?: boolean;
    criteria?: {
      name: string;
      description?: string;
      weight: number;
      order: number;
      levels: { score: number; label: string; description?: string; order: number }[];
    }[];
  }) {
    return this.attitudinalService.updateRubric(id, body);
  }

  @Delete('rubrics/:id')
  @Roles('ADMIN_INSTITUTIONAL')
  async deleteRubric(@Param('id') id: string) {
    return this.attitudinalService.deleteRubric(id);
  }

  @Post('rubrics/seed-defaults')
  @Roles('ADMIN_INSTITUTIONAL')
  async seedDefaultRubrics(@Request() req: any) {
    const { institutionId, userId } = await this.resolveCtx(req);
    return this.attitudinalService.seedDefaultRubrics(institutionId, userId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIÓN ACTITUDINAL - AUTOEVALUACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/self-assessment')
  @Roles('ESTUDIANTE')
  async submitSelfAssessment(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    responses: { criterionId: string; levelId: string }[];
    reflection?: string;
  }) {
    const userId = req.user.id;
    // Obtener enrollment del estudiante
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    
    return this.attitudinalService.submitSelfAssessment({
      activityId,
      evaluatorEnrollmentId: enrollment.id,
      responses: body.responses,
      reflection: body.reflection,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIÓN ACTITUDINAL - COEVALUACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('activities/:activityId/peer-assessments/pending')
  @Roles('ESTUDIANTE')
  async getPendingPeerAssessments(@Param('activityId') activityId: string, @Request() req: any) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    
    return this.attitudinalService.getPendingPeerAssessments(activityId, enrollment.id);
  }

  @Post('activities/:activityId/peer-assessment')
  @Roles('ESTUDIANTE')
  async submitPeerAssessment(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    targetEnrollmentId: string;
    responses: { criterionId: string; levelId: string }[];
    reflection?: string;
  }) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    
    return this.attitudinalService.submitPeerAssessment({
      activityId,
      evaluatorEnrollmentId: enrollment.id,
      targetEnrollmentId: body.targetEnrollmentId,
      responses: body.responses,
      reflection: body.reflection,
    });
  }

  @Post('activities/:activityId/peer-assessment/create-pairs')
  @Roles('DOCENTE', 'COORDINADOR')
  async createPeerAssessmentPairs(@Param('activityId') activityId: string, @Body() body: {
    mode?: 'random' | 'all';
    peersPerStudent?: number;
  }) {
    return this.attitudinalService.createPeerAssessmentPairs(
      activityId,
      body.mode || 'random',
      body.peersPerStudent || 3,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EVALUACIÓN ACTITUDINAL - RESULTADOS Y SINCRONIZACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('activities/:activityId/attitudinal-results')
  @Roles('DOCENTE', 'COORDINADOR')
  async getAttitudinalResults(@Param('activityId') activityId: string) {
    return this.attitudinalService.getActivityResults(activityId);
  }

  @Post('activities/:activityId/attitudinal-sync')
  @Roles('DOCENTE', 'COORDINADOR')
  async syncAttitudinalToGradebook(@Param('activityId') activityId: string, @Body() body: { academicTermId: string }) {
    return this.attitudinalService.syncToGradebook(activityId, body.academicTermId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LECCIONES INTERACTIVAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/lesson')
  @Roles('DOCENTE', 'COORDINADOR')
  async createLesson(@Param('activityId') activityId: string, @Body() body: {
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
    return this.lessonService.createLesson(activityId, body);
  }

  @Get('activities/:activityId/lesson')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async getLessonByActivity(@Param('activityId') activityId: string) {
    return this.lessonService.getLessonByActivity(activityId);
  }

  @Put('lessons/:lessonId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateLesson(@Param('lessonId') lessonId: string, @Body() body: {
    title?: string;
    description?: string;
    coverImage?: string;
    badgeEmoji?: string;
    badgeTitle?: string;
    badgeColor?: string;
    estimatedMinutes?: number;
  }) {
    return this.lessonService.updateLesson(lessonId, body);
  }

  @Delete('lessons/:lessonId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteLesson(@Param('lessonId') lessonId: string) {
    return this.lessonService.deleteLesson(lessonId);
  }

  // Slides CRUD
  @Post('lessons/:lessonId/slides')
  @Roles('DOCENTE', 'COORDINADOR')
  async addSlide(@Param('lessonId') lessonId: string, @Body() body: {
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
    return this.lessonService.addSlide(lessonId, body);
  }

  @Put('lessons/:lessonId/slides/reorder')
  @Roles('DOCENTE', 'COORDINADOR')
  async reorderSlides(@Param('lessonId') lessonId: string, @Body() body: { slideIds: string[] }) {
    return this.lessonService.reorderSlides(lessonId, body.slideIds);
  }

  @Put('lessons/:lessonId/slides/bulk')
  @Roles('DOCENTE', 'COORDINADOR')
  async bulkUpdateSlides(@Param('lessonId') lessonId: string, @Body() body: {
    slides: Array<{
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
    }>;
  }) {
    return this.lessonService.bulkUpdateSlides(lessonId, body.slides);
  }

  @Put('slides/:slideId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateSlide(@Param('slideId') slideId: string, @Body() body: {
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
    return this.lessonService.updateSlide(slideId, body);
  }

  @Delete('slides/:slideId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteSlide(@Param('slideId') slideId: string) {
    return this.lessonService.deleteSlide(slideId);
  }

  // Student progress
  @Get('lessons/:lessonId/my-progress')
  @Roles('ESTUDIANTE')
  async getMyLessonProgress(@Param('lessonId') lessonId: string, @Request() req: any) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    return this.lessonService.getMyProgress(lessonId, enrollment.id);
  }

  @Post('lessons/:lessonId/start')
  @Roles('ESTUDIANTE')
  async startLesson(@Param('lessonId') lessonId: string, @Request() req: any) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    return this.lessonService.startLesson(lessonId, enrollment.id);
  }

  @Post('lessons/:lessonId/advance')
  @Roles('ESTUDIANTE')
  async advanceSlide(@Param('lessonId') lessonId: string, @Request() req: any, @Body() body: {
    slideIndex: number;
    slideId: string;
    answer?: any;
    timeSpentDelta?: number;
  }) {
    const userId = req.user.id;
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    return this.lessonService.advanceSlide(lessonId, enrollment.id, body);
  }

  @Get('lessons/:lessonId/progress')
  @Roles('DOCENTE', 'COORDINADOR')
  async getAllLessonProgress(@Param('lessonId') lessonId: string) {
    return this.lessonService.getAllProgress(lessonId);
  }

  // AI: generate lesson structure from text
  @Post('lessons/generate-ai')
  @Roles('DOCENTE', 'COORDINADOR')
  async generateLessonAI(@Body() body: { topic: string; content: string; gradeName?: string }) {
    return this.lessonService.generateLessonStructure(body.topic, body.content, body.gradeName);
  }
}
