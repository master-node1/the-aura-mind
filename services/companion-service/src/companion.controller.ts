import { Controller, Get, Patch, Body, UseGuards, Request, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsOptional, IsString, IsIn, IsObject } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { CompanionService } from './companion.service';
import type { AuthenticatedRequest } from './jwt.strategy';

class UpdateProfileDto {
  @IsOptional() @IsString() username?: string;
  @IsOptional() @IsIn(['friend', 'mentor', 'coach', 'creator', 'assistant']) personalityArchetype?: string;
  @IsOptional() @IsObject() avatarConfig?: Record<string, unknown>;
  @IsOptional() @IsIn(['casual', 'formal', 'playful', 'empathetic']) communicationStyle?: string;
}

@Controller()
@UseGuards(AuthGuard('jwt'))
export class CompanionController {
  private memoryServiceUrl: string;

  constructor(private companion: CompanionService, config: ConfigService) {
    this.memoryServiceUrl = config.get<string>('MEMORY_SERVICE_URL', 'http://memory-service:3000');
  }

  @Get('profile')
  getProfile(@Request() req: AuthenticatedRequest) {
    return this.companion.getProfile(req.user.sub);
  }

  @Patch('profile')
  updateProfile(@Request() req: AuthenticatedRequest, @Body() dto: UpdateProfileDto) {
    return this.companion.updateProfile(req.user.sub, dto);
  }

  @Get('archetypes')
  listArchetypes() {
    return this.companion.listArchetypes();
  }

  @Post('reset-memory')
  @HttpCode(HttpStatus.OK)
  async resetMemory(@Request() req: AuthenticatedRequest) {
    // Delegate to memory-service via HTTP
    await fetch(`${this.memoryServiceUrl}/api/memory/short-term`, {
      method: 'DELETE',
      headers: { Authorization: req.headers.authorization ?? '' },
    });
    return { message: 'Short-term memory cleared' };
  }
}
