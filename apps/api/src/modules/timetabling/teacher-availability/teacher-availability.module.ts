import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { TeacherAvailabilityService } from './teacher-availability.service';
import { TeacherAvailabilityController } from './teacher-availability.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherAvailabilityController],
  providers: [TeacherAvailabilityService],
  exports: [TeacherAvailabilityService],
})
export class TeacherAvailabilityModule {}
