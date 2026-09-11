import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  EnrollmentService,
  EnrollStudentDto,
  EnrollmentFilters,
  CreateStudentAndEnrollDto,
} from './enrollment.service';
import { EnrollmentStatus, EnrollmentMovementType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('enrollments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EnrollmentController {
  constructor(
    private readonly enrollmentService: EnrollmentService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // MATRICULAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async enrollStudent(@Body() dto: Omit<EnrollStudentDto, 'enrolledById'>, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.enrollStudent({
      ...dto,
      enrolledById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR ESTUDIANTE Y MATRICULAR (FLUJO UNIFICADO)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('create-and-enroll')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async createStudentAndEnroll(
    @Body() dto: Omit<CreateStudentAndEnrollDto, 'enrolledById' | 'institutionId'>,
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.createStudentAndEnroll({
      ...dto,
      institutionId,
      enrolledById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR ESTUDIANTE POR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('find-student')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async findStudentByDocument(
    @Request() req: any,
    @Query('institutionId') institutionId: string,
    @Query('documentNumber') documentNumber: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.enrollmentService.findStudentByDocument(instId, documentNumber);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getEnrollments(@Request() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('search') search?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const filters: EnrollmentFilters = {
      academicYearId,
      gradeId,
      groupId,
      status,
      search,
    };
    return this.enrollmentService.getEnrollments(filters, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER MATRÍCULA POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':enrollmentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getEnrollmentById(@Request() req: any, @Param('enrollmentId') enrollmentId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getEnrollmentById(enrollmentId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULA
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':enrollmentId/history')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEnrollmentHistory(@Request() req: any, @Param('enrollmentId') enrollmentId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getEnrollmentHistory(enrollmentId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULAS DE UN ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('student/:studentId/history')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getStudentEnrollmentHistory(@Request() req: any, @Param('studentId') studentId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getStudentEnrollmentHistory(studentId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats/:academicYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getEnrollmentStats(@Request() req: any, @Param('academicYearId') academicYearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getEnrollmentStats(academicYearId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RETIRAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':enrollmentId/withdraw')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async withdrawStudent(
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { reason: string; observations?: string },
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.withdrawStudent({
      enrollmentId,
      reason: body.reason,
      observations: body.observations,
      performedById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRASLADAR ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':enrollmentId/transfer')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async transferStudent(
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { reason: string; destinationInstitution?: string; observations?: string },
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.transferStudent({
      enrollmentId,
      reason: body.reason,
      destinationInstitution: body.destinationInstitution,
      observations: body.observations,
      performedById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMBIAR GRUPO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':enrollmentId/change-group')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async changeGroup(
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { 
      newGroupId: string; 
      reason: string; 
      movementType: EnrollmentMovementType;
      observations?: string;
    },
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.changeGroup({
      enrollmentId,
      newGroupId: body.newGroupId,
      reason: body.reason,
      movementType: body.movementType,
      observations: body.observations,
      performedById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REACTIVAR ESTUDIANTE (Reingreso)
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':enrollmentId/reactivate')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async reactivateStudent(
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: { reason: string; observations?: string },
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.reactivateStudent({
      enrollmentId,
      reason: body.reason,
      observations: body.observations,
      performedById: req.user.id,
    }, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE CUPOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('capacity/:academicYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getCapacityByAcademicYear(
    @Request() req: any,
    @Param('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.enrollmentService.getCapacityByAcademicYear(academicYearId, instId);
  }

  @Get('capacity/:academicYearId/group/:groupId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getGroupCapacity(@Request() req: any,
    @Param('groupId') groupId: string,
    @Param('academicYearId') academicYearId: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getGroupCapacity(groupId, academicYearId, institutionId);
  }

  @Put('capacity/group/:groupId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async updateGroupCapacity(@Request() req: any,
    @Param('groupId') groupId: string,
    @Body() body: { maxCapacity: number | null },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.updateGroupCapacity(groupId, body.maxCapacity, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTRUCTURA ACADÉMICA DE MATRÍCULA (SNAPSHOT)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':enrollmentId/academic-structure')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getEnrollmentAcademicStructure(@Request() req: any, @Param('enrollmentId') enrollmentId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.getEnrollmentAcademicStructure(enrollmentId, institutionId);
  }

  @Post(':enrollmentId/regenerate-snapshot')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async regenerateAcademicSnapshot(@Request() req: any, @Param('enrollmentId') enrollmentId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.enrollmentService.regenerateAcademicSnapshot(enrollmentId, institutionId);
  }
}
