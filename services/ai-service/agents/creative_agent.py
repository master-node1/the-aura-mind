"""
Creative Agent — story generation, brainstorming, and content creation.
"""
import logging
from typing import Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)

CREATIVE_TRIGGERS = [
    "write a story", "tell me a story", "poem", "haiku", "brainstorm",
    "creative ideas", "write me", "create a", "imagine", "fantasy",
    "sci-fi", "fiction", "roleplay", "let's play", "what if", "invent",
    "song lyrics", "write lyrics", "limerick",
]

CREATIVE_SYSTEM_PROMPT = """
You are an imaginative and talented creative companion. You excel at:
- Short stories (slice of life, fantasy, sci-fi, romance, mystery)
- Poetry (haiku, limerick, free verse, sonnet)
- Brainstorming and idea generation
- Creative writing prompts
- World-building
- Song lyrics

Be vivid, evocative, and original. Match the user's requested tone and style.
"""


class CreativeAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def should_activate(self, message: str) -> bool:
        msg_lower = message.lower()
        return any(trigger in msg_lower for trigger in CREATIVE_TRIGGERS)

    def detect_creative_type(self, message: str) -> str:
        msg_lower = message.lower()
        if any(w in msg_lower for w in ["poem", "haiku", "limerick", "verse"]):
            return "poetry"
        if any(w in msg_lower for w in ["story", "tale", "fiction", "once upon"]):
            return "story"
        if any(w in msg_lower for w in ["brainstorm", "ideas", "list", "suggest"]):
            return "brainstorm"
        if any(w in msg_lower for w in ["lyrics", "song"]):
            return "lyrics"
        return "general"

    async def create(self, prompt: str) -> Optional[str]:
        """Generate creative content based on the user's prompt."""
        if not self.should_activate(prompt):
            return None

        creative_type = self.detect_creative_type(prompt)
        type_guidance = {
            "poetry": "Focus on rhythm, imagery, and emotion.",
            "story": "Include a beginning, rising action, and satisfying ending. Keep it under 300 words.",
            "brainstorm": "Generate 5-7 diverse, creative ideas as a bulleted list.",
            "lyrics": "Structure with verse, chorus, and bridge. Make it catchy and emotionally resonant.",
            "general": "Be creative, surprising, and delightful.",
        }.get(creative_type, "")

        try:
            response = await llm_service.extract_info(
                text=prompt,
                extraction_prompt=(
                    f"{CREATIVE_SYSTEM_PROMPT}\n\n"
                    f"Creative request: {prompt}\n\n"
                    f"Guidance: {type_guidance}"
                ),
            )
            return response.strip()
        except Exception as e:
            logger.error(f"Creative agent error: {e}")
            return None
