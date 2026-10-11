/**
 * Redis Pub/Sub channel names used for inter-service communication.
 * Chat Service  →  ai.process   →  AI Service
 * AI Service    →  ai.response  →  Chat Service
 * AI Service    →  memory.save  →  Memory Service
 */
export const REDIS_CHANNELS = {
  AI_PROCESS:    'auramind:ai:process',
  AI_RESPONSE:   'auramind:ai:response',
  MEMORY_SAVE:   'auramind:memory:save',
  MEMORY_SEARCH: 'auramind:memory:search',
} as const;

export const REDIS_KEYS = {
  shortTerm: (userId: string) => `auramind:st:${userId}`,
} as const;
