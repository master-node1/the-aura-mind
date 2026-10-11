import { Controller, Post, Get, Body, Query, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import type { AuthenticatedRequest } from './jwt.strategy';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Email or username already taken' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive JWT tokens' })
  @ApiResponse({ status: 200, description: 'Returns access_token and refresh_token' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Email not verified (only when REQUIRE_EMAIL_VERIFICATION=true)' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify an email address with the token from the verification email' })
  @ApiResponse({ status: 200, description: 'Email verified' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a new verification email (same response whether or not the account exists)' })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto.email);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  refresh(@Query('refresh_token') token: string) {
    return this.auth.refresh(token);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMe(@Request() req: AuthenticatedRequest) {
    return this.auth.getMe(req.user.sub);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiOperation({ summary: 'Logout (client discards tokens)' })
  logout() {
    return { message: 'Logged out successfully' };
  }
}
