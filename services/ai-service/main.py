"""
AI Service — Redis consumer worker + optional HTTP health endpoint.
Subscribes to TheAuraLab:ai:process, runs the agent pipeline,
publishes response to TheAuraLab:ai:response.
"""
import asyncio
import json
import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from config import settings
from pipeline import run_pipeline
from services.vector_store import vector_store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

AI_PROCESS_CHANNEL = "TheAuraLab:ai:process"
AI_RESPONSE_CHANNEL = "TheAuraLab:ai:response"
HEALTH_CHECK_TIMEOUT_SECONDS = 2.0

_health_redis = aioredis.from_url(settings.redis_url, decode_responses=True)


async def redis_worker():
    """Subscribe to AI_PROCESS and publish responses to AI_RESPONSE."""
    pub = aioredis.from_url(settings.redis_url, decode_responses=True)
    sub = aioredis.from_url(settings.redis_url, decode_responses=True)

    pubsub = sub.pubsub()
    await pubsub.subscribe(AI_PROCESS_CHANNEL)
    logger.info(f"AI service subscribed to {AI_PROCESS_CHANNEL}")

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        try:
            payload = json.loads(message["data"])
            logger.info(f"Processing message for user={payload.get('userId')}")

            result = await run_pipeline(payload)

            await pub.publish(AI_RESPONSE_CHANNEL, json.dumps(result))
            logger.info(f"Published response for user={payload.get('userId')}")
        except Exception as e:
            logger.error(f"Pipeline error: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(redis_worker())
    logger.info("AI service ready")
    yield
    task.cancel()


app = FastAPI(title="TheAuraLab AI Service", lifespan=lifespan)


async def _probe(name: str, check) -> str:
    try:
        await asyncio.wait_for(check(), HEALTH_CHECK_TIMEOUT_SECONDS)
        return "up"
    except Exception as e:
        logger.warning(f"Health check {name!r} failed: {e!r}")
        return "down"


@app.get("/health")
async def health():
    """Unauthenticated health check that verifies Redis and ChromaDB connectivity."""
    checks = {
        "redis": await _probe("redis", _health_redis.ping),
        # The Chroma client is synchronous, so run its heartbeat off the event loop.
        "chromadb": await _probe("chromadb", lambda: asyncio.to_thread(vector_store.client.heartbeat)),
    }
    healthy = all(status == "up" for status in checks.values())
    body = {"status": "ok" if healthy else "error", "service": "ai-service", "checks": checks}
    return body if healthy else JSONResponse(status_code=503, content=body)
