/**
 * ACADEMIC STUDENTS CONTROLLER
 * 
 * Este controlador expone endpoints de estudiantes PARA USO ACADÉMICO.
 * 
 * Propósito: Desacoplar el dominio Académico del dominio Gestión Estudiantil.
 * 
 * El frontend académico (Grades, Attendance, Observer, etc.) debe usar estos
 * endpoints en lugar de llamar directamente a /students.
 * 
 * ARQUITECTURA:
 * - Este controlador NO accede a Prisma directamente
 * - Delega a StudentsService, que es el dueño del dominio de estudiantes
 * - Si cambia la lógica de matrículas/filtros, solo se modifica StudentsService
 */

import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from './students.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

interface AcademicStudent {
  id: string;
  name: string;
  enrollmentId: string;
  documentNumber?: string;
}

@Controller('academic/students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicStudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly prisma: PrismaService, // Solo para resolveInstitutionId
  ) {}

  /**
   * Obtiene estudiantes para un grupo en un año académico.
   * 
   * Este es el endpoint que deben usar las páginas académicas
   * (Grades, Attendance, Observer, Achievements, etc.)
   * 
   * Retorna solo los datos necesarios para el contexto académico:
   * - id: identificador del estudiante
   * - name: nombre completo
   * - enrollmentId: identificador de la matrícula (para vincular notas)
   * - documentNumber: opcional, para identificación
   */
  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentsForGroup(
    @Request() req: any,
    @Query('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
  ): Promise<AcademicStudent[]> {
    if (!groupId || !academicYearId) {
      return [];
    }

    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) {
      return [];
    }

    // Delegar a StudentsService - el controlador NO conoce la implementación
    return this.studentsService.getStudentsForAcademicContext({
      groupId,
      academicYearId,
      institutionId: instId,
    });
  }

  /**
   * Obtiene estudiantes para múltiples grupos (útil para reportes)
   */
  @Get('by-groups')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentsForGroups(
    @Request() req: any,
    @Query('groupIds') groupIds: string,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
  ): Promise<Record<string, AcademicStudent[]>> {
    if (!groupIds || !academicYearId) {
      return {};
    }

    const groupIdList = groupIds.split(',').filter(Boolean);
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) {
      return {};
    }

    // Delegar a StudentsService - el controlador NO conoce la implementación
    return this.studentsService.getStudentsForMultipleGroups({
      groupIds: groupIdList,
      academicYearId,
      institutionId: instId,
    });
  }
}
