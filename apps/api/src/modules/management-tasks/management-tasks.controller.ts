import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ManagementTasksService } from './management-tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import type {
  CreateLeaderDto,
  CreateTaskDto,
  UpdateTaskDto,
  SubmitEvidenceDto,
  VerifyTaskDto,
} from './management-tasks.service';
import { TaskPriority, TaskCategory, TaskAssignmentStatus } from '@prisma/client';

@Controller('management-tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManagementTasksController {
  constructor(
    private readonly tasksService: ManagementTasksService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // LÍDERES DE GESTIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('leaders')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async createLeader(
    @Body() dto: CreateLeaderDto,
    @Request() req: any,
  ) {
    return this.tasksService.createLeader(dto, req.user.id);
  }

  @Get('leaders')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getLeaders(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.tasksService.getLeaders(instId);
  }

  @Delete('leaders/:id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async removeLeader(@Param('id') id: string) {
    return this.tasksService.removeLeader(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAREAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async createTask(
    @Body() dto: CreateTaskDto,
    @Request() req: any,
  ) {
    // Verificar si el docente es líder para poder crear tareas
    const userRoles = req.user.roles?.map((r: any) => r.role?.name || r.name) || [];
    const isAdmin = userRoles.some((r: string) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r));
    
    if (!isAdmin) {
      const isLeader = await this.tasksService.isUserLeader(req.user.id, dto.institutionId);
      if (!isLeader) {
        throw new Error('Solo los líderes de gestión pueden crear tareas');
      }
    }
    
    return this.tasksService.createTask(dto, req.user.id);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getTasks(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: TaskAssignmentStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('category') category?: TaskCategory,
    @Query('createdById') createdById?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.tasksService.getTasks(instId, { status, priority, category, createdById });
  }

  @Get('my-tasks')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getMyTasks(
    @Request() req: any,
    @Query('status') status?: TaskAssignmentStatus,
  ) {
    return this.tasksService.getMyTasks(req.user.id, status);
  }

  @Get('my-pending-count')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getMyPendingCount(@Request() req: any) {
    const count = await this.tasksService.getMyPendingCount(req.user.id);
    return { count };
  }

  @Get('pending-verifications')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPendingVerifications(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.tasksService.getPendingVerifications(instId, req.user.id);
  }

  @Get('enums')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEnums() {
    return this.tasksService.getEnums();
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getTask(@Param('id') id: string) {
    return this.tasksService.getTaskById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async updateTask(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @Request() req: any,
  ) {
    return this.tasksService.updateTask(id, dto, req.user.id);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteTask(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.tasksService.deleteTask(id, req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNACIONES (Acciones del docente)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('assignments/:id/start')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async startTask(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.tasksService.startTask(id, req.user.id);
  }

  @Post('assignments/:id/submit')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  @UseInterceptors(FileInterceptor('evidence'))
  async submitEvidence(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('responseNote') responseNote: string,
    @Request() req: any,
  ) {
    return this.tasksService.submitEvidence(id, req.user.id, { responseNote }, file);
  }

  @Post('assignments/:id/complete')
  @Roles('DOCENTE', 'COORDINADOR', 'ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async markAsCompleted(
    @Param('id') id: string,
    @Body('responseNote') responseNote: string,
    @Request() req: any,
  ) {
    return this.tasksService.markAsCompleted(id, req.user.id, responseNote);
  }

  @Post('assignments/:id/verify')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async verifyTask(
    @Param('id') id: string,
    @Body() dto: VerifyTaskDto,
    @Request() req: any,
  ) {
    return this.tasksService.verifyTask(id, req.user.id, dto);
  }
}
