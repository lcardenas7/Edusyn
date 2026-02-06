import { IsString, IsOptional, IsEmail, IsArray, IsEnum, MinLength } from 'class-validator';

// Enum local - debe coincidir con el de Prisma después de la migración
export enum SystemModule {
  ACADEMIC = 'ACADEMIC',
  ENROLLMENTS = 'ENROLLMENTS',
  ATTENDANCE = 'ATTENDANCE',
  EVALUATION = 'EVALUATION',
  RECOVERY = 'RECOVERY',
  REPORTS = 'REPORTS',
  COMMUNICATIONS = 'COMMUNICATIONS',
  OBSERVER = 'OBSERVER',
  PERFORMANCE = 'PERFORMANCE',
  MEN_REPORTS = 'MEN_REPORTS',
  DASHBOARD = 'DASHBOARD',
  USERS = 'USERS',
  CONFIG = 'CONFIG',
  ELECTIONS = 'ELECTIONS',
  PAYMENTS = 'PAYMENTS',
  FINANCE = 'FINANCE',
}

export class CreateInstitutionDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @MinLength(3)
  slug: string;

  @IsOptional()
  @IsString()
  daneCode?: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsArray()
  @IsEnum(SystemModule, { each: true })
  modules: SystemModule[];

  // Datos del admin/rector inicial
  @IsString()
  adminFirstName: string;

  @IsString()
  adminLastName: string;

  @IsEmail()
  adminEmail: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  adminUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  adminPassword?: string;

  @IsOptional()
  @IsString()
  adminPhone?: string;
}

export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  daneCode?: string;

  @IsOptional()
  @IsString()
  nit?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  website?: string;
}

export class UpdateInstitutionModulesDto {
  @IsArray()
  @IsEnum(SystemModule, { each: true })
  modules: SystemModule[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];  // Funcionalidades específicas habilitadas
}
