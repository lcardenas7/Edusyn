import { IsString, IsEnum, IsOptional, IsDateString, IsBoolean } from 'class-validator';

export enum ObservationTypeDto {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
  NEUTRAL = 'NEUTRAL',
  COMMITMENT = 'COMMITMENT',
}

export enum ObservationCategoryDto {
  ACADEMIC = 'ACADEMIC',
  BEHAVIORAL = 'BEHAVIORAL',
  ATTENDANCE = 'ATTENDANCE',
  UNIFORM = 'UNIFORM',
  OTHER = 'OTHER',
}

export class CreateObservationDto {
  @IsString()
  studentEnrollmentId: string;

  @IsDateString()
  date: string;

  @IsEnum(ObservationTypeDto)
  type: ObservationTypeDto;

  @IsEnum(ObservationCategoryDto)
  category: ObservationCategoryDto;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;
}

export class UpdateObservationDto {
  @IsOptional()
  @IsEnum(ObservationTypeDto)
  type?: ObservationTypeDto;

  @IsOptional()
  @IsEnum(ObservationCategoryDto)
  category?: ObservationCategoryDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  actionTaken?: string;

  @IsOptional()
  @IsBoolean()
  parentNotified?: boolean;

  @IsOptional()
  @IsDateString()
  parentNotifiedAt?: string;

  @IsOptional()
  @IsBoolean()
  requiresFollowUp?: boolean;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsString()
  followUpNotes?: string;
}
