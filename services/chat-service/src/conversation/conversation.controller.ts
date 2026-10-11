import {
  Controller, Get, Post, Delete, Body, Param,
  Query, UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConversationService } from './conversation.service';
import type { AuthenticatedRequest } from './jwt.strategy';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class ConversationController {
  constructor(private conv: ConversationService) {}

  @Get('conversations')
  list(@Request() req: AuthenticatedRequest, @Query('skip') skip = 0, @Query('limit') limit = 20) {
    return this.conv.findAll(req.user.sub, +skip, +limit);
  }

  @Post('conversations')
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthenticatedRequest, @Body('title') title?: string) {
    return this.conv.create(req.user.sub, title);
  }

  @Get('conversations/:id')
  getOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conv.findOne(id, req.user.sub);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    return this.conv.remove(id, req.user.sub);
  }

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @Query('skip') skip = 0,
    @Query('limit') limit = 100,
  ) {
    return this.conv.getMessages(id, req.user.sub, +skip, +limit);
  }
}
