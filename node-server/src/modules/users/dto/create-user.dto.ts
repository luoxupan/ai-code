import { IsNotEmpty, IsString, IsEmail, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  name_en: string;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
