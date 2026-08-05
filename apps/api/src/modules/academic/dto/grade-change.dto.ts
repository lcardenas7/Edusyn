import { IsString, IsEnum, IsOptional, IsNotEmpty } from 'class-validator';
import { EnrollmentMovementType } from '@prisma/client';

export enum GradeChangeType {
  SAME_GRADE = 'SAME_GRADE',        // Cambio de grupo mismo grado
  PROMOTION = 'PROMOTION',          // Promoción anticipada
  DEMOTION = 'DEMOTION',            // Rebaja (solo casos especiales)
}

export class ChangeGradeDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsString()
  @IsNotEmpty()
  newGroupId: string;

  @IsEnum(GradeChangeType)
  gradeChangeType: GradeChangeType;

  @IsEnum(EnrollmentMovementType)
  movementType: EnrollmentMovementType;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsString()
  @IsOptional()
  observations?: string;

  @IsString()
  @IsOptional()
  academicActId?: string; // Acta que respalda el cambio (requerido para promociones/demociones)

  // Se asigna en el servidor desde el usuario autenticado (el cliente NO lo envía).
  @IsString()
  @IsOptional()
  performedById?: string;
}

export class ValidateGradeChangeDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId: string;

  @IsString()
  @IsNotEmpty()
  newGroupId: string;
}
