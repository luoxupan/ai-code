import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class PostMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  wsClientId?: string;
}
