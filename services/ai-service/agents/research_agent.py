"""
Research Agent — web search and fact lookup via LangChain tools.
"""
import logging
from typing import Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)

RESEARCH_TRIGGERS = [
    "what is", "who is", "how does", "tell me about", "explain",
    "research", "find out", "look up", "search for", "latest",
    "news about", "facts about", "statistics", "when did", "where is",
]

RESEARCH_SYSTEM_PROMPT = """
You are a knowledgeable research assistant. Given a question or topic, 
provide a concise, accurate, factual response based on your knowledge.
If you're uncertain, say so. Keep your answer focused and relevant.
Format with bullet points for multi-part answers.
"""


class ResearchAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def should_activate(self, message: str) -> bool:
        """Check if the message looks like a research/factual query."""
        msg_lower = message.lower().strip()
        return any(msg_lower.startswith(trigger) or trigger in msg_lower for trigger in RESEARCH_TRIGGERS)

    async def research(self, query: str) -> Optional[str]:
        """
        Perform research on a topic. In production this would use web search tools.
        Currently uses LLM knowledge with a research-focused prompt.
        """
        if not self.should_activate(query):
            return None

        try:
            response = await llm_service.extract_info(
                text=query,
                extraction_prompt=(
                    f"{RESEARCH_SYSTEM_PROMPT}\n\n"
                    f"Research query: {query}\n\n"
                    "Provide a concise, factual answer (2-4 sentences or bullet points)."
                ),
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Research agent error: {e}")
            return None
