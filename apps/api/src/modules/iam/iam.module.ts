import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadController } from './bulk-upload.controller';
import { GradesBulkImportService } from './grades-bulk-import.service';
import { GradesBulkImportController } from './grades-bulk-import.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max para consolidados grandes
    }),
  ],
  controllers: [UsersController, BulkUploadController, GradesBulkImportController],
  providers: [UsersService, BulkUploadService, GradesBulkImportService],
  exports: [UsersService, BulkUploadService, GradesBulkImportService],
})
export class IamModule {}
