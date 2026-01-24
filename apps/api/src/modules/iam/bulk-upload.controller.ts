import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Res,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BulkUploadService, UploadResult } from './bulk-upload.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('iam/bulk')
@UseGuards(JwtAuthGuard)
export class BulkUploadController {
  constructor(
    private readonly bulkUploadService: BulkUploadService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper para obtener institutionId del usuario actual
   */
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
  // PLANTILLAS DE DESCARGA
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('template/teachers')
  async downloadTeacherTemplate(@Res() res: Response) {
    const workbook = await this.bulkUploadService.generateTeacherTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_docentes.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('template/students')
  async downloadStudentTemplate(@Request() req: any, @Res() res: Response) {
    const institutionId = await this.getInstitutionId(req.user.id);
    const workbook = await this.bulkUploadService.generateStudentTemplate(institutionId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_estudiantes.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('template/staff')
  async downloadStaffTemplate(@Res() res: Response) {
    const workbook = await this.bulkUploadService.generateStaffTemplate();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=plantilla_personal.xlsx',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA DE ARCHIVOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('upload/teachers')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  }))
  async uploadTeachers(
    @Request() req: any,
    @UploadedFile() file: any,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    return this.bulkUploadService.processTeacherUpload(institutionId, file.buffer);
  }

  @Post('upload/students')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  }))
  async uploadStudents(
    @Request() req: any,
    @UploadedFile() file: any,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    return this.bulkUploadService.processStudentUpload(
      institutionId,
      file.buffer,
      academicYearId,
    );
  }

  @Post('upload/staff')
  @UseInterceptors(FileInterceptor('file', {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB
    },
  }))
  async uploadStaff(
    @Request() req: any,
    @UploadedFile() file: any,
  ): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No se proporcionó archivo');
    }

    const institutionId = await this.getInstitutionId(req.user.id);
    return this.bulkUploadService.processStaffUpload(institutionId, file.buffer);
  }
}
