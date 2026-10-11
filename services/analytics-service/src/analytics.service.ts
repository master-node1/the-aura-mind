import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async overview(userId: string) {
    const [totalMemories, totalConversations, user] = await Promise.all([
      this.prisma.memory.count({ where: { userId } }),
      this.prisma.conversation.count({ where: { userId } }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);
    const totalMessages = await this.prisma.message.count({
      where: { conversation: { userId } },
    });
    const daysActive = user
      ? Math.max(1, Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000))
      : 1;
    return {
      totalMemories, totalConversations, totalMessages, daysActive,
      personalityArchetype: user?.personalityArchetype ?? 'friend',
    };
  }

  async emotionTrend(userId: string, days = 7) {
    const since = new Date(Date.now() - days * 86400000);
    const memories = await this.prisma.memory.findMany({
      where: { userId, createdAt: { gte: since } },
    });

    const emotionCounts: Record<string, number> = {};
    const trend: Record<string, Record<string, number>> = {};

    for (const m of memories) {
      emotionCounts[m.emotionTag] = (emotionCounts[m.emotionTag] ?? 0) + 1;
      const dateKey = m.createdAt.toISOString().slice(0, 10);
      trend[dateKey] = trend[dateKey] ?? {};
      trend[dateKey][m.emotionTag] = (trend[dateKey][m.emotionTag] ?? 0) + 1;
    }

    const dominantEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';
    const trendList = Object.entries(trend).sort().map(([date, emotions]) => ({ date, ...emotions }));

    return { periodDays: days, emotionCounts, trend: trendList, dominantEmotion };
  }

  async conversationStats(userId: string) {
    const conversations = await this.prisma.conversation.findMany({ where: { userId } });
    const avgMessages = conversations.length
      ? conversations.reduce((s, c) => s + c.messageCount, 0) / conversations.length
      : 0;

    const dayCount: Record<string, number> = {};
    for (const c of conversations) {
      const day = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date(c.createdAt).getDay()];
      dayCount[day] = (dayCount[day] ?? 0) + 1;
    }
    const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'N/A';

    return {
      totalConversations: conversations.length,
      averageMessagesPerConversation: Math.round(avgMessages * 10) / 10,
      mostActiveDay,
      archived: conversations.filter((c) => c.isArchived).length,
    };
  }

  async memoryStats(userId: string) {
    const memories = await this.prisma.memory.findMany({ where: { userId } });
    const byType: Record<string, number> = {};
    const byEmotion: Record<string, number> = {};
    let totalImportance = 0;

    for (const m of memories) {
      byType[m.memoryType] = (byType[m.memoryType] ?? 0) + 1;
      byEmotion[m.emotionTag] = (byEmotion[m.emotionTag] ?? 0) + 1;
      totalImportance += m.importanceScore;
    }

    const topMemories = [...memories]
      .sort((a, b) => b.importanceScore - a.importanceScore)
      .slice(0, 5)
      .map((m) => ({ content: m.content.slice(0, 100), importance: m.importanceScore }));

    return {
      total: memories.length,
      byType, byEmotion,
      averageImportance: memories.length ? Math.round((totalImportance / memories.length) * 100) / 100 : 0,
      topMemories,
    };
  }
}
