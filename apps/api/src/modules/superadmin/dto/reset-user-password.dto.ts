import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class ResetUserPasswordDto {
  @IsString()
  @MinLength(1)
  institutionId!: string;

  @IsOptional()
  @IsBoolean()
  reactivateAccount?: boolean;
}
