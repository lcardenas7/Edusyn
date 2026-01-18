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
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  create(@Request() req, @Body() dto: CreateMessageDto) {
    return this.communicationsService.create(req.user.id, dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  update(@Param('id') id: string, @Body() dto: UpdateMessageDto) {
    return this.communicationsService.update(id, dto);
  }

  @Post(':id/send')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  send(@Param('id') id: string) {
    return this.communicationsService.send(id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'COORDINATOR')
  delete(@Param('id') id: string) {
    return this.communicationsService.delete(id);
  }

  @Get('institution/:institutionId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
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
