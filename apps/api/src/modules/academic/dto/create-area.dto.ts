import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum AreaCalculationType {
  SINGLE_SUBJECT = 'SINGLE_SUBJECT',
  AVERAGE = 'AVERAGE',
  WEIGHTED_AVERAGE = 'WEIGHTED_AVERAGE',
  CUSTOM_FORMULA = 'CUSTOM_FORMULA',
}

export class CreateAreaDto {
  @IsString()
  institutionId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsEnum(AreaCalculationType)
  calculationType?: AreaCalculationType;

  @IsOptional()
  @IsString()
  customFormula?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateAreaDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsEnum(AreaCalculationType)
  calculationType?: AreaCalculationType;

  @IsOptional()
  @IsString()
  customFormula?: string;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class AddSubjectToAreaDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateSubjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  weeklyHours?: number;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsNumber()
  order?: number;
}
