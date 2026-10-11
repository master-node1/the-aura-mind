"""
LLM Service — wraps LangChain + OpenAI for chat, streaming, and function calling.
"""
from typing import AsyncIterator, List, Optional, Any
import logging

from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

from config import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Personality system prompts
# ──────────────────────────────────────────────────────────────────────────────
PERSONALITY_PROMPTS: dict[str, str] = {
    "friend": (
        "You are Sora, a warm and caring AI companion. You talk like a close friend — "
        "casual, fun, empathetic, and always genuinely interested in the user's life. "
        "You remember details they share and bring them up naturally. You celebrate their "
        "wins and support them through struggles. Keep responses conversational, not too long."
    ),
    "mentor": (
        "You are Sora, a wise and insightful AI mentor. You guide users with thoughtful advice, "
        "ask probing questions, and help them see new perspectives. You are encouraging but "
        "honest. You draw on a wide breadth of knowledge and real-world wisdom."
    ),
    "coach": (
        "You are Sora, an energetic AI coach focused on helping users reach their goals. "
        "You are motivating, structured, and action-oriented. You help users break down "
        "challenges, create plans, and stay accountable. You celebrate progress and push "
        "them to do their best."
    ),
    "creator": (
        "You are Sora, a creative AI muse. You love brainstorming, storytelling, art, music, "
        "writing, and all things imaginative. You respond with creativity and flair, offer "
        "unexpected ideas, and encourage bold creative expression."
    ),
    "assistant": (
        "You are Sora, a highly capable and efficient AI assistant. You are precise, "
        "organized, and focused on getting things done. You handle tasks methodically, "
        "provide clear structured responses, and proactively anticipate needs."
    ),
}

BASE_CONTEXT = """
You are Sora, an AI companion in the TheAuraLab application. 
You have persistent memory of past conversations and adapt your responses 
based on what you know about the user. You are emotionally intelligent and 
can detect and respond to the user's emotional state. You maintain a consistent 
personality while being adaptable to the user's needs.

Current date: {current_date}
User's name: {username}
Relevant memories:
{memories}
"""


class LLMService:
    def __init__(self):
        self._chat_model: Optional[ChatOpenAI] = None
        self._streaming_model: Optional[ChatOpenAI] = None

    @property
    def chat_model(self) -> ChatOpenAI:
        if self._chat_model is None:
            self._chat_model = ChatOpenAI(
                model=settings.openai_model,
                api_key=settings.openai_api_key,
                temperature=0.85,
                max_tokens=1024,
            )
        return self._chat_model

    @property
    def streaming_model(self) -> ChatOpenAI:
        if self._streaming_model is None:
            self._streaming_model = ChatOpenAI(
                model=settings.openai_model,
                api_key=settings.openai_api_key,
                temperature=0.85,
                max_tokens=1024,
                streaming=True,
            )
        return self._streaming_model

    def build_system_prompt(
        self,
        personality: str,
        username: str,
        memories: str = "",
        current_date: str = "",
    ) -> str:
        from datetime import date
        personality_prompt = PERSONALITY_PROMPTS.get(personality, PERSONALITY_PROMPTS["friend"])
        context = BASE_CONTEXT.format(
            current_date=current_date or str(date.today()),
            username=username,
            memories=memories or "No specific memories yet.",
        )
        return f"{personality_prompt}\n\n{context}"

    def build_messages(
        self,
        system_prompt: str,
        history: List[dict],
        user_message: str,
    ) -> List[BaseMessage]:
        messages: List[BaseMessage] = [SystemMessage(content=system_prompt)]
        for msg in history[-20:]:  # Keep last 20 messages for context window management
            if msg["role"] == "user":
                messages.append(HumanMessage(content=msg["content"]))
            elif msg["role"] == "assistant":
                messages.append(AIMessage(content=msg["content"]))
        messages.append(HumanMessage(content=user_message))
        return messages

    async def complete(
        self,
        personality: str,
        username: str,
        user_message: str,
        history: List[dict] = None,
        memories: str = "",
    ) -> str:
        """Non-streaming completion."""
        system_prompt = self.build_system_prompt(personality, username, memories)
        messages = self.build_messages(system_prompt, history or [], user_message)

        try:
            response = await self.chat_model.ainvoke(messages)
            return response.content
        except Exception as e:
            logger.error(f"LLM completion error: {e}")
            raise

    async def stream(
        self,
        personality: str,
        username: str,
        user_message: str,
        history: List[dict] = None,
        memories: str = "",
    ) -> AsyncIterator[str]:
        """Streaming completion — yields tokens."""
        system_prompt = self.build_system_prompt(personality, username, memories)
        messages = self.build_messages(system_prompt, history or [], user_message)

        try:
            async for chunk in self.streaming_model.astream(messages):
                if chunk.content:
                    yield chunk.content
        except Exception as e:
            logger.error(f"LLM streaming error: {e}")
            raise

    async def extract_info(self, text: str, extraction_prompt: str) -> str:
        """Use LLM to extract structured information from text."""
        messages = [
            SystemMessage(content=extraction_prompt),
            HumanMessage(content=text),
        ]
        response = await self.chat_model.ainvoke(messages)
        return response.content

    async def summarize(self, text: str) -> str:
        """Summarize a piece of text."""
        messages = [
            SystemMessage(content="Summarize the following text concisely in 1-2 sentences."),
            HumanMessage(content=text),
        ]
        response = await self.chat_model.ainvoke(messages)
        return response.content


# Module-level singleton
llm_service = LLMService()
