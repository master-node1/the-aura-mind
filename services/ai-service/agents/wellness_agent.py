"""
Wellness Agent — mental wellness support, self-reflection prompts, and wellbeing tips.
"""
import logging
import random
from typing import Optional

from services.llm_service import llm_service

logger = logging.getLogger(__name__)

WELLNESS_SYSTEM_PROMPT = """
You are a compassionate wellness companion. Your role is to gently support mental 
wellbeing — never to diagnose, prescribe, or replace professional help. 
When users share struggles, validate their feelings, offer grounding techniques, 
and encourage professional support when appropriate.

Always be warm, non-judgmental, and brief. Offer one practical tip at a time.
"""

REFLECTION_PROMPTS = [
    "What's one thing you're grateful for today?",
    "How are you really feeling, on a scale of 1-10?",
    "What's been taking up most of your mental energy lately?",
    "Is there something you've been avoiding thinking about?",
    "What would make today feel complete for you?",
    "What's one small win you can celebrate right now?",
    "Who in your life makes you feel most understood?",
    "If you could change one thing about your day, what would it be?",
]

GROUNDING_TECHNIQUES = [
    "Try the 5-4-3-2-1 technique: name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste.",
    "Take 3 slow, deep breaths. Breathe in for 4 counts, hold for 4, out for 6.",
    "Place both feet flat on the floor. Notice the sensation. You are grounded, here, now.",
    "Name 3 emotions you're feeling without judging them. Just observe.",
]

WELLNESS_TRIGGERS = [
    "stressed", "anxious", "overwhelmed", "sad", "depressed", "lonely",
    "tired", "exhausted", "burned out", "hopeless", "panic", "can't sleep",
]


class WellnessAgent:
    def __init__(self, user_id: str):
        self.user_id = user_id

    def should_activate(self, message: str, emotion: str) -> bool:
        """Determine if wellness support is relevant for this message."""
        msg_lower = message.lower()
        if emotion in ("sadness", "fear", "anxiety", "anger"):
            return True
        return any(trigger in msg_lower for trigger in WELLNESS_TRIGGERS)

    async def generate_support(self, message: str, emotion: str) -> Optional[str]:
        """Generate a wellness-aware supportive note to append to the AI response."""
        if not self.should_activate(message, emotion):
            return None

        try:
            response = await llm_service.extract_info(
                text=message,
                extraction_prompt=(
                    f"{WELLNESS_SYSTEM_PROMPT}\n\n"
                    f"The user said: '{message}'\n"
                    f"Their detected emotion is: {emotion}\n\n"
                    "Write ONE brief (1-2 sentence) empathetic supportive note. "
                    "Do not repeat what the main companion already said. "
                    "Optionally include one practical tip."
                ),
            )
            return response.strip()
        except Exception as e:
            logger.warning(f"Wellness agent error: {e}")
            return None

    def get_random_reflection_prompt(self) -> str:
        return random.choice(REFLECTION_PROMPTS)

    def get_grounding_technique(self) -> str:
        return random.choice(GROUNDING_TECHNIQUES)

    def get_suggestions(self, emotion: str) -> list[str]:
        """Return quick action suggestions based on emotion."""
        suggestions_map = {
            "sadness": ["Try journaling your feelings", "Reach out to someone you trust", "Go for a short walk"],
            "anxiety": ["Try a breathing exercise", "Ground yourself with the 5-4-3-2-1 technique", "Limit news/social media"],
            "anger": ["Take a 5 minute break", "Write down what's bothering you", "Physical movement can help release tension"],
            "fear": ["Talk to someone about your fears", "Focus on what you can control", "Break the problem into smaller pieces"],
            "joy": ["Savor this moment", "Share your happiness with someone", "Note this in a gratitude journal"],
            "neutral": ["Check in with yourself — how are you really feeling?"],
        }
        return suggestions_map.get(emotion, suggestions_map["neutral"])
