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
import { ExpensesService } from './expenses.service';

@Controller('finance/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('categoryId') categoryId?: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.expensesService.findAll(req.user.institutionId, { categoryId, providerId });
  }

  @Get('stats')
  async getExpenseStats(@Request() req) {
    return this.expensesService.getExpenseStats(req.user.institutionId);
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.expensesService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.expensesService.create(req.user.institutionId, req.user.id, data);
  }

  @Put(':id/approve')
  async approve(@Request() req, @Param('id') id: string) {
    return this.expensesService.approve(id, req.user.institutionId, req.user.id);
  }

  @Put(':id/void')
  async void(@Request() req, @Param('id') id: string, @Body() data: { reason: string }) {
    return this.expensesService.void(id, req.user.institutionId, req.user.id, data.reason);
  }
}
