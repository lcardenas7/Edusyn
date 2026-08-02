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
import { OnboardingStateService } from './onboarding-state.service';
import { OnboardingStateController } from './onboarding-state.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { InstitutionConfigModule } from '../institution-config/institution-config.module';

@Module({
  imports: [
    PrismaModule,
    InstitutionConfigModule, // reusa getConfigCompleteness para el gate SIEE (AR3)
    MulterModule.register({
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max para consolidados grandes
    }),
  ],
  controllers: [UsersController, BulkUploadController, GradesBulkImportController, OnboardingStudentsController, OnboardingStateController],
  providers: [UsersService, BulkUploadService, GradesBulkImportService, StudentImportService, OnboardingStateService],
  exports: [UsersService, BulkUploadService, GradesBulkImportService, StudentImportService],
})
export class IamModule {}
