import { IsNotEmpty, IsString } from 'class-validator';

export class SendMailDto {
  @IsString()
  @IsNotEmpty()
  recipients!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;
}
