import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator';

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
}
