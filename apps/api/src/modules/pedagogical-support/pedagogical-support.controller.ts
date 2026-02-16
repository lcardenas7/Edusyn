import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PedagogicalSupportService } from './pedagogical-support.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('pedagogical-support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedagogicalSupportController {
  constructor(
    private readonly supportService: PedagogicalSupportService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR PLAN DE ACOMPAÑAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(
    @Request() req: any,
    @Body()
    body: {
      studentEnrollmentId: string;
      achievementId?: string;
      academicTermId: string;
      supportStrategy: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
    },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.supportService.createSupportPlan({
      institutionId,
      ...body,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR PLAN
  // ═══════════════════════════════════════════════════════════════════════════

  @Patch(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      supportStrategy?: string;
      familyCommitment?: string;
      followUpDate?: string;
      observations?: string;
      status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.supportService.updateSupportPlan(id, institutionId, body);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MARCAR COMO COMPLETADO
  // ═══════════════════════════════════════════════════════════════════════════

  @Patch(':id/complete')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async markCompleted(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { observations?: string },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const userId = req.user?.id;
    return this.supportService.markCompleted(id, institutionId, userId, body.observations);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.supportService.getByStudent(studentEnrollmentId, academicTermId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('by-group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByGroup(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('status') status?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.supportService.getByGroup(groupId, academicTermId, institutionId, status);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getById(@Param('id') id: string) {
    return this.supportService.getById(id);
  }
}
