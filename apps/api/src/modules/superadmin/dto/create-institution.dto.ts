import { IsString, IsOptional, IsEmail, IsArray, IsEnum, IsBoolean, MinLength } from 'class-validator';

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
  TIMETABLE = 'TIMETABLE',
  DIAGNOSIS = 'DIAGNOSIS',
  TEACHER_WORKSPACE = 'TEACHER_WORKSPACE',
  VIRTUAL_CLASSROOM = 'VIRTUAL_CLASSROOM',
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

  // ── Rector (figura académica) — separado del administrador de plataforma ──
  // Si rectorSameAsAdmin = true (u omitido), el administrador también recibe el rol RECTOR
  // (misma persona, mismas credenciales). Si es false, se crean los datos del rector aparte.
  @IsOptional()
  @IsBoolean()
  rectorSameAsAdmin?: boolean;

  @IsOptional()
  @IsString()
  rectorFirstName?: string;

  @IsOptional()
  @IsString()
  rectorLastName?: string;

  @IsOptional()
  @IsEmail()
  rectorEmail?: string;

  @IsOptional()
  @IsString()
  rectorPhone?: string;

  // Si el rector tendrá acceso (login) propio a la plataforma.
  // false (u omitido) = solo figura institucional (firmas/boletines), sin inicio de sesión.
  @IsOptional()
  @IsBoolean()
  rectorHasLogin?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(3)
  rectorUsername?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  rectorPassword?: string;
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
