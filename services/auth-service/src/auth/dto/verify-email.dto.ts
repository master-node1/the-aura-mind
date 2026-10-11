import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @Length(64, 64)
  token!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
