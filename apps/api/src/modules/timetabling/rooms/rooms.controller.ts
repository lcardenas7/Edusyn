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
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RoomsService } from './rooms.service';
import { RoomRestrictionType } from '@prisma/client';

@Controller('timetabling/rooms')
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  async findAll(@Request() req, @Query('campusId') campusId?: string) {
    return this.roomsService.findAll(req.user.institutionId, campusId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.roomsService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: {
    campusId?: string;
    name: string;
    code?: string;
    capacity?: number;
    description?: string;
    equipment?: string[];
    isReservable?: boolean;
  }) {
    return this.roomsService.create(req.user.institutionId, data);
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() data: {
    campusId?: string;
    name?: string;
    code?: string;
    capacity?: number;
    description?: string;
    equipment?: string[];
    isReservable?: boolean;
    isActive?: boolean;
  }) {
    return this.roomsService.update(id, req.user.institutionId, data);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.roomsService.delete(id, req.user.institutionId);
  }

  @Post(':id/restrictions')
  async addRestriction(@Request() req, @Param('id') id: string, @Body() data: {
    subjectId?: string;
    type?: RoomRestrictionType;
  }) {
    return this.roomsService.addRestriction(id, req.user.institutionId, data);
  }

  @Delete('restrictions/:restrictionId')
  async removeRestriction(@Request() req, @Param('restrictionId') restrictionId: string) {
    return this.roomsService.removeRestriction(restrictionId, req.user.institutionId);
  }
}
