import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { BulkUploadService } from './bulk-upload.service';
import { BulkUploadController } from './bulk-upload.controller';
import { GradesBulkImportService } from './grades-bulk-import.service';
import { GradesBulkImportController } from './grades-bulk-import.controller';
import { StudentImportService } from './student-import.service';
import { OnboardingStudentsController } from './onboarding-students.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max para consolidados grandes
    }),
  ],
  controllers: [UsersController, BulkUploadController, GradesBulkImportController, OnboardingStudentsController],
  providers: [UsersService, BulkUploadService, GradesBulkImportService, StudentImportService],
  exports: [UsersService, BulkUploadService, GradesBulkImportService, StudentImportService],
})
export class IamModule {}
