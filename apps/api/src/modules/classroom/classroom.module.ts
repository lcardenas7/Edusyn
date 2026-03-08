import { Module } from '@nestjs/common';
import { ClassroomController } from './classroom.controller';
import { ClassroomService } from './classroom.service';
import { ClassroomCronService } from './classroom.cron';
import { AttitudinalService } from './attitudinal.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClassroomController],
  providers: [ClassroomService, ClassroomCronService, AttitudinalService],
  exports: [ClassroomService, AttitudinalService],
})
export class ClassroomModule {}
