/**
 * Redis Pub/Sub channel names used for inter-service communication.
 * Chat Service  →  ai.process   →  AI Service
 * AI Service    →  ai.response  →  Chat Service
 * AI Service    →  memory.save  →  Memory Service
 */
export const REDIS_CHANNELS = {
  AI_PROCESS:    'TheAuraLab:ai:process',
  AI_RESPONSE:   'TheAuraLab:ai:response',
  MEMORY_SAVE:   'TheAuraLab:memory:save',
  MEMORY_SEARCH: 'TheAuraLab:memory:search',
} as const;

export const REDIS_KEYS = {
  shortTerm: (userId: string) => `TheAuraLab:st:${userId}`,
} as const;
