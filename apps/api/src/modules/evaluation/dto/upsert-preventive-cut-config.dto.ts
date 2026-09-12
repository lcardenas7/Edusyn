import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class UpsertPreventiveCutConfigDto {
  @IsString()
  @IsNotEmpty()
  academicTermId: string;

  @Type(() => Date)
  @IsDate()
  cutoffDate: Date;

  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  riskThresholdScore: number;
}
