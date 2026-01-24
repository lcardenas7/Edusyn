import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { AreaCalculationType } from '@prisma/client'

export { AreaCalculationType }

export class CreateAreaDto {
  @IsString()
  institutionId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsEnum(AreaCalculationType)
  calculationType?: AreaCalculationType;

  @IsOptional()
  @IsString()
  customFormula?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  academicLevel?: string;  // PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA

  @IsOptional()
  @IsString()
  gradeId?: string;  // ID del grado específico (opcional)
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsEnum(AreaCalculationType)
  calculationType?: AreaCalculationType;

  @IsOptional()
  @IsString()
  customFormula?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  academicLevel?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}

// DTO para crear asignatura (catálogo único)
export class AddSubjectToAreaDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

// DTO para actualizar asignatura (solo nombre y orden)
export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

// DTO para crear configuración de asignatura por nivel/grado
export class CreateSubjectLevelConfigDto {
  @IsString()
  subjectId: string;

  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;  // Porcentaje (0-1)

  @IsOptional()
  @IsBoolean()
  isDominant?: boolean;

  @IsOptional()
  @IsString()
  academicLevel?: string;  // PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA (null = global)

  @IsOptional()
  @IsString()
  gradeId?: string;  // ID del grado específico (null = todo el nivel)
}

// DTO para actualizar configuración de asignatura por nivel/grado
export class UpdateSubjectLevelConfigDto {
  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isDominant?: boolean;
}

// DTO combinado para crear asignatura + configuración en un solo paso
export class AddSubjectWithConfigDto {
  @IsString()
  name: string;  // Nombre de la asignatura (se busca existente o se crea nueva)

  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsBoolean()
  isDominant?: boolean;

  @IsOptional()
  @IsString()
  academicLevel?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}
