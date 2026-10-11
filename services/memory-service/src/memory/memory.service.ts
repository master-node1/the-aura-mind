import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { ConfigService } from '@nestjs/config';

const MAX_SHORT_TERM = 50;
const SHORT_TERM_TTL = 3600;

@Injectable()
export class MemoryService {
  constructor(
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
  ) {}

  // ── Short-term (Redis) ────────────────────────────────────────────────────
  async saveShortTerm(userId: string, message: { role: string; content: string }) {
    const key = `TheAuraLab:st:${userId}`;
    await this.redis.rpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, -MAX_SHORT_TERM, -1);
    await this.redis.expire(key, SHORT_TERM_TTL);
  }

  async getShortTerm(userId: string): Promise<{ role: string; content: string }[]> {
    const key = `TheAuraLab:st:${userId}`;
    const raw = await this.redis.lrange(key, 0, -1);
    return raw.map((item) => JSON.parse(item));
  }

  async clearShortTerm(userId: string) {
    await this.redis.del(`TheAuraLab:st:${userId}`);
  }

  // ── Long-term (Postgres) ──────────────────────────────────────────────────
  async create(userId: string, dto: CreateMemoryDto) {
    return this.prisma.memory.create({
      data: {
        userId,
        content: dto.content,
        summary: dto.summary,
        memoryType: dto.memoryType ?? 'long',
        emotionTag: dto.emotionTag ?? 'neutral',
        importanceScore: dto.importanceScore ?? 0.5,
        conversationId: dto.conversationId,
      },
    });
  }

  async findAll(userId: string, skip = 0, limit = 50, memoryType?: string) {
    return this.prisma.memory.findMany({
      where: { userId, ...(memoryType ? { memoryType } : {}) },
      orderBy: [{ importanceScore: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    });
  }

  async findOne(id: string, userId: string) {
    return this.prisma.memory.findFirst({ where: { id, userId } });
  }

  async update(id: string, userId: string, data: Partial<CreateMemoryDto>) {
    return this.prisma.memory.update({ where: { id }, data });
  }

  async remove(id: string, userId: string): Promise<boolean> {
    const memory = await this.prisma.memory.findFirst({ where: { id, userId } });
    if (!memory) return false;
    await this.prisma.memory.delete({ where: { id } });
    return true;
  }

  async exportAll(userId: string) {
    return this.prisma.memory.findMany({ where: { userId } });
  }
}
