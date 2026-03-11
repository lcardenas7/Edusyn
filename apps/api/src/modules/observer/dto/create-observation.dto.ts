import { IsString, IsEnum, IsOptional, IsDateString, IsBoolean, IsNumber } from 'class-validator';

export enum ObservationTypeDto {
  POSITIVE = 'POSITIVE',
  PEDAGOGICAL = 'PEDAGOGICAL',
  BEHAVIORAL_MILD = 'BEHAVIORAL_MILD',
  ACTA_TYPE_I = 'ACTA_TYPE_I',
  ACTA_TYPE_II = 'ACTA_TYPE_II',
  ACTA_TYPE_III = 'ACTA_TYPE_III',
  PARENT_CITATION = 'PARENT_CITATION',
  COMMITMENT = 'COMMITMENT',
  COUNSELING_FOLLOWUP = 'COUNSELING_FOLLOWUP',
  REFERRAL = 'REFERRAL',
  COMMITTEE_DECISION = 'COMMITTEE_DECISION',
  PEDAGOGICAL_FOLLOWUP = 'PEDAGOGICAL_FOLLOWUP',
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

  @IsOptional()
  @IsString()
  subcategory?: string;

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
  subcategory?: string;

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

  @IsOptional()
  @IsString()
  status?: string;
}

// DTO para Acta formal
export class CreateActaDto {
  @IsString()
  observationId: string;

  @IsOptional()
  @IsString()
  actaNumber?: string;

  @IsString()
  actaType: string; // TYPE_I, TYPE_II, TYPE_III

  @IsString()
  facts: string;

  @IsOptional()
  @IsString()
  regulationApplied?: string;

  @IsOptional()
  @IsString()
  witnesses?: string;

  @IsOptional()
  @IsString()
  studentStatement?: string;

  @IsOptional()
  @IsString()
  sanctions?: string;
}

// DTO para Compromiso
export class CreateCommitmentDto {
  @IsOptional()
  @IsString()
  observationId?: string;

  @IsString()
  studentEnrollmentId: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  responsibleRole?: string;
}

export class UpdateCommitmentDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  closureEvidence?: string;
}

// DTO para Citación a acudiente
export class CreateCitationDto {
  @IsOptional()
  @IsString()
  observationId?: string;

  @IsString()
  studentEnrollmentId: string;

  @IsString()
  reason: string;

  @IsDateString()
  scheduledDate: string;
}

export class UpdateCitationDto {
  @IsOptional()
  @IsBoolean()
  attended?: boolean;

  @IsOptional()
  @IsString()
  agreements?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// DTO para Remisión
export class CreateReferralDto {
  @IsOptional()
  @IsString()
  observationId?: string;

  @IsString()
  studentEnrollmentId: string;

  @IsString()
  referredToRole: string;

  @IsOptional()
  @IsString()
  referredToUserId?: string;

  @IsString()
  reason: string;
}

export class UpdateReferralDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  responseNotes?: string;
}

// DTO para Medida pedagógica
export class CreateMeasureDto {
  @IsString()
  observationId: string;

  @IsString()
  studentEnrollmentId: string;

  @IsString()
  measureType: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class UpdateMeasureDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  result?: string;
}
