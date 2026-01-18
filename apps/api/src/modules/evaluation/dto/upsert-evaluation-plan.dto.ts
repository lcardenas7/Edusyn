import { IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PlanComponentDto {
  @IsString()
  componentId: string;

  @IsInt()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class UpsertEvaluationPlanDto {
  @IsString()
  teacherAssignmentId: string;

  @IsString()
  academicTermId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanComponentDto)
  components: PlanComponentDto[];
}
