"""
Conversation Agent — main LLM chat with personality-aware system prompts and memory injection.
"""
import logging
import uuid
from typing import List, Optional, AsyncIterator

from services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ConversationAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id

    async def respond(
        self,
        user_message: str,
        personality: str,
        username: str,
        history: List[dict],
        memories: str = "",
    ) -> str:
        """Generate a non-streaming response."""
        response = await llm_service.complete(
            personality=personality,
            username=username,
            user_message=user_message,
            history=history,
            memories=memories,
        )
        return response

    async def stream_respond(
        self,
        user_message: str,
        personality: str,
        username: str,
        history: List[dict],
        memories: str = "",
    ) -> AsyncIterator[str]:
        """Yield streaming response tokens."""
        async for token in llm_service.stream(
            personality=personality,
            username=username,
            user_message=user_message,
            history=history,
            memories=memories,
        ):
            yield token

    def format_history(self, raw_history: List[dict]) -> List[dict]:
        """Ensure history has the expected {role, content} shape."""
        formatted = []
        for msg in raw_history:
            if isinstance(msg, dict) and "role" in msg and "content" in msg:
                formatted.append({"role": msg["role"], "content": msg["content"]})
        return formatted
