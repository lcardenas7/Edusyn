import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommunicationsService } from './communications.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/**
 * Comunicaciones internas.
 *
 * ⚠️ AISLAMIENTO MULTI-TENANT (docs/security/RLS-AUDIT-COMMUNICATIONS.md).
 * El `institutionId` del DTO y el `:id` de la ruta no son fuente de autoridad. La
 * institución la resuelve el servidor y el servicio acota cada consulta.
 *
 * NO se añaden `@Roles`: `ESTUDIANTE` y `ACUDIENTE` están diseñados para usar el módulo
 * —`getAllowedCategories` les devuelve `['INDIVIDUAL']` y `getAvailableRecipients` les
 * acota los destinatarios—. El defecto nunca fue que escribieran, sino que pudieran
 * escribir y leer en OTRA institución.
 */
@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationsController {
  constructor(
    private readonly communicationsService: CommunicationsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Roles del JWT, normalizados. Mismo patrón que ya usaban los otros endpoints. */
  private rolesOf(req: any): string[] {
    return (req.user?.roles || []).map((r: any) => r.role?.name || r.name || r);
  }

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  async create(@Request() req, @Body() dto: CreateMessageDto) {
    // El dto conserva institutionId por compatibilidad de contrato, pero su valor se ignora.
    const institutionId = await requireInstitutionId(this.prisma as any, req, dto.institutionId);
    return this.communicationsService.create(req.user.id, dto, institutionId);
  }

  @Put(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  async update(@Request() req, @Param('id') id: string, @Body() dto: UpdateMessageDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.update(id, dto, institutionId);
  }

  @Post(':id/send')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  async send(@Request() req, @Param('id') id: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.send(id, institutionId);
  }

  @Delete(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async delete(@Request() req, @Param('id') id: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.delete(id, institutionId);
  }

  // Listar mensajes enviados por el usuario actual
  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  getAll(
    @Request() req,
    @Query('status') status?: string,
  ) {
    const instId = req.user.institutionId;
    return this.communicationsService.getByInstitution(instId, status, req.user.id);
  }

  @Get('institution/:institutionId')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getByInstitution(
    @Request() req,
    @Param('institutionId') institutionId: string,
    @Query('status') status?: string,
  ) {
    // Seguridad: ignorar param y usar JWT para usuarios no-superadmin
    const instId = req.user.institutionId || institutionId;
    return this.communicationsService.getByInstitution(instId, status);
  }

  @Get('available-recipients')
  getAvailableRecipients(
    @Request() req,
    @Query('search') search?: string,
  ) {
    const institutionId = req.user.institutionId;
    return this.communicationsService.getAvailableRecipients(
      req.user.id,
      institutionId,
      this.rolesOf(req),
      search,
    );
  }

  @Get('allowed-categories')
  getAllowedCategories(@Request() req) {
    return this.communicationsService.getAllowedCategories(this.rolesOf(req));
  }

  /**
   * La institución y los roles se pasan explícitamente: el aislamiento de la bandeja
   * depende de ambos. Un SuperAdmin sin institución recibe una bandeja vacía.
   */
  @Get('inbox')
  getInbox(@Request() req) {
    return this.communicationsService.getInbox(
      req.user.id,
      req.user.institutionId ?? null,
      this.rolesOf(req),
    );
  }

  @Get('storage-usage')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  getStorageUsage(@Request() req) {
    const institutionId = req.user.institutionId;
    return this.communicationsService.getStorageUsage(institutionId);
  }

  @Get(':id')
  async getById(@Request() req, @Param('id') id: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.getById(id, institutionId);
  }

  @Post(':id/reply')
  async reply(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { content: string },
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.reply(id, req.user.id, body.content, institutionId);
  }

  @Get(':id/replies')
  async getReplies(@Request() req, @Param('id') id: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.communicationsService.getReplies(id, institutionId);
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.communicationsService.markAsRead(id, req.user.id);
  }

  @Post(':id/attachments')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  @UseInterceptors(FileInterceptor('file'))
  uploadAttachment(
    @Param('id') id: string,
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.communicationsService.uploadAttachment(id, req.user.id, file);
  }

  @Delete('attachments/:attachmentId')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  removeAttachment(@Param('attachmentId') attachmentId: string, @Request() req) {
    return this.communicationsService.removeAttachment(attachmentId, req.user.id);
  }

  @Get('attachments/:attachmentId/download')
  getAttachmentDownloadUrl(@Param('attachmentId') attachmentId: string, @Request() req) {
    return this.communicationsService.getAttachmentDownloadUrl(
      attachmentId,
      req.user.id,
      req.user.institutionId ?? null,
      this.rolesOf(req),
    );
  }
}
