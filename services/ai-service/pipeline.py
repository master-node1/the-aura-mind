"""
Agent pipeline — ported from the original orchestrator.py.
Receives a dict payload from Redis, returns a response dict.
"""
import uuid
import logging
from typing import Optional

from config import settings
from agents.conversation_agent import ConversationAgent
from agents.memory_agent import MemoryAgent
from agents.emotion_agent import EmotionAgent
from agents.wellness_agent import WellnessAgent
from agents.research_agent import ResearchAgent
from agents.creative_agent import CreativeAgent
from services.memory_service import MemoryService
from services.vector_store import VectorStoreService

logger = logging.getLogger(__name__)

_vector_store = VectorStoreService()
_memory_service = MemoryService(redis_url=settings.redis_url, vector_store=_vector_store)


async def run_pipeline(payload: dict) -> dict:
    """
    Full agent pipeline.
    payload keys: userId, messageId, content, conversationId, username, personality
    """
    user_id: str = payload["userId"]
    message: str = payload["content"]
    conversation_id: Optional[str] = payload.get("conversationId")
    personality: str = payload.get("personality", "friend")
    username: str = payload.get("username", "friend")

    memory_updates: list[str] = []
    suggestions: list[str] = []

    conversation_agent = ConversationAgent(user_id)
    memory_agent = MemoryAgent(user_id)
    emotion_agent = EmotionAgent(user_id)
    wellness_agent = WellnessAgent(user_id)
    research_agent = ResearchAgent(user_id)
    creative_agent = CreativeAgent(user_id)

    try:
        # 1. Load short-term history from Redis
        history = await _memory_service.get_short_term(user_id)

        # 2. Detect emotion
        emotion_data = await emotion_agent.analyze(message)
        emotion = emotion_data["emotion"]
        avatar_expression = emotion_data["avatar_expression"]

        # 3. Retrieve relevant memories (semantic search via ChromaDB)
        memories_text = await _memory_service.retrieve_relevant(
            query=message, user_id=user_id, limit=5,
        )

        # 4. Empathy hint
        empathy_hint = emotion_agent.get_empathy_hint(emotion)
        enhanced_memories = (
            f"{memories_text}\n\nEmpathy note: {empathy_hint}" if empathy_hint else memories_text
        )

        # 5. Wellness suggestions
        if wellness_agent.should_activate(message, emotion):
            suggestions.extend(wellness_agent.get_suggestions(emotion)[:2])

        # 6. Specialized agents
        special_content: Optional[str] = None
        if creative_agent.should_activate(message):
            special_content = await creative_agent.create(message)
        elif research_agent.should_activate(message):
            special_content = await research_agent.research(message)

        # 7. Generate response
        ai_response = await conversation_agent.respond(
            user_message=message,
            personality=personality,
            username=username,
            history=history,
            memories=enhanced_memories,
        )
        if special_content:
            ai_response = special_content

        # 8. Update short-term memory
        await _memory_service.save_short_term(user_id, {"role": "user", "content": message})
        await _memory_service.save_short_term(user_id, {"role": "assistant", "content": ai_response})

        # 9. Extract and persist long-term memories (via ChromaDB only — no DB access)
        new_memories = await memory_agent.extract_memories(message, ai_response)
        for mem in new_memories:
            if mem.get("importance", 0) >= settings.memory_importance_threshold:
                await _vector_store.add_memory(
                    embedding_id=str(uuid.uuid4()),
                    text=mem["content"],
                    metadata={
                        "user_id": user_id,
                        "emotion_tag": mem.get("emotion_tag", emotion),
                        "importance_score": str(mem.get("importance", 0.5)),
                        "conversation_id": conversation_id or "",
                    },
                )
                memory_updates.append(mem["content"])

        return {
            "userId": user_id,
            "messageId": str(uuid.uuid4()),
            "content": ai_response,
            "emotion": emotion,
            "avatarExpression": avatar_expression,
            "memoryUpdates": memory_updates,
            "suggestions": suggestions,
            "conversationId": conversation_id,
        }

    except Exception as e:
        logger.error(f"Pipeline error for user {user_id}: {e}", exc_info=True)
        return {
            "userId": user_id,
            "messageId": str(uuid.uuid4()),
            "content": "I'm having a moment — could you say that again? 🌸",
            "emotion": "neutral",
            "avatarExpression": "idle",
            "memoryUpdates": [],
            "suggestions": [],
            "conversationId": conversation_id,
        }
