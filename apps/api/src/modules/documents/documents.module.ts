import { Module } from '@nestjs/common';
import { InstitutionalDocumentsController } from './institutional-documents.controller';
import { InstitutionalDocumentsService } from './institutional-documents.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [InstitutionalDocumentsController],
  providers: [InstitutionalDocumentsService],
  exports: [InstitutionalDocumentsService],
})
export class DocumentsModule {}
