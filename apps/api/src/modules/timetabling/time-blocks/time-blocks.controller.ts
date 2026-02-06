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
import { TimeBlocksService } from './time-blocks.service';
import { TimeBlockType } from '@prisma/client';

@Controller('timetabling/time-blocks')
@UseGuards(JwtAuthGuard)
export class TimeBlocksController {
  constructor(private readonly timeBlocksService: TimeBlocksService) {}

  @Get()
  async findAll(@Request() req, @Query('shiftId') shiftId?: string) {
    return this.timeBlocksService.findAll(req.user.institutionId, shiftId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.timeBlocksService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: {
    shiftId: string;
    type?: TimeBlockType;
    startTime: string;
    endTime: string;
    order: number;
    label?: string;
  }) {
    return this.timeBlocksService.create(req.user.institutionId, data);
  }

  @Post('bulk')
  async bulkCreate(@Request() req, @Body() data: {
    shiftId: string;
    blocks: Array<{
      type?: TimeBlockType;
      startTime: string;
      endTime: string;
      order: number;
      label?: string;
    }>;
  }) {
    return this.timeBlocksService.bulkCreate(
      req.user.institutionId,
      data.shiftId,
      data.blocks,
    );
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() data: {
    type?: TimeBlockType;
    startTime?: string;
    endTime?: string;
    order?: number;
    label?: string;
  }) {
    return this.timeBlocksService.update(id, req.user.institutionId, data);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.timeBlocksService.delete(id, req.user.institutionId);
  }
}
