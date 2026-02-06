import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { PdfGeneratorService } from './pdf-generator.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, PdfGeneratorService],
  exports: [InvoicesService, PdfGeneratorService],
})
export class InvoicesModule {}
