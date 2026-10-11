export type MessageRole = 'user' | 'assistant' | 'system';
export type EmotionType = 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'neutral' | 'love' | 'anxiety';
export type AvatarExpression = 'happy' | 'sad' | 'surprised' | 'upset' | 'worried' | 'idle';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  emotion?: EmotionType;
  emotionConfidence?: number;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  messageCount: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

// WebSocket message shapes
export interface WSIncoming {
  type: 'message' | 'voice' | 'ping' | 'ack' | 'typing' | 'error';
  messageId?: string;
  content?: string;
  conversationId?: string;
  isTyping?: boolean;
  emotion?: EmotionType;
  avatarExpression?: AvatarExpression;
  memoryUpdates?: string[];
  suggestions?: string[];
  detail?: string;
}

export interface WSOutgoing {
  type: 'message' | 'ping';
  messageId: string;
  content: string;
  conversationId?: string;
}
