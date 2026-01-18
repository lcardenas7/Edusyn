import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class CreateEvaluativeActivityDto {
  @IsString()
  teacherAssignmentId: string;

  @IsString()
  academicTermId: string;

  @IsString()
  evaluationPlanId: string;

  @IsString()
  componentId: string;

  @IsString()
  name: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
}
