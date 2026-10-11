import { IsEmail, IsString, MinLength, MaxLength, IsIn, IsOptional, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Username must be alphanumeric (underscores and hyphens allowed)' })
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['friend', 'mentor', 'coach', 'creator', 'assistant'])
  personalityArchetype?: string = 'friend';
}
