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

export class AddSubjectToAreaDto {
  @IsString()
  name: string;

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
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  academicLevel?: string;  // PREESCOLAR, PRIMARIA, SECUNDARIA, MEDIA

  @IsOptional()
  @IsString()
  gradeId?: string;  // ID del grado específico (opcional)
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

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
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsString()
  academicLevel?: string;

  @IsOptional()
  @IsString()
  gradeId?: string;
}
