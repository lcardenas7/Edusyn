import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  areaId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  weeklyHours?: number;
}
