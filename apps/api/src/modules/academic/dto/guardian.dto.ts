import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';

export enum GuardianRelationship {
  FATHER = 'FATHER',
  MOTHER = 'MOTHER',
  STEPFATHER = 'STEPFATHER',
  STEPMOTHER = 'STEPMOTHER',
  GRANDFATHER = 'GRANDFATHER',
  GRANDMOTHER = 'GRANDMOTHER',
  UNCLE = 'UNCLE',
  AUNT = 'AUNT',
  SIBLING = 'SIBLING',
  LEGAL_GUARDIAN = 'LEGAL_GUARDIAN',
  OTHER = 'OTHER',
}

export class CreateGuardianDto {
  @IsString()
  institutionId: string;

  @IsString()
  documentType: string;

  @IsString()
  documentNumber: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  secondName?: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  secondLastName?: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  workplace?: string;

  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  workAddress?: string;
}

export class UpdateGuardianDto {
  @IsOptional()
  @IsString()
  documentType?: string;

  @IsOptional()
  @IsString()
  documentNumber?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  secondName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  secondLastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  alternatePhone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  workplace?: string;

  @IsOptional()
  @IsString()
  workPhone?: string;

  @IsOptional()
  @IsString()
  workAddress?: string;
}

export class LinkGuardianToStudentDto {
  @IsString()
  studentId: string;

  @IsString()
  guardianId: string;

  @IsEnum(GuardianRelationship)
  relationship: GuardianRelationship;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canPickUp?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;

  @IsOptional()
  @IsBoolean()
  receivesNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  receivesGrades?: boolean;
}

export class CreateGuardianWithLinkDto extends CreateGuardianDto {
  @IsString()
  studentId: string;

  @IsEnum(GuardianRelationship)
  relationship: GuardianRelationship;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  canPickUp?: boolean;

  @IsOptional()
  @IsBoolean()
  isEmergencyContact?: boolean;
}
