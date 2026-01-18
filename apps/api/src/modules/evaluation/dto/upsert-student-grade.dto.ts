import { IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UpsertStudentGradeDto {
  @IsUUID()
  studentEnrollmentId: string;

  @IsUUID()
  evaluativeActivityId: string;

  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  score: number;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class BulkUpsertGradesDto {
  @IsUUID()
  evaluativeActivityId: string;

  grades: { studentEnrollmentId: string; score: number; observations?: string }[];
}
