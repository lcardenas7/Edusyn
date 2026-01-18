import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTeacherAssignmentDto {
  @IsString()
  academicYearId: string;

  @IsString()
  groupId: string;

  @IsString()
  subjectId: string;

  @IsString()
  teacherId: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyHours?: number;
}
