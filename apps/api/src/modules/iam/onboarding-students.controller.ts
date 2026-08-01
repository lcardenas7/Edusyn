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
import { StudentImportService } from './student-import.service';

/**
 * MÓDULO 3 (Onboarding v2) — Importador de estudiantes canónico.
 * Por ahora: fase ANALIZAR (read-only). La fase APLICAR se agrega en la pieza 3/3.
 */
@Controller('onboarding/students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingStudentsController {
  constructor(
    private readonly studentImport: StudentImportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Analiza el Excel de estudiantes e INFIERE el ecosistema (grados/grupos/sedes/
   * jornadas) + cuadre de estudiantes. NO escribe nada.
   */
  @Post('analyze')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async analyze(@Request() req: any, @UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No se proporcionó archivo');
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.studentImport.analyze(institutionId, file.buffer);
  }
}
