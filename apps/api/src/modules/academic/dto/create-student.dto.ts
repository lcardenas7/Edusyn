import { IsString, IsOptional, IsDateString, IsEnum, IsInt, IsBoolean } from 'class-validator';

export class CreateStudentDto {
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

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  // Información médica
  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  eps?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  // Información socioeconómica
  @IsOptional()
  @IsInt()
  stratum?: number;

  @IsOptional()
  @IsString()
  sisbenLevel?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsBoolean()
  displacement?: boolean;

  @IsOptional()
  @IsString()
  disability?: string;

  @IsOptional()
  @IsString()
  disabilityType?: string;

  // Información adicional
  @IsOptional()
  @IsString()
  previousSchool?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class UpdateStudentDto {
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
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  birthPlace?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  neighborhood?: string;

  @IsOptional()
  @IsString()
  city?: string;

  // Información médica
  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  eps?: string;

  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsString()
  medicalConditions?: string;

  @IsOptional()
  @IsString()
  medications?: string;

  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  // Información socioeconómica
  @IsOptional()
  @IsInt()
  stratum?: number;

  @IsOptional()
  @IsString()
  sisbenLevel?: string;

  @IsOptional()
  @IsString()
  ethnicity?: string;

  @IsOptional()
  @IsBoolean()
  displacement?: boolean;

  @IsOptional()
  @IsString()
  disability?: string;

  @IsOptional()
  @IsString()
  disabilityType?: string;

  // Información adicional
  @IsOptional()
  @IsString()
  previousSchool?: string;

  @IsOptional()
  @IsString()
  photo?: string;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class EnrollStudentDto {
  @IsString()
  studentId: string;

  @IsString()
  academicYearId: string;

  @IsString()
  groupId: string;
}

export class UpdateEnrollmentStatusDto {
  @IsEnum(['ACTIVE', 'PROMOTED', 'REPEATED', 'WITHDRAWN', 'TRANSFERRED'])
  status: 'ACTIVE' | 'PROMOTED' | 'REPEATED' | 'WITHDRAWN' | 'TRANSFERRED';
}
