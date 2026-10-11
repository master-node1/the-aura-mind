"""
Memory Agent — extracts important facts from conversations and decides what to store.
"""
import json
import logging
import re
from typing import List, Optional

from services.llm_service import llm_service
from services.memory_service import memory_service

logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """
Analyze the following conversation message and extract any important facts, preferences,
events, or information about the user that should be remembered long-term.

Return a JSON array of memory items. Each item should have:
- "content": the fact to remember (concise, 1-2 sentences max)
- "importance": a score from 0.0 to 1.0
- "emotion_tag": the emotional context (joy/sadness/anger/fear/surprise/neutral/love/anxiety)

Only include genuinely important, personal facts. Skip small talk.
Return an empty array [] if nothing important is found.

Message: {message}
"""


class MemoryAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id

    async def extract_memories(self, user_message: str, ai_response: str) -> List[dict]:
        """
        Analyze the user message (and AI response context) to extract memorable facts.
        Returns a list of memory candidates.
        """
        combined = f"User: {user_message}\nAssistant: {ai_response}"
        try:
            raw = await llm_service.extract_info(
                text=combined,
                extraction_prompt=EXTRACTION_PROMPT.format(message="{message}").replace(
                    "Message: {message}", f"Conversation:\n{combined}"
                ),
            )
            json_match = re.search(r"\[.*\]", raw, re.DOTALL)
            if json_match:
                candidates = json.loads(json_match.group())
                # Filter by importance threshold
                return [c for c in candidates if c.get("importance", 0) >= 0.5]
        except Exception as e:
            logger.warning(f"Memory extraction failed: {e}")
        return []

    async def should_store(self, content: str, existing_memories: List[str]) -> bool:
        """
        Check if this memory is genuinely new (not a duplicate of existing memories).
        Simple string similarity check — could be enhanced with embeddings.
        """
        content_lower = content.lower()
        for mem in existing_memories:
            # Check for high overlap
            words = set(content_lower.split())
            mem_words = set(mem.lower().split())
            if len(words) > 0 and len(words & mem_words) / len(words) > 0.8:
                return False
        return True

    def generate_summary(self, content: str) -> str:
        """Generate a short summary for a memory (synchronous heuristic version)."""
        if len(content) <= 80:
            return content
        return content[:77] + "..."
