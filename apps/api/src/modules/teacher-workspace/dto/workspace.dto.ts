import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsDateString, Min } from 'class-validator';
import { WorkspaceBoardType, WorkspaceItemStatus } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// BOARD DTOs
// ═══════════════════════════════════════════════════════════════════════════

export class CreateBoardDto {
  @IsEnum(WorkspaceBoardType)
  type: WorkspaceBoardType;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  academicYearId?: string;

  @IsOptional() @IsString()
  groupId?: string;
}

export class UpdateBoardDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsBoolean()
  isArchived?: boolean;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLUMN DTOs
// ═══════════════════════════════════════════════════════════════════════════

export class CreateColumnDto {
  @IsString()
  boardId: string;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  color?: string;
}

export class UpdateColumnDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM DTOs
// ═══════════════════════════════════════════════════════════════════════════

export class CreateItemDto {
  @IsString()
  boardId: string;

  @IsOptional() @IsString()
  columnId?: string;

  @IsOptional() @IsString()
  studentId?: string;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional() @IsDateString()
  dueDate?: string;
}

export class UpdateItemDto {
  @IsOptional() @IsString()
  columnId?: string;

  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional() @IsEnum(WorkspaceItemStatus)
  status?: WorkspaceItemStatus;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isArchived?: boolean;
}

export class MoveItemDto {
  @IsString()
  columnId: string;

  @IsInt() @Min(0)
  sortOrder: number;
}
