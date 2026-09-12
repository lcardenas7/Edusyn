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
