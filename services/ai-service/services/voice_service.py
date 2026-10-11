"""
Voice Service — speech-to-text (Whisper) and text-to-speech (gTTS / OpenAI TTS).
"""
import io
import logging
import tempfile
import os
from typing import Optional

from openai import AsyncOpenAI
from gtts import gTTS

from config import settings

logger = logging.getLogger(__name__)


class VoiceService:
    def __init__(self):
        self._client: Optional[AsyncOpenAI] = None

    @property
    def client(self) -> AsyncOpenAI:
        if self._client is None:
            self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        return self._client

    # ──────────────────────────────────────────────
    # Speech → Text
    # ──────────────────────────────────────────────
    async def transcribe(self, audio_bytes: bytes, filename: str = "audio.webm") -> str:
        """
        Transcribe audio using OpenAI Whisper.
        `audio_bytes` should be raw audio data (webm, mp4, wav, etc.).
        """
        try:
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = filename

            response = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
            return str(response).strip()
        except Exception as e:
            logger.error(f"Whisper transcription error: {e}")
            raise

    # ──────────────────────────────────────────────
    # Text → Speech
    # ──────────────────────────────────────────────
    async def synthesize(self, text: str) -> bytes:
        """
        Convert text to speech. Returns raw MP3 bytes.
        Uses OpenAI TTS or gTTS depending on config.
        """
        if settings.tts_provider == "openai":
            return await self._synthesize_openai(text)
        else:
            return await self._synthesize_gtts(text)

    async def _synthesize_openai(self, text: str) -> bytes:
        """OpenAI TTS — higher quality, uses API credits."""
        try:
            response = await self.client.audio.speech.create(
                model="tts-1",
                voice="nova",
                input=text,
            )
            return response.content
        except Exception as e:
            logger.error(f"OpenAI TTS error: {e}")
            raise

    async def _synthesize_gtts(self, text: str) -> bytes:
        """gTTS — free, slightly lower quality."""
        try:
            loop = __import__("asyncio").get_event_loop()
            audio_bytes = await loop.run_in_executor(None, self._gtts_sync, text)
            return audio_bytes
        except Exception as e:
            logger.error(f"gTTS synthesis error: {e}")
            raise

    def _gtts_sync(self, text: str) -> bytes:
        """Synchronous gTTS call — run in thread pool."""
        buffer = io.BytesIO()
        tts = gTTS(text=text, lang="en", slow=False)
        tts.write_to_fp(buffer)
        return buffer.getvalue()


voice_service = VoiceService()
