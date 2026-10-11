import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string, skip = 0, limit = 20) {
    return this.prisma.conversation.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true, title: true, messageCount: true, createdAt: true, updatedAt: true,
      },
    });
  }

  create(userId: string, title?: string) {
    return this.prisma.conversation.create({ data: { userId, title } });
  }

  async findOne(id: string, userId: string) {
    const convo = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!convo) throw new NotFoundException('Conversation not found');
    return convo;
  }

  async remove(id: string, userId: string) {
    const convo = await this.prisma.conversation.findFirst({ where: { id, userId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    await this.prisma.conversation.delete({ where: { id } });
  }

  async getMessages(conversationId: string, userId: string, skip = 0, limit = 100) {
    const convo = await this.prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (!convo) throw new NotFoundException('Conversation not found');
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
    });
  }
}
