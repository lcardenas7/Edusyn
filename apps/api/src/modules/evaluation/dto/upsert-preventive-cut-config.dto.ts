import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsUUID, Max, Min } from 'class-validator';

export class UpsertPreventiveCutConfigDto {
  @IsUUID()
  academicTermId: string;

  @Type(() => Date)
  @IsDate()
  cutoffDate: Date;

  @IsNumber()
  @Min(1.0)
  @Max(5.0)
  riskThresholdScore: number;
}
