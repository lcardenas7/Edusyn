import { IsOptional, IsString, IsInt, IsObject, Min, Max, MaxLength } from 'class-validator';

export class GenerateDesignDto {
  @IsString()
  @MaxLength(1000)
  prompt!: string;

  @IsOptional() @IsString()
  experienceType?: string;

  @IsOptional() @IsString()
  boardId?: string;

  @IsOptional() @IsString()
  gradeName?: string;

  @IsOptional() @IsString()
  subjectName?: string;

  @IsOptional() @IsInt() @Min(1) @Max(20)
  sessions?: number;
}

export class UpdateDesignDto {
  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString()
  summary?: string;

  @IsOptional() @IsString()
  experienceType?: string;

  @IsOptional() @IsObject()
  dna?: any;

  @IsOptional() @IsObject()
  content?: any;

  @IsOptional() @IsString()
  changeNote?: string;
}
