import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomCronService } from './classroom.cron';
import { AttitudinalService } from './attitudinal.service';
import { LessonService } from './lesson.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ApdModule } from '../apd/apd.module';

@Module({
  imports: [PrismaModule, ApdModule],
  controllers: [ClassroomController],
  providers: [ClassroomService, ClassroomCronService, AttitudinalService, LessonService],
  exports: [ClassroomService, AttitudinalService, LessonService],
})
export class ClassroomModule {}
