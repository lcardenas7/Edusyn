import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const GRADE_STAGES = [
  'PREESCOLAR',
  'BASICA_PRIMARIA',
  'BASICA_SECUNDARIA',
  'MEDIA',
] as const;

export class CreateGradeDto {
  @IsIn(GRADE_STAGES)
  stage: (typeof GRADE_STAGES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  number?: number;

  @IsString()
  name: string;
}
