import { IsIn, IsString } from 'class-validator';

const SHIFT_TYPES = ['MORNING', 'AFTERNOON', 'SINGLE', 'NIGHT'] as const;

export class CreateShiftDto {
  @IsString()
  campusId: string;

  @IsIn(SHIFT_TYPES)
  type: (typeof SHIFT_TYPES)[number];

  @IsString()
  name: string;
}
