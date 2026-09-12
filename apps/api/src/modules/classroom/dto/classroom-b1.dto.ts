import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTOs de las 17 rutas blindadas de Classroom (Bloque 1).
 *
 * El controlador anterior usaba tipos inline en @Body() (sin validación): con el
 * ValidationPipe global (whitelist + forbidNonWhitelisted) cualquier campo forjado
 * en el body —institutionId, teacherId, studentId, role— ahora responde 400.
 * El conjunto de campos aceptados reproduce EXACTAMENTE los tipos inline previos;
 * las únicas adiciones son shuffleQuestions/showResults/maxAttempts/
 * timeLimitMinutes en las actividades, que el DTO del servicio ya aceptaba y el
 * frontend ya enviaba (antes pasaban en silencio por la falta de whitelist).
 */
export class CreateClassroomDto {
  @IsString()
  teacherAssignmentId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateActivityDto {
  @IsOptional()
  @IsString()
  sectionId?: string | null;

  @IsOptional()
  @IsString()
  academicTermId?: string | null;

  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  openDate?: string | null;

  @IsOptional()
  @IsBoolean()
  allowLateSubmit?: boolean;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  showResults?: boolean;

  @IsOptional()
  @IsNumber()
  maxAttempts?: number;

  @IsOptional()
  @IsNumber()
  timeLimitMinutes?: number;

  @IsOptional()
  @IsString()
  rubricId?: string;

  @IsOptional()
  @IsString()
  gameType?: string;

  @IsOptional()
  @IsBoolean()
  audioResponse?: boolean;
}

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  maxScore?: number;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  openDate?: string | null;

  @IsOptional()
  @IsBoolean()
  allowLateSubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @IsOptional()
  @IsString()
  attachmentName?: string;

  // Aceptados para preservar el comportamiento real (el tipo inline anterior no
  // validaba y el DTO del servicio de creación ya los contemplaba). El servicio de
  // actualización no los aplica, igual que antes: se toleran, no se editan aquí.
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @IsOptional()
  @IsBoolean()
  showResults?: boolean;

  @IsOptional()
  @IsNumber()
  maxAttempts?: number;

  @IsOptional()
  @IsNumber()
  timeLimitMinutes?: number;
}

export class PublishActivityDto {
  @IsOptional()
  @IsString()
  scheduledPublishAt?: string;
}

export class ActivityDependencyInputDto {
  @IsString()
  prerequisiteId: string;

  // No se usa IsIn a propósito: el comportamiento previo NORMALIZABA condiciones
  // desconocidas a SUBMITTED en lugar de rechazarlas; se conserva en el servicio.
  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsNumber()
  minScore?: number | null;
}

export class SetActivityDependenciesDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDependencyInputDto)
  prerequisites?: ActivityDependencyInputDto[];
}

export class AssignStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentEnrollmentIds: string[];

  @IsBoolean()
  isRestrictedToAssigned: boolean;
}
