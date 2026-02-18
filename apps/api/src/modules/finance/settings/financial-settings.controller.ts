import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FinancialSettingsService } from './financial-settings.service';
import { SupabaseStorageService } from '../../storage/supabase-storage.service';

@Controller('finance/settings')
@UseGuards(JwtAuthGuard)
export class FinancialSettingsController {
  constructor(
    private readonly settingsService: FinancialSettingsService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  @Get()
  async get(@Request() req) {
    const settings = await this.settingsService.get(req.user.institutionId);
    // Resolve invoiceLogoUrl to a fresh signed URL if it's an R2 key or expired URL
    if (settings?.invoiceLogoUrl) {
      try {
        settings.invoiceLogoUrl = await this.storageService.resolveFileUrl(settings.invoiceLogoUrl, 3600);
      } catch { /* keep original value */ }
    }
    return settings;
  }

  @Put()
  async update(@Request() req, @Body() data: any) {
    return this.settingsService.update(req.user.institutionId, data);
  }
}
