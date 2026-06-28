import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, IsDateString, IsArray, Min } from 'class-validator';
import { WorkspaceBoardType, WorkspaceItemStatus, WorkspaceScopeType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// BOARD DTOs
// ═══════════════════════════════════════════════════════════════════════════

export class CreateBoardDto {
  @IsEnum(WorkspaceBoardType)
  type: WorkspaceBoardType;

  @IsOptional() @IsEnum(WorkspaceScopeType)
  scopeType?: WorkspaceScopeType;

  @IsString()
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional() @IsString()
  academicYearId?: string;

  @IsOptional() @IsString()
  groupId?: string;

  @IsOptional() @IsString()
  gradeId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  groupIds?: string[];

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;
}

export class UpdateBoardDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional() @IsBoolean()
  isArchived?: boolean;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  // WORKSPACE_V2 — personalización y módulos
  @IsOptional() @IsString()
  emoji?: string;

  @IsOptional() @IsString()
  bannerColor?: string;

  @IsOptional() @IsString()
  coverImage?: string;

  @IsOptional() @IsBoolean()
  isPinned?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  enabledModules?: string[];
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

  @IsOptional() @IsDateString()
  eventDate?: string;
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

  @IsOptional() @IsDateString()
  eventDate?: string;

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
