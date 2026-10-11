import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AnalyticsService } from './analytics.service';
import type { AuthenticatedRequest } from './jwt.strategy';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Get('overview')
  overview(@Request() req: AuthenticatedRequest) {
    return this.analytics.overview(req.user.sub);
  }

  @Get('emotions/trend')
  emotionTrend(@Request() req: AuthenticatedRequest, @Query('days') days = 7) {
    return this.analytics.emotionTrend(req.user.sub, +days);
  }

  @Get('conversations/stats')
  conversationStats(@Request() req: AuthenticatedRequest) {
    return this.analytics.conversationStats(req.user.sub);
  }

  @Get('memories/stats')
  memoryStats(@Request() req: AuthenticatedRequest) {
    return this.analytics.memoryStats(req.user.sub);
  }
}
