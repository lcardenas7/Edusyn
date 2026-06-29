import { Module } from '@nestjs/common';
import { TeacherWorkspaceController } from './teacher-workspace.controller';
import { TeacherWorkspaceService } from './teacher-workspace.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [TeacherWorkspaceController],
  providers: [TeacherWorkspaceService],
})
export class TeacherWorkspaceModule {}
