import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomService } from './classroom.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomController {
  constructor(
    private readonly service: ClassroomService,
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
  async deleteSection(@Param('sectionId') sectionId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteSection(sectionId, userId);
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
  async publishActivity(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.publishActivity(activityId, userId);
  }

  @Put('activities/:activityId/unpublish')
  @Roles('DOCENTE', 'COORDINADOR')
  async unpublishActivity(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.unpublishActivity(activityId, userId);
  }

  @Delete('activities/:activityId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteActivity(@Param('activityId') activityId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    return this.service.deleteActivity(activityId, userId);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // QUIZ / EXAM – Questions
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('activities/:activityId/questions')
  @Roles('DOCENTE', 'COORDINADOR')
  async addQuestion(@Param('activityId') activityId: string, @Request() req: any, @Body() body: {
    type: string; text: string; options?: any; correctAnswer?: string;
    points?: number; explanation?: string; imageUrl?: string;
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

  @Delete('forum/:postId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async deleteForumPost(@Param('postId') postId: string, @Request() req: any) {
    const { userId } = await this.resolveCtx(req);
    const isTeacher = req.user.roles?.some((r: any) => ['DOCENTE', 'COORDINADOR'].includes(r.role || r));
    return this.service.deleteForumPost(postId, userId, !!isTeacher);
  }
}
