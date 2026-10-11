import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

const ARCHETYPES = [
  { id: 'friend',    name: 'Friend',    description: 'Warm, casual, fun — like your best friend.', emoji: '🤝' },
  { id: 'mentor',    name: 'Mentor',    description: 'Wise and thoughtful — helps you grow.', emoji: '🦉' },
  { id: 'coach',     name: 'Coach',     description: 'Energetic and goal-oriented.', emoji: '🏆' },
  { id: 'creator',   name: 'Creator',   description: 'Imaginative — your creative muse.', emoji: '🎨' },
  { id: 'assistant', name: 'Assistant', description: 'Efficient and organized.', emoji: '⚡' },
];

@Injectable()
export class CompanionService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      omit: { hashedPassword: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, data: {
    username?: string;
    personalityArchetype?: string;
    avatarConfig?: Record<string, unknown>;
    communicationStyle?: string;
  }) {
    if (data.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: data.username, NOT: { id: userId } },
      });
      if (existing) throw new ConflictException('Username already taken');
    }

    // Build update payload — cast avatarConfig to Prisma's InputJsonValue
    const updateData: Prisma.UserUpdateInput = {
      ...(data.username && { username: data.username }),
      ...(data.personalityArchetype && { personalityArchetype: data.personalityArchetype }),
      ...(data.communicationStyle && { communicationStyle: data.communicationStyle }),
      ...(data.avatarConfig !== undefined && {
        avatarConfig: data.avatarConfig as Prisma.InputJsonValue,
      }),
    };

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      omit: { hashedPassword: true },
    });
  }

  listArchetypes() {
    return { archetypes: ARCHETYPES };
  }
}
