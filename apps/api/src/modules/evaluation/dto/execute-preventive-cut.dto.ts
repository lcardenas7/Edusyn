import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ExecutePreventiveCutDto {
  @IsString()
  @IsNotEmpty()
  teacherAssignmentId: string;

  @IsString()
  @IsNotEmpty()
  academicTermId: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  cutoffDate?: Date;
}
