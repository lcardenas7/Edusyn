import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { FormativeEvaluationService } from './formative-evaluation.service';

/** Evaluación formativa (rúbricas, autoevaluación y coevaluación). Controlador propio y con
 * prefijo propio: no toca las rutas ni las excepciones auditadas de ClassroomController. Cada
 * ruta resuelve la institución del actor antes de llamar al servicio. */
@Controller('formative-evaluations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FormativeEvaluationController {
  constructor(private readonly service: FormativeEvaluationService, private readonly prisma: PrismaService) {}

  @Get('classrooms/:classroomId') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async list(@Param('classroomId') classroomId: string, @Request() req: any, @Query('role') role?: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.listForClassroom(classroomId, institutionId, req.user.id, role === 'student' ? 'student' : 'teacher');
  }

  @Get('classrooms/:classroomId/components') @Roles('DOCENTE', 'COORDINADOR')
  async components(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.components(classroomId, institutionId, req.user.id);
  }

  @Post() @Roles('DOCENTE', 'COORDINADOR')
  async create(@Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.create(institutionId, req.user.id, body);
  }

  @Post('generate-ai') @Roles('DOCENTE', 'COORDINADOR')
  async generateDraft(@Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.generateDraft(institutionId, req.user.id, body);
  }

  @Post('from-ai-draft') @Roles('DOCENTE', 'COORDINADOR')
  async createFromAiDraft(@Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createFromAiDraft(institutionId, req.user.id, body);
  }

  @Patch(':id/dimensions/:dimensionId/component') @Roles('DOCENTE', 'COORDINADOR')
  async updateComponent(@Param('id') id: string, @Param('dimensionId') dimensionId: string, @Request() req: any, @Body() body: { evaluationComponentId?: string | null }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateDimensionComponent(id, dimensionId, institutionId, req.user.id, body?.evaluationComponentId ?? null);
  }

  @Get(':id/peer-preview') @Roles('DOCENTE', 'COORDINADOR')
  async peerPreview(@Param('id') id: string, @Request() req: any, @Query('seed') seed?: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.peerPreview(id, institutionId, req.user.id, seed);
  }

  @Get(':id') @Roles('DOCENTE', 'COORDINADOR')
  async getOne(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getForTeacher(id, institutionId, req.user.id);
  }

  @Put(':id') @Roles('DOCENTE', 'COORDINADOR')
  async updateDraft(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateDraft(id, institutionId, req.user.id, body);
  }

  @Delete(':id') @Roles('DOCENTE', 'COORDINADOR')
  async deleteDraft(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.deleteDraft(id, institutionId, req.user.id);
  }

  @Post(':id/publish') @Roles('DOCENTE', 'COORDINADOR')
  async publish(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.publish(id, institutionId, req.user.id, body);
  }

  @Post('assignments/:id/submit') @Roles('ESTUDIANTE')
  async submit(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.submit(id, institutionId, req.user.id, body);
  }

  @Post(':id/consolidate') @Roles('DOCENTE', 'COORDINADOR')
  async consolidate(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.consolidate(id, institutionId, req.user.id);
  }

  @Get(':id/dashboard') @Roles('DOCENTE', 'COORDINADOR')
  async dashboard(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.dashboard(id, institutionId, req.user.id);
  }

  @Get(':id/sync-preview') @Roles('DOCENTE', 'COORDINADOR')
  async syncPreview(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.previewSync(id, institutionId, req.user.id);
  }

  @Post(':id/sync') @Roles('DOCENTE', 'COORDINADOR')
  async sync(@Param('id') id: string, @Request() req: any, @Body() body: { idempotencyKey: string; previewHash: string }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.sync(id, institutionId, req.user.id, body);
  }
}
