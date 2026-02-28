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
}
