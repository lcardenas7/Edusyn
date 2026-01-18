import { IsOptional, IsString } from 'class-validator';

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
}
