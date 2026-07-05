import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

const PERFORMANCE_LEVELS = ['SUPERIOR', 'ALTO', 'BASICO', 'BAJO'] as const;

export class UpsertPerformanceScaleDto {
  @IsString()
  institutionId: string;

  @IsIn(PERFORMANCE_LEVELS)
  level: (typeof PERFORMANCE_LEVELS)[number];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minScore: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxScore: number;

  // Q-1: enriquecimiento opcional de la escala (si se omiten, aplican defaults del enum)
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  descriptor?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsBoolean()
  isApproved?: boolean;
}
