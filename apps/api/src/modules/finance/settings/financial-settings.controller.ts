import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FinancialSettingsService } from './financial-settings.service';

@Controller('finance/settings')
@UseGuards(JwtAuthGuard)
export class FinancialSettingsController {
  constructor(private readonly settingsService: FinancialSettingsService) {}

  @Get()
  async get(@Request() req) {
    return this.settingsService.get(req.user.institutionId);
  }

  @Put()
  async update(@Request() req, @Body() data: any) {
    return this.settingsService.update(req.user.institutionId, data);
  }
}
