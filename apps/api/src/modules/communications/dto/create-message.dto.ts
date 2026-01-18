import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export enum MessageTypeDto {
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  CIRCULAR = 'CIRCULAR',
  NOTIFICATION = 'NOTIFICATION',
  REMINDER = 'REMINDER',
}

export enum RecipientTypeDto {
  USER = 'USER',
  GROUP = 'GROUP',
  GRADE = 'GRADE',
  ALL_STUDENTS = 'ALL_STUDENTS',
  ALL_TEACHERS = 'ALL_TEACHERS',
  ALL_PARENTS = 'ALL_PARENTS',
}

export class RecipientDto {
  @IsEnum(RecipientTypeDto)
  type: RecipientTypeDto;

  @IsOptional()
  @IsString()
  recipientId?: string;
}

export class CreateMessageDto {
  @IsString()
  institutionId: string;

  @IsEnum(MessageTypeDto)
  type: MessageTypeDto;

  @IsString()
  subject: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients: RecipientDto[];
}

export class UpdateMessageDto {
  @IsOptional()
  @IsEnum(MessageTypeDto)
  type?: MessageTypeDto;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
