import { IsString, IsEnum, IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum AttendanceStatusDto {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LATE = 'LATE',
  EXCUSED = 'EXCUSED',
}

export class SingleAttendanceDto {
  @IsString()
  studentEnrollmentId: string;

  @IsEnum(AttendanceStatusDto)
  status: AttendanceStatusDto;

  @IsOptional()
  @IsString()
  observations?: string;
}

export class RecordAttendanceDto {
  @IsString()
  teacherAssignmentId: string;

  @IsDateString()
  date: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleAttendanceDto)
  records: SingleAttendanceDto[];
}

export class UpdateAttendanceDto {
  @IsEnum(AttendanceStatusDto)
  status: AttendanceStatusDto;

  @IsOptional()
  @IsString()
  observations?: string;
}
