import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceAuditService } from './attendance-audit.service';
import { TutoringAttendanceController } from './tutoring-attendance.controller';
import { TutoringAttendanceService } from './tutoring-attendance.service';

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceController, TutoringAttendanceController],
  providers: [AttendanceService, AttendanceAuditService, TutoringAttendanceService],
  exports: [AttendanceService, TutoringAttendanceService],
})
export class AttendanceModule {}
