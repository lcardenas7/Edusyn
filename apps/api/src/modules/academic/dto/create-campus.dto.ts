import { IsOptional, IsString } from 'class-validator';

export class CreateCampusDto {
  @IsString()
  institutionId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  address?: string;
}
