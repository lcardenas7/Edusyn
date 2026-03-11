import { Module } from '@nestjs/common';
import { StaffLeaveService } from './staff-leave.service';
import { StaffLeaveController } from './staff-leave.controller';

@Module({
  controllers: [StaffLeaveController],
  providers: [StaffLeaveService],
  exports: [StaffLeaveService],
})
export class StaffLeaveModule {}
