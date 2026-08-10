import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum AcademicTermType {
  PERIOD = 'PERIOD',
  SEMESTER_EXAM = 'SEMESTER_EXAM',
}

export class CreateAcademicTermDto {
  @IsString()
  academicYearId: string;

  @IsString()
  name: string;

  @IsEnum(AcademicTermType)
  type: AcademicTermType;

  @IsInt()
  @Min(1)
  order: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  weightPercentage: number;

  @IsOptional()
  startDate?: Date;

  @IsOptional()
  endDate?: Date;
}
