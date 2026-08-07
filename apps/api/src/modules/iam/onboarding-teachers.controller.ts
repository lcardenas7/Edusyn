import {
  BadRequestException,
  Controller,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { TeacherImportService } from './teacher-import.service';

/**
 * MÓDULO 4 (Onboarding v2) — Importador de docentes.
 * Dos fases: analyze (read-only) + apply (idempotente). Devuelve los tipos del
 * contrato @edusyn/types (ImportAnalysis / ApplyResult).
 */
@Controller('onboarding/teachers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingTeachersController {
  constructor(
    private readonly teacherImport: TeacherImportService,
    private readonly prisma: PrismaService,
  ) {}

  /** Analiza el Excel de docentes y cuadra. NO escribe. */
  @Post('analyze')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async analyze(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No se proporcionó archivo');
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.teacherImport.analyze(institutionId, file.buffer);
  }

  /** Aplica: crea usuarios docentes + rol, de forma idempotente por correo. */
  @Post('apply')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async apply(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No se proporcionó archivo');
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.teacherImport.apply(institutionId, file.buffer);
  }
}
