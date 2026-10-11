import type { EmotionType, AvatarExpression } from './chat';

export interface AIProcessRequest {
  userId: string;
  messageId: string;
  content: string;
  conversationId?: string;
  personality: string;
  username: string;
}

export interface AIProcessResponse {
  messageId: string;
  content: string;
  emotion: EmotionType;
  avatarExpression: AvatarExpression;
  memoryUpdates: string[];
  suggestions: string[];
}

export interface EmotionResult {
  emotion: EmotionType;
  confidence: number;
  avatarExpression: AvatarExpression;
  color: string;
  emoji: string;
}
