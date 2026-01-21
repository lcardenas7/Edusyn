import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  name: string;

  @IsString()
  @MinLength(3)
  slug: string;

  @IsOptional()
  @IsString()
  daneCode?: string;

  @IsOptional()
  @IsString()
  nit?: string;
}
