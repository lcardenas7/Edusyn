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
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaymentsService } from './payments.service';
import { PdfGeneratorService } from '../invoices/pdf-generator.service';
import { PaymentMethod } from '@prisma/client';

@Controller('finance/payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly pdfService: PdfGeneratorService,
  ) {}

  @Get()
  async findAll(
    @Request() req,
    @Query('thirdPartyId') thirdPartyId?: string,
    @Query('obligationId') obligationId?: string,
    @Query('paymentMethod') paymentMethod?: PaymentMethod,
  ) {
    return this.paymentsService.findAll(req.user.institutionId, {
      thirdPartyId,
      obligationId,
      paymentMethod,
    });
  }

  @Get('stats')
  async getCollectionStats(
    @Request() req,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.paymentsService.getCollectionStats(
      req.user.institutionId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
    );
  }

  @Get(':id')
  async findOne(@Request() req, @Param('id') id: string) {
    return this.paymentsService.findOne(id, req.user.institutionId);
  }

  @Post()
  async create(@Request() req, @Body() data: any) {
    return this.paymentsService.create(req.user.institutionId, req.user.id, data);
  }

  @Post('close-register')
  async closeCashRegister(@Request() req, @Body() data: any) {
    return this.paymentsService.closeCashRegister(req.user.institutionId, req.user.id, data);
  }

  @Put(':id/void')
  async void(@Request() req, @Param('id') id: string, @Body() data: { reason: string }) {
    return this.paymentsService.void(id, req.user.institutionId, req.user.id, data.reason);
  }

  @Get(':id/receipt')
  async downloadReceipt(@Request() req, @Param('id') id: string, @Res() res: Response) {
    const pdfBuffer = await this.pdfService.generateReceiptPdf(id, req.user.institutionId);
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="recibo-${id}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    
    res.end(pdfBuffer);
  }
}
