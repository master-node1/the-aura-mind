"""
AI Service memory — Redis short-term + ChromaDB semantic only.
No Postgres — the memory-service NestJS handles DB persistence.
"""
import json
import logging
from typing import List

import redis.asyncio as aioredis

from config import settings

logger = logging.getLogger(__name__)
MAX_SHORT = 50
TTL = settings.short_term_memory_ttl


class MemoryService:
    def __init__(self, redis_url: str, vector_store):
        self._redis_url = redis_url
        self._redis: aioredis.Redis | None = None
        self.vector_store = vector_store

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
        return self._redis

    # ── Short-term (Redis) ────────────────────────────────────────────────
    async def save_short_term(self, user_id: str, message: dict) -> None:
        r = await self._get_redis()
        key = f"TheAuraLab:st:{user_id}"
        await r.rpush(key, json.dumps(message))
        await r.ltrim(key, -MAX_SHORT, -1)
        await r.expire(key, TTL)

    async def get_short_term(self, user_id: str) -> List[dict]:
        r = await self._get_redis()
        key = f"TheAuraLab:st:{user_id}"
        raw = await r.lrange(key, 0, -1)
        return [json.loads(item) for item in raw]

    # ── Semantic (ChromaDB) ───────────────────────────────────────────────
    async def retrieve_relevant(self, query: str, user_id: str, limit: int = 5) -> str:
        results = await self.vector_store.search_memories(query, user_id, limit)
        if not results:
            return ""
        return "\n".join(
            f"- [{r['metadata'].get('emotion_tag', 'neutral')}] {r['content']}"
            for r in results
        )

from services.vector_store import vector_store  # wherever your vector store is created

memory_service = MemoryService(
    redis_url=settings.redis_url,
    vector_store=vector_store,
)
