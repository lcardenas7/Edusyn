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
    return this.enrollmentService.enrollStudent({
      ...dto,
      enrolledById: req.user.id,
    });
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
    // Obtener institutionId del JWT
    let institutionId = req.user?.institutionId;
    
    // Si no viene en el JWT, buscar en InstitutionUser
    if (!institutionId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      institutionId = institutionUser?.institutionId;
    }

    if (!institutionId) {
      throw new UnauthorizedException('No se pudo determinar la institución del usuario');
    }

    return this.enrollmentService.createStudentAndEnroll({
      ...dto,
      institutionId,
      enrolledById: req.user.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSCAR ESTUDIANTE POR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('find-student')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async findStudentByDocument(
    @Query('institutionId') institutionId: string,
    @Query('documentNumber') documentNumber: string,
  ) {
    return this.enrollmentService.findStudentByDocument(institutionId, documentNumber);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LISTAR MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getEnrollments(
    @Query('academicYearId') academicYearId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('groupId') groupId?: string,
    @Query('status') status?: EnrollmentStatus,
    @Query('search') search?: string,
  ) {
    const filters: EnrollmentFilters = {
      academicYearId,
      gradeId,
      groupId,
      status,
      search,
    };
    return this.enrollmentService.getEnrollments(filters);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER MATRÍCULA POR ID
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':enrollmentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getEnrollmentById(@Param('enrollmentId') enrollmentId: string) {
    return this.enrollmentService.getEnrollmentById(enrollmentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULA
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':enrollmentId/history')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getEnrollmentHistory(@Param('enrollmentId') enrollmentId: string) {
    return this.enrollmentService.getEnrollmentHistory(enrollmentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HISTORIAL DE MATRÍCULAS DE UN ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('student/:studentId/history')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'SECRETARIA')
  async getStudentEnrollmentHistory(@Param('studentId') studentId: string) {
    return this.enrollmentService.getStudentEnrollmentHistory(studentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE MATRÍCULAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats/:academicYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getEnrollmentStats(@Param('academicYearId') academicYearId: string) {
    return this.enrollmentService.getEnrollmentStats(academicYearId);
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
    return this.enrollmentService.withdrawStudent({
      enrollmentId,
      reason: body.reason,
      observations: body.observations,
      performedById: req.user.id,
    });
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
    return this.enrollmentService.transferStudent({
      enrollmentId,
      reason: body.reason,
      destinationInstitution: body.destinationInstitution,
      observations: body.observations,
      performedById: req.user.id,
    });
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
    return this.enrollmentService.changeGroup({
      enrollmentId,
      newGroupId: body.newGroupId,
      reason: body.reason,
      movementType: body.movementType,
      observations: body.observations,
      performedById: req.user.id,
    });
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
    return this.enrollmentService.reactivateStudent({
      enrollmentId,
      reason: body.reason,
      observations: body.observations,
      performedById: req.user.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GESTIÓN DE CUPOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('capacity/:academicYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getCapacityByAcademicYear(
    @Param('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId: string,
  ) {
    return this.enrollmentService.getCapacityByAcademicYear(academicYearId, institutionId);
  }

  @Get('capacity/:academicYearId/group/:groupId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getGroupCapacity(
    @Param('groupId') groupId: string,
    @Param('academicYearId') academicYearId: string,
  ) {
    return this.enrollmentService.getGroupCapacity(groupId, academicYearId);
  }

  @Put('capacity/group/:groupId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async updateGroupCapacity(
    @Param('groupId') groupId: string,
    @Body() body: { maxCapacity: number | null },
  ) {
    return this.enrollmentService.updateGroupCapacity(groupId, body.maxCapacity);
  }
}
