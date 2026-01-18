import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export enum AcademicTermType {
  PERIOD = 'PERIOD',
  SEMESTER_EXAM = 'SEMESTER_EXAM',
}

export class CreateAcademicTermDto {
  @IsUUID()
  academicYearId: string;

  @IsString()
  name: string;

  @IsEnum(AcademicTermType)
  type: AcademicTermType;

  @IsInt()
  @Min(1)
  order: number;

  @IsInt()
  @Min(0)
  @Max(100)
  weightPercentage: number;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}
