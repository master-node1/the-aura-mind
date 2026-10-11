export type MemoryType = 'short' | 'long' | 'semantic';

export interface Memory {
  id: string;
  userId: string;
  memoryType: MemoryType;
  content: string;
  summary?: string;
  emotionTag: string;
  importanceScore: number;
  embeddingId?: string;
  conversationId?: string;
  createdAt: string;
  accessedAt?: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  metadata: Record<string, string>;
  distance: number;
}
