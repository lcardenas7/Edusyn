import {
  BadRequestException,
  Body,
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
import { AcademicLoadImportService } from './academic-load-import.service';

/**
 * MÓDULO 5 (Onboarding v2) — Importador de carga académica (TeacherAssignment).
 * Dos fases; devuelve ImportAnalysis / ApplyResult del contrato. `academicYearId`
 * es opcional: si falta, usa el año DRAFT/ACTIVE de la institución.
 */
@Controller('onboarding/academic-load')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OnboardingAcademicLoadController {
  constructor(
    private readonly academicLoad: AcademicLoadImportService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('analyze')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async analyze(@Request() req: any, @UploadedFile() file: any, @Body() body: { academicYearId?: string }) {
    if (!file) throw new BadRequestException('No se proporcionó archivo');
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.academicLoad.analyze(institutionId, file.buffer, body?.academicYearId);
  }

  @Post('apply')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR', 'COORDINADOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async apply(@Request() req: any, @UploadedFile() file: any, @Body() body: { academicYearId?: string }) {
    if (!file) throw new BadRequestException('No se proporcionó archivo');
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.academicLoad.apply(institutionId, file.buffer, body?.academicYearId);
  }
}
