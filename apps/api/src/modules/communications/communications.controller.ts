import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

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
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  create(@Request() req, @Body() dto: CreateMessageDto) {
    // Usar institutionId del JWT si no viene en el DTO
    if (!dto.institutionId && req.user.institutionId) {
      dto.institutionId = req.user.institutionId;
    }
    return this.communicationsService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  update(@Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.communicationsService.update(id, dto);
  }

  @Post(':id/send')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  send(@Param('id') id: string) {
    return this.communicationsService.send(id);
  }

  @Delete(':id')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR')
  delete(@Param('id') id: string) {
    return this.communicationsService.delete(id);
  }

  // Listar mensajes por institución (query param o JWT)
  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getAll(
    @Request() req,
    @Query('institutionId') institutionId?: string,
    @Query('status') status?: string,
  ) {
    const instId = institutionId || req.user.institutionId;
    return this.communicationsService.getByInstitution(instId, status);
  }

  @Get('institution/:institutionId')
  @Roles('ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getByInstitution(
    @Param('institutionId') institutionId: string,
    @Query('status') status?: string,
  ) {
    return this.communicationsService.getByInstitution(institutionId, status);
  }

  @Get('inbox')
  getInbox(@Request() req) {
    return this.communicationsService.getInbox(req.user.id);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.communicationsService.getById(id);
  }

  @Post(':id/read')
  markAsRead(@Param('id') id: string, @Request() req) {
    return this.communicationsService.markAsRead(id, req.user.id);
  }
}
