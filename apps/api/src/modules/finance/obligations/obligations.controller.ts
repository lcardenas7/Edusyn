import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ObligationsService } from './obligations.service';
import { ObligationStatus } from '@prisma/client';

@Controller('finance/obligations')
@UseGuards(JwtAuthGuard)
export class ObligationsController {
  constructor(private readonly obligationsService: ObligationsService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('thirdPartyId') thirdPartyId?: string,
    @Query('conceptId') conceptId?: string,
    @Query('status') status?: ObligationStatus,
  ) {
    return this.obligationsService.findAll(req.user.institutionId, {
      thirdPartyId,
      conceptId,
      status,
    });
  }

  @Get('stats')
  async getPortfolioStats(@Request() req) {
    return this.obligationsService.getPortfolioStats(req.user.institutionId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.obligationsService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.obligationsService.create(req.user.institutionId, req.user.id, data);
  }

  @Post('massive')
  async createMassive(@Request() req, @Body() data: any) {
    return this.obligationsService.createMassive(req.user.institutionId, req.user.id, data);
  }

  @Put(':id/discount')
  async applyDiscount(@Request() req, @Param('id') id: string, @Body() data: any) {
    return this.obligationsService.applyDiscount(id, req.user.institutionId, {
      ...data,
      approvedBy: req.user.id,
    });
  }

  @Put(':id/cancel')
  async cancel(@Request() req, @Param('id') id: string, @Body() data: { reason: string }) {
    return this.obligationsService.cancel(id, req.user.institutionId, data.reason);
  }
}
