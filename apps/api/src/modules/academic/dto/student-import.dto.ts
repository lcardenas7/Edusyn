import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Estado de validación de un grupo durante la importación
 */
export enum GroupValidationStatus {
  EXISTS = 'EXISTS',                    // El grupo existe, asignar automáticamente
  SECTION_NOT_FOUND = 'SECTION_NOT_FOUND', // El grado existe pero la sección no
  GRADE_NOT_FOUND = 'GRADE_NOT_FOUND',  // El grado no existe en la institución
  INVALID = 'INVALID',                  // Formato inválido
}

/**
 * Acción a tomar con un grupo pendiente de confirmación
 */
export enum GroupResolutionAction {
  ASSIGN_EXISTING = 'ASSIGN_EXISTING',  // Asignar a grupo existente
  CREATE_NEW = 'CREATE_NEW',            // Crear nuevo grupo
  MANUAL_CORRECTION = 'MANUAL_CORRECTION', // Corrección manual
  SKIP = 'SKIP',                        // Omitir este estudiante
}

/**
 * Datos de un estudiante en el archivo de importación
 */
export class ImportStudentRowDto {
  @IsOptional()
  @IsNumber()
  rowNumber?: number;

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
  @IsString()
  birthDate?: string;

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

  // Campo grupo combinado (11A, 11-01, Undécimo A, etc.)
  @IsOptional()
  @IsString()
  grupo?: string;

  // Campos separados de grado y sección (tienen prioridad sobre grupo)
  @IsOptional()
  @IsString()
  grado?: string;

  @IsOptional()
  @IsString()
  seccion?: string;

  // Información médica
  @IsOptional()
  @IsString()
  bloodType?: string;

  @IsOptional()
  @IsString()
  eps?: string;

  // Datos del acudiente
  @IsOptional()
  @IsString()
  guardianName?: string;

  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @IsOptional()
  @IsString()
  guardianEmail?: string;

  @IsOptional()
  @IsString()
  guardianDocumentNumber?: string;

  @IsOptional()
  @IsString()
  guardianRelationship?: string;
}

/**
 * Resultado de validación de un grupo
 */
export class GroupValidationResultDto {
  @IsString()
  originalInput: string;

  @IsNumber()
  grade: number;

  @IsString()
  section: string;

  @IsString()
  displayName: string;

  @IsEnum(GroupValidationStatus)
  status: GroupValidationStatus;

  @IsOptional()
  @IsString()
  existingGroupId?: string;

  @IsOptional()
  @IsString()
  existingGroupName?: string;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsArray()
  affectedRows?: number[];
}

/**
 * Resultado de pre-validación de importación
 */
export class ImportPrevalidationResultDto {
  @IsBoolean()
  canProceed: boolean;

  @IsNumber()
  totalRows: number;

  @IsNumber()
  validRows: number;

  @IsNumber()
  errorRows: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupValidationResultDto)
  groupsToConfirm: GroupValidationResultDto[];

  @IsArray()
  errors: { row: number; field: string; message: string }[];

  @IsArray()
  warnings: { row: number; field: string; message: string }[];

  // Estudiantes ya existentes que se actualizarán
  @IsArray()
  existingStudents: { row: number; documentNumber: string; name: string }[];
}

/**
 * Resolución de grupo pendiente
 */
export class GroupResolutionDto {
  @IsString()
  groupKey: string; // grade|section

  @IsEnum(GroupResolutionAction)
  action: GroupResolutionAction;

  @IsOptional()
  @IsString()
  existingGroupId?: string; // Si action = ASSIGN_EXISTING

  @IsOptional()
  @IsString()
  newGroupName?: string; // Si action = CREATE_NEW

  @IsOptional()
  @IsNumber()
  correctedGrade?: number; // Si action = MANUAL_CORRECTION

  @IsOptional()
  @IsString()
  correctedSection?: string; // Si action = MANUAL_CORRECTION
}

/**
 * DTO para iniciar pre-validación de importación
 */
export class StartImportPrevalidationDto {
  @IsString()
  institutionId: string;

  @IsString()
  academicYearId: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStudentRowDto)
  students: ImportStudentRowDto[];
}

/**
 * DTO para confirmar importación con resoluciones de grupos
 */
export class ConfirmImportDto {
  @IsString()
  institutionId: string;

  @IsString()
  academicYearId: string;

  @IsOptional()
  @IsString()
  campusId?: string;

  @IsOptional()
  @IsString()
  shiftId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportStudentRowDto)
  students: ImportStudentRowDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupResolutionDto)
  groupResolutions: GroupResolutionDto[];
}

/**
 * Resultado final de importación
 */
export class ImportResultDto {
  @IsBoolean()
  success: boolean;

  @IsNumber()
  created: number;

  @IsNumber()
  updated: number;

  @IsNumber()
  skipped: number;

  @IsArray()
  errors: { row: number; error: string }[];

  @IsArray()
  groupsCreated: { grade: number; section: string; groupId: string }[];
}
