import { IsOptional, IsString } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  daneCode?: string;

  @IsOptional()
  @IsString()
  nit?: string;
}
