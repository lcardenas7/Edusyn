import { IsString, IsOptional } from 'class-validator';

export class GenerateReportCardDto {
  @IsString()
  studentEnrollmentId: string;

  @IsString()
  academicTermId: string;

  @IsOptional()
  @IsString()
  format?: 'pdf' | 'json';
}

export class GenerateBulkReportCardsDto {
  @IsString()
  groupId: string;

  @IsString()
  academicTermId: string;

  @IsString()
  academicYearId: string;
}
