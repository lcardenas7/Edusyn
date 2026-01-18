import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class ExecutePreventiveCutDto {
  @IsUUID()
  teacherAssignmentId: string;

  @IsUUID()
  academicTermId: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  cutoffDate?: Date;
}
