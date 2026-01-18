import { IsString, IsNumber, IsOptional } from 'class-validator';

export class GenerateReportDto {
  @IsString()
  institutionId: string;

  @IsString()
  academicYearId: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

export class PromotionReportDto {
  @IsString()
  institutionId: string;

  @IsString()
  academicYearId: string;
}
