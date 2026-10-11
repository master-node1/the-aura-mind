"""
Emotion Agent — analyzes user emotion and suggests empathetic response adjustments.
"""
import logging
from typing import Optional

from services.emotion_service import emotion_service

logger = logging.getLogger(__name__)

EMPATHY_ADJUSTMENTS: dict[str, str] = {
    "sadness": "The user seems sad. Be extra warm, validating, and supportive. Don't rush to solutions.",
    "anger": "The user seems frustrated or angry. Stay calm, acknowledge their feelings first, don't be defensive.",
    "fear": "The user seems scared or anxious. Be reassuring, grounding, and gentle.",
    "anxiety": "The user seems anxious. Offer calm, structured support and validation.",
    "joy": "The user is happy! Match their positive energy. Celebrate with them.",
    "love": "The user is expressing love or deep care. Respond warmly and genuinely.",
    "surprise": "The user is surprised. Engage their curiosity and match their energy.",
    "neutral": "",
}


class EmotionAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.emotion_history: list[dict] = []

    async def analyze(self, text: str) -> dict:
        """Detect emotion from text and build context for the conversation agent."""
        result = await emotion_service.detect(text)
        self.emotion_history.append(result)
        # Keep last 10
        if len(self.emotion_history) > 10:
            self.emotion_history = self.emotion_history[-10:]
        return result

    def get_empathy_hint(self, emotion: str) -> str:
        """Return a hint for the conversation agent based on detected emotion."""
        return EMPATHY_ADJUSTMENTS.get(emotion, "")

    def get_trend(self) -> Optional[str]:
        """
        Summarize emotional trend from recent history.
        E.g., "User has been mostly sad recently."
        """
        if len(self.emotion_history) < 3:
            return None
        recent = self.emotion_history[-5:]
        emotions = [e["emotion"] for e in recent]
        dominant = max(set(emotions), key=emotions.count)
        if dominant != "neutral":
            return f"User has been feeling {dominant} recently."
        return None

    def dominant_emotion(self) -> str:
        if not self.emotion_history:
            return "neutral"
        emotions = [e["emotion"] for e in self.emotion_history[-5:]]
        return max(set(emotions), key=emotions.count)
