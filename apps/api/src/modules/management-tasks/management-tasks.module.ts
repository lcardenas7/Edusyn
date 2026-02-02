import { Module } from '@nestjs/common';
import { ManagementTasksController } from './management-tasks.controller';
import { ManagementTasksService } from './management-tasks.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ManagementTasksController],
  providers: [ManagementTasksService],
  exports: [ManagementTasksService],
})
export class ManagementTasksModule {}
