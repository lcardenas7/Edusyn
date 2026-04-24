import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Header,
  StreamableFile,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Query,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GradesBulkImportService, GradesImportResult, PreviewResult } from './grades-bulk-import.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('admin/grades-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR') // Rector y Coordinador
export class GradesBulkImportController {
  constructor(
    private readonly importService: GradesBulkImportService,
    private readonly prisma: PrismaService,
  ) {}

  private async getInstitutionId(userId: string): Promise<string> {
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId },
    });
    if (!institutionUser) {
      throw new BadRequestException('Usuario no asociado a ninguna institución');
    }
    return institutionUser.institutionId;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER OPCIONES DISPONIBLES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('grades')
  async getAvailableGrades(@Request() req: any) {
    const institutionId = await this.getInstitutionId(req.user.id);
    return this.importService.getAvailableGrades(institutionId);
  }

  @Get('terms')
  async getAvailableTerms(@Request() req: any) {
    const institutionId = await this.getInstitutionId(req.user.id);
    return this.importService.getAvailableTerms(institutionId);
  }

  @Get('template')
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  async downloadTemplate(
    @Request() req: any,
    @Query('gradeId') gradeId: string,
  ) {
    if (!gradeId) {
      throw new BadRequestException('Debe seleccionar un grado');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    const buffer = await this.importService.generateImportTemplate(institutionId, gradeId);

    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: `attachment; filename="plantilla_notas_${gradeId}.xlsx"`,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PREVIEW: Analizar Excel sin aplicar cambios
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('preview')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async previewImport(
    @Request() req: any,
    @UploadedFile() file: any,
    @Query('gradeId') gradeId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }
    if (!gradeId) {
      throw new BadRequestException('Debe seleccionar un grado');
    }
    if (!academicTermId) {
      throw new BadRequestException('Debe seleccionar un período');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    return this.importService.previewImport(
      institutionId,
      gradeId,
      academicTermId,
      file.buffer,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPORT: Aplicar importación de notas
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('execute')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async executeImport(
    @Request() req: any,
    @UploadedFile() file: any,
    @Query('gradeId') gradeId: string,
    @Query('academicTermId') academicTermId: string,
    @Body() options: {
      createMissingStudents?: boolean;
      deactivateMissingStudents?: boolean;
      overwriteExistingGrades?: boolean;
    },
  ): Promise<GradesImportResult> {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }
    if (!gradeId) {
      throw new BadRequestException('Debe seleccionar un grado');
    }
    if (!academicTermId) {
      throw new BadRequestException('Debe seleccionar un período');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    return this.importService.importGrades(
      institutionId,
      gradeId,
      academicTermId,
      file.buffer,
      {
        createMissingStudents: options.createMissingStudents ?? false,
        deactivateMissingStudents: options.deactivateMissingStudents ?? false,
        overwriteExistingGrades: options.overwriteExistingGrades ?? true,
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVIVENCIA: Activar/desactivar asignatura especial para tutores
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('convivencia/:gradeId')
  async getConvivenciaStatus(
    @Param('gradeId') gradeId: string,
    @Request() req: any,
  ) {
    const institutionId = await this.getInstitutionId(req.user.id);
    
    // Obtener año académico activo
    const year = await this.prisma.academicYear.findFirst({
      where: { institutionId, status: 'ACTIVE' },
    });
    
    if (!year) {
      throw new BadRequestException('No hay año académico activo');
    }

    return this.importService.getConvivenciaStatus(gradeId, year.id);
  }

  @Put('convivencia/:groupId')
  async toggleConvivencia(
    @Param('groupId') groupId: string,
    @Body() body: { enabled: boolean },
    @Request() req: any,
  ) {
    const institutionId = await this.getInstitutionId(req.user.id);
    
    // Obtener año académico activo
    const year = await this.prisma.academicYear.findFirst({
      where: { institutionId, status: 'ACTIVE' },
    });
    
    if (!year) {
      throw new BadRequestException('No hay año académico activo');
    }

    return this.importService.toggleConvivencia(groupId, body.enabled, year.id);
  }
}
