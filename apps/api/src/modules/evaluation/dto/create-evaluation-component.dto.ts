import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateEvaluationComponentDto {
  @IsUUID()
  institutionId: string;

  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;
}
