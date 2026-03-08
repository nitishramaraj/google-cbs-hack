"""
gemini_session.py -- Gemini Live API session management (real only).
"""

import asyncio
import json
import logging
import os
import time
from typing import Callable, Dict, List, Optional

logger = logging.getLogger("vitalsense.gemini")

from google import genai

from gemini_config import SYSTEM_INSTRUCTION, MODEL_CONFIG, GENERATION_CONFIG, SESSION_TIMEOUT_SECONDS
from function_tools import VITALS_TOOLS, FunctionRouter


class GeminiSession:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key or os.environ.get("GOOGLE_API_KEY", "")
        self._active = False
        self._start_time: Optional[float] = None

        self._audio_callbacks: List[Callable] = []
        self._text_callbacks: List[Callable] = []
        self._function_call_callbacks: List[Callable] = []

        self._events: List[Dict] = []
        self._function_router = FunctionRouter()
        self._session = None

    async def start_session(self) -> None:
        self._active = True
        self._start_time = time.time()
        self._events = []

        if not self._api_key:
            logger.error("No GOOGLE_API_KEY set — Gemini session cannot start")
            return

        logger.info("Starting Gemini session with Live API")
        try:
            client = genai.Client(api_key=self._api_key)
            config = {
                "model": MODEL_CONFIG["model"],
                "generation_config": GENERATION_CONFIG,
                "system_instruction": SYSTEM_INSTRUCTION,
                "tools": VITALS_TOOLS,
            }
            self._session = await client.aio.live.connect(**config)
            asyncio.create_task(self._receive_loop())
        except Exception as e:
            logger.error(f"Failed to connect to Gemini Live API: {e}")

    async def send_audio(self, chunk: bytes) -> None:
        if not self._active or not self._session:
            return
        try:
            await self._session.send({"data": chunk, "mime_type": "audio/pcm"})
        except Exception as e:
            logger.error(f"Error sending audio: {e}")

    def register_audio_callback(self, callback: Callable) -> None:
        self._audio_callbacks.append(callback)

    def register_text_callback(self, callback: Callable) -> None:
        self._text_callbacks.append(callback)

    def register_function_call_callback(self, callback: Callable) -> None:
        self._function_call_callbacks.append(callback)

    async def send_function_response(self, call_id: str, result: Dict) -> None:
        if not self._session:
            return
        try:
            await self._session.send({"tool_response": {"function_responses": [
                {"id": call_id, "response": result}
            ]}})
        except Exception as e:
            logger.error(f"Error sending function response: {e}")

    async def inject_context(self, text: str) -> None:
        if not self._active:
            return
        self._add_event("context_injected", text)
        if self._session:
            try:
                await self._session.send({"text": f"[VITALS UPDATE] {text}"})
            except Exception as e:
                logger.error(f"Error injecting context: {e}")

    async def stop_session(self) -> None:
        self._active = False
        if self._session:
            try:
                await self._session.close()
            except Exception:
                pass
        logger.info("Gemini session stopped")

    def get_conversation_events(self) -> List[Dict]:
        return list(self._events)

    def is_active(self) -> bool:
        return self._active

    def _add_event(self, event_type: str, text: str = "", vitals: Optional[Dict] = None) -> None:
        elapsed = time.time() - self._start_time if self._start_time else 0
        event = {"timestamp": round(elapsed, 1), "type": event_type, "text": text}
        if vitals:
            event["vitals"] = vitals
        self._events.append(event)

    async def _emit_audio(self, data: bytes) -> None:
        for cb in self._audio_callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(data)
                else:
                    cb(data)
            except Exception as e:
                logger.error(f"Audio callback error: {e}")

    async def _emit_text(self, text: str) -> None:
        for cb in self._text_callbacks:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(text)
                else:
                    cb(text)
            except Exception as e:
                logger.error(f"Text callback error: {e}")

    async def _receive_loop(self) -> None:
        """Receive responses from real Gemini session."""
        while self._active and self._session:
            try:
                async for response in self._session.receive():
                    if not self._active:
                        break
                    if hasattr(response, 'data'):
                        await self._emit_audio(response.data)
                    if hasattr(response, 'text') and response.text:
                        self._add_event("gemini_spoke", response.text)
                        await self._emit_text(response.text)
                    if hasattr(response, 'tool_call'):
                        for fc in response.tool_call.function_calls:
                            self._add_event("function_called", fc.name)
                            result = await self._function_router.handle_call(fc.name, fc.args)
                            await self.send_function_response(fc.id, result)
            except Exception as e:
                logger.error(f"Receive loop error: {e}")
                if self._active:
                    await asyncio.sleep(2)
