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
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentDocumentsService, CreateDocumentDto, UpdateDocumentDto } from './student-documents.service';
import { EnrollmentDocType } from '@prisma/client';

@Controller('student-documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentDocumentsController {
  constructor(private readonly documentsService: StudentDocumentsService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CREAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER DOCUMENTOS DE UN ESTUDIANTE
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('student/:studentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA', 'DOCENTE')
  async getByStudent(@Param('studentId') studentId: string) {
    return this.documentsService.getByStudent(studentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER CHECKLIST DE DOCUMENTOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('checklist/:studentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async getChecklist(@Param('studentId') studentId: string) {
    return this.documentsService.getDocumentChecklist(studentId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTADÍSTICAS DE DOCUMENTOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async getStats(@Query('institutionId') institutionId: string) {
    return this.documentsService.getDocumentStats(institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTUALIZAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Put(':documentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'SECRETARIA')
  async update(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(documentId, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALIDAR O RECHAZAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':documentId/validate')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async validate(
    @Param('documentId') documentId: string,
    @Body() body: { status: 'VALIDATED' | 'REJECTED'; rejectionReason?: string },
    @Request() req: any,
  ) {
    return this.documentsService.validate({
      documentId,
      status: body.status,
      rejectionReason: body.rejectionReason,
      validatedById: req.user.id,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ELIMINAR DOCUMENTO
  // ═══════════════════════════════════════════════════════════════════════════

  @Delete(':documentId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR')
  async delete(@Param('documentId') documentId: string) {
    return this.documentsService.delete(documentId);
  }
}
