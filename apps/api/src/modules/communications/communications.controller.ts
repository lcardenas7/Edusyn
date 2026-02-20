import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CommunicationsService } from './communications.service';
import { CreateMessageDto, UpdateMessageDto } from './dto/create-message.dto';

@Controller('communications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  create(@Request() req, @Body() dto: CreateMessageDto) {
    // Usar institutionId del JWT si no viene en el DTO
    if (!dto.institutionId && req.user.institutionId) {
      dto.institutionId = req.user.institutionId;
    }
    return this.communicationsService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  update(@Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.communicationsService.update(id, dto);
  }

  @Post(':id/send')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE', 'SECRETARIA', 'ORIENTADOR')
  send(@Param('id') id: string) {
    return this.communicationsService.send(id);
  }

  @Delete(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  delete(@Param('id') id: string) {
    return this.communicationsService.delete(id);
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
    const userRoles = (req.user.roles || []).map((r: any) => r.role?.name || r.name || r);
    return this.communicationsService.getAvailableRecipients(
      req.user.id,
      institutionId,
      userRoles,
      search,
    );
  }

  @Get('allowed-categories')
  getAllowedCategories(@Request() req) {
    const userRoles = (req.user.roles || []).map((r: any) => r.role?.name || r.name || r);
    return this.communicationsService.getAllowedCategories(userRoles);
  }

  @Get('inbox')
  getInbox(@Request() req) {
    return this.communicationsService.getInbox(req.user.id);
  }

  @Get('storage-usage')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  getStorageUsage(@Request() req) {
    const institutionId = req.user.institutionId;
    return this.communicationsService.getStorageUsage(institutionId);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.communicationsService.getById(id);
  }

  @Post(':id/reply')
  reply(
    @Param('id') id: string,
    @Request() req,
    @Body() body: { content: string },
  ) {
    return this.communicationsService.reply(id, req.user.id, body.content);
  }

  @Get(':id/replies')
  getReplies(@Param('id') id: string) {
    return this.communicationsService.getReplies(id);
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
    return this.communicationsService.getAttachmentDownloadUrl(attachmentId, req.user.id);
  }
}
