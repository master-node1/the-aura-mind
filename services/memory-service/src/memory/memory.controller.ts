import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Request, HttpCode, HttpStatus, NotFoundException, Res,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { Response } from 'express';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import type { AuthenticatedRequest } from './jwt.strategy';

@ApiTags('memory')
@ApiBearerAuth()
@Controller()
@UseGuards(AuthGuard('jwt'))
export class MemoryController {
  constructor(private mem: MemoryService) {}

  @Get()
  @ApiOperation({ summary: 'List all memories for current user' })
  @ApiQuery({ name: 'skip', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'memory_type', required: false, enum: ['short', 'long', 'semantic'] })
  list(
    @Request() req: AuthenticatedRequest,
    @Query('skip') skip = 0,
    @Query('limit') limit = 50,
    @Query('memory_type') memoryType?: string,
  ) {
    return this.mem.findAll(req.user.sub, +skip, +limit, memoryType);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new long-term memory' })
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateMemoryDto) {
    return this.mem.create(req.user.sub, dto);
  }

  @Get('export/json')
  @ApiOperation({ summary: 'Export all memories as JSON file' })
  async exportJson(@Request() req: AuthenticatedRequest, @Res() res: Response) {
    const memories = await this.mem.exportAll(req.user.sub);
    const data = memories.map((m) => ({
      id: m.id, type: m.memoryType, content: m.content,
      emotion: m.emotionTag, importance: m.importanceScore,
      createdAt: m.createdAt,
    }));
    res.setHeader('Content-Disposition', 'attachment; filename=TheAuraLab-memories.json');
    res.json({ memories: data, count: data.length });
  }

  @Post('short-term')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Append a message to Redis short-term memory' })
  saveShortTerm(@Request() req: AuthenticatedRequest, @Body() body: { role: string; content: string }) {
    return this.mem.saveShortTerm(req.user.sub, body);
  }

  @Get('short-term')
  @ApiOperation({ summary: 'Get all short-term (Redis) messages for current user' })
  getShortTerm(@Request() req: AuthenticatedRequest) {
    return this.mem.getShortTerm(req.user.sub);
  }

  @Delete('short-term')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear short-term (Redis) memory for current user' })
  clearShortTerm(@Request() req: AuthenticatedRequest) {
    return this.mem.clearShortTerm(req.user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single memory by ID' })
  @ApiParam({ name: 'id', description: 'Memory UUID' })
  async getOne(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const memory = await this.mem.findOne(id, req.user.sub);
    if (!memory) throw new NotFoundException('Memory not found');
    return memory;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a memory' })
  @ApiParam({ name: 'id', description: 'Memory UUID' })
  async update(@Param('id') id: string, @Request() req: AuthenticatedRequest, @Body() dto: Partial<CreateMemoryDto>) {
    const memory = await this.mem.findOne(id, req.user.sub);
    if (!memory) throw new NotFoundException('Memory not found');
    return this.mem.update(id, req.user.sub, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a memory' })
  @ApiParam({ name: 'id', description: 'Memory UUID' })
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const deleted = await this.mem.remove(id, req.user.sub);
    if (!deleted) throw new NotFoundException('Memory not found');
  }
}
