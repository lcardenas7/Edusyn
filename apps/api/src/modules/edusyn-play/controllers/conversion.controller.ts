import { Body, Controller, Get, Header, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ConversionService } from '../services/conversion.service';
import type { ConvertGradesDto } from '../services/conversion.service';

/** Endpoints de conversión a nota + descarga de planilla. */
@Controller('live-session')
@UseGuards(JwtAuthGuard)
export class ConversionController {
  constructor(private readonly service: ConversionService) {}

  /** Calcula la planilla (preview, no guarda). */
  @Post(':id/compute-grades')
  async compute(@Request() req: any, @Param('id') id: string, @Body() dto: ConvertGradesDto) {
    return this.service.computeGrades(id, req.user.id, dto || {});
  }

  /** Guarda la conversión y devuelve la planilla calculada. */
  @Post(':id/convert-grades')
  async convert(@Request() req: any, @Param('id') id: string, @Body() dto: ConvertGradesDto) {
    return this.service.saveConversion(id, req.user.id, dto || {});
  }

  /** Descarga CSV. */
  @Get(':id/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const csv = await this.service.exportCsv(id, req.user.id);
    res.setHeader('Content-Disposition', `attachment; filename="edusyn-play-${id}.csv"`);
    res.send(csv);
  }
}
