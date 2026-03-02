import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  campusId: string;

  @IsString()
  shiftId: string;

  @IsString()
  gradeId: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxCapacity?: number;
}
