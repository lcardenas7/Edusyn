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
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { PdfGeneratorService } from './pdf-generator.service';

@Controller('finance/invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly pdfService: PdfGeneratorService,
  ) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('thirdPartyId') thirdPartyId?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
  ) {
    return this.invoicesService.findAll(req.user.institutionId, { thirdPartyId, status, type });
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.invoicesService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.invoicesService.create(req.user.institutionId, req.user.id, data);
  }

  @Put(':id/issue')
  async issue(@Request() req, @Param('id') id: string) {
    return this.invoicesService.issue(id, req.user.institutionId);
  }

  @Put(':id/cancel')
  async cancel(@Request() req, @Param('id') id: string, @Body() data: { reason: string }) {
    return this.invoicesService.cancel(id, req.user.institutionId, req.user.id, data.reason);
  }

  @Get(':id/pdf')
  async downloadPdf(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generateInvoicePdf(id, req.user.institutionId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="factura-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    
    res.end(pdfBuffer);
  }
}
