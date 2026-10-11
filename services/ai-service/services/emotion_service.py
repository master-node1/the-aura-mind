"""
Emotion Service — detect emotion from text and map to avatar expressions.
"""
import logging
import re
from typing import Optional
from openai import AsyncOpenAI

from config import settings

logger = logging.getLogger(__name__)

EMOTIONS = ["joy", "sadness", "anger", "fear", "surprise", "neutral", "love", "anxiety"]

EMOTION_TO_AVATAR: dict[str, str] = {
    "joy": "happy",
    "love": "happy",
    "surprise": "surprised",
    "sadness": "sad",
    "anger": "upset",
    "fear": "worried",
    "anxiety": "worried",
    "neutral": "idle",
}

EMOTION_TO_COLOR: dict[str, str] = {
    "joy": "#FFD700",
    "love": "#FF69B4",
    "surprise": "#FF8C00",
    "sadness": "#4169E1",
    "anger": "#DC143C",
    "fear": "#9932CC",
    "anxiety": "#708090",
    "neutral": "#9E9E9E",
}

EMOTION_EMOJI: dict[str, str] = {
    "joy": "😊",
    "love": "💕",
    "surprise": "😮",
    "sadness": "😢",
    "anger": "😠",
    "fear": "😨",
    "anxiety": "😰",
    "neutral": "😐",
}

DETECTION_PROMPT = """
Analyze the emotional tone of the following message and respond with ONLY a JSON object:
{
  "emotion": "<emotion>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief reason>"
}

Valid emotions: joy, sadness, anger, fear, surprise, neutral, love, anxiety

Message: {message}
"""


class EmotionService:
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        return self._client

    async def detect(self, text: str) -> dict:
        """
        Detect emotion from text using OpenAI.
        Returns: { emotion, confidence, avatar_expression, color, emoji }
        """
        import json

        try:
            response = await self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "user",
                        "content": DETECTION_PROMPT.format(message=text),
                    }
                ],
                temperature=0.1,
                max_tokens=150,
            )
            raw = response.choices[0].message.content.strip()
            # Extract JSON even if surrounded by markdown fences
            json_match = re.search(r"\{.*\}", raw, re.DOTALL)
            if json_match:
                data = json.loads(json_match.group())
                emotion = data.get("emotion", "neutral").lower()
                if emotion not in EMOTIONS:
                    emotion = "neutral"
                confidence = float(data.get("confidence", 0.5))
            else:
                emotion = "neutral"
                confidence = 0.5

        except Exception as e:
            logger.warning(f"Emotion detection failed, defaulting to neutral: {e}")
            emotion = "neutral"
            confidence = 0.5

        return {
            "emotion": emotion,
            "confidence": confidence,
            "avatar_expression": EMOTION_TO_AVATAR.get(emotion, "idle"),
            "color": EMOTION_TO_COLOR.get(emotion, "#9E9E9E"),
            "emoji": EMOTION_EMOJI.get(emotion, "😐"),
        }

    def heuristic_detect(self, text: str) -> dict:
        """
        Lightweight keyword-based emotion detection (no API call).
        Used as fallback or for low-latency contexts.
        """
        text_lower = text.lower()

        joy_keywords = ["happy", "excited", "great", "love", "wonderful", "amazing", "fantastic", "😊", "😄", "🎉"]
        sadness_keywords = ["sad", "unhappy", "depressed", "crying", "miss", "lonely", "hurt", "😢", "😭"]
        anger_keywords = ["angry", "mad", "furious", "hate", "annoyed", "frustrated", "😠", "😡"]
        fear_keywords = ["scared", "afraid", "anxious", "nervous", "worried", "panic", "😨", "😰"]
        surprise_keywords = ["wow", "omg", "surprised", "unexpected", "shocking", "😮", "🤯"]
        love_keywords = ["love", "adore", "cherish", "heart", "care about", "💕", "❤️"]

        keyword_map = [
            (joy_keywords, "joy"),
            (sadness_keywords, "sadness"),
            (anger_keywords, "anger"),
            (fear_keywords, "fear"),
            (surprise_keywords, "surprise"),
            (love_keywords, "love"),
        ]

        for keywords, emotion in keyword_map:
            if any(kw in text_lower for kw in keywords):
                return {
                    "emotion": emotion,
                    "confidence": 0.7,
                    "avatar_expression": EMOTION_TO_AVATAR.get(emotion, "idle"),
                    "color": EMOTION_TO_COLOR.get(emotion, "#9E9E9E"),
                    "emoji": EMOTION_EMOJI.get(emotion, "😐"),
                }

        return {
            "emotion": "neutral",
            "confidence": 0.9,
            "avatar_expression": "idle",
            "color": EMOTION_TO_COLOR["neutral"],
            "emoji": EMOTION_EMOJI["neutral"],
        }


emotion_service = EmotionService()
