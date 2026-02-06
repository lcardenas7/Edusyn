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
import { CategoriesService } from './categories.service';
import { FinancialMovementType } from '@prisma/client';

@Controller('finance/categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(@Request() req, @Query('type') type?: FinancialMovementType) {
    return this.categoriesService.findAll(req.user.institutionId, type);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.categoriesService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.categoriesService.create(req.user.institutionId, data);
  }

  @Post('seed-defaults')
  async seedDefaults(@Request() req) {
    return this.categoriesService.seedDefaults(req.user.institutionId);
  }

  @Put(':id')
  async update(@Request() req, @Param('id') id: string, @Body() data: any) {
    return this.categoriesService.update(id, req.user.institutionId, data);
  }

  @Delete(':id')
  async delete(@Request() req, @Param('id') id: string) {
    return this.categoriesService.delete(id, req.user.institutionId);
  }
}
