import { IsNotEmpty, IsString } from 'class-validator';

export class GetSessionInfoDto {
  @IsString()
  @IsNotEmpty()
  user_id: string;
}
