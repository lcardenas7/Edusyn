import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator';

export enum PreventiveAlertStatusDto {
  OPEN = 'OPEN',
  IN_RECOVERY = 'IN_RECOVERY',
  RESOLVED = 'RESOLVED',
}

export class UpdatePreventiveAlertDto {
  @IsOptional()
  @IsEnum(PreventiveAlertStatusDto)
  status?: PreventiveAlertStatusDto;

  @IsOptional()
  @IsString()
  recoveryPlan?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  meetingAt?: Date;

  @IsOptional()
  @IsString()
  notes?: string;
}
