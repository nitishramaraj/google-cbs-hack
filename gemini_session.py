"""
gemini_session.py -- Gemini Live API session management.
Uses google.genai SDK with async context manager for live.connect().
"""

import asyncio
import logging
import os
import time
from typing import Callable, Dict, List, Optional

logger = logging.getLogger("vitalsense.gemini")

from google import genai
from google.genai import types

from gemini_config import SYSTEM_INSTRUCTION, MODEL_CONFIG
from function_tools import VITALS_TOOLS, FunctionRouter


class GeminiSession:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key = api_key or os.environ.get("GOOGLE_API_KEY", "")
        self._active = False
        self._start_time: Optional[float] = None

        self._audio_callbacks: List[Callable] = []
        self._text_callbacks: List[Callable] = []

        self._events: List[Dict] = []
        self._function_router = FunctionRouter()
        self._session = None
        self._client = None
        self._session_task = None

    async def start_session(self) -> None:
        self._active = True
        self._start_time = time.time()
        self._events = []

        if not self._api_key:
            logger.error("No GOOGLE_API_KEY set — Gemini session cannot start")
            return

        logger.info("Starting Gemini session with Live API")
        # Launch the session lifecycle as a background task
        self._session_task = asyncio.create_task(self._run_session())

    async def _run_session(self) -> None:
        """Manage the full lifecycle of the Gemini Live connection."""
        try:
            self._client = genai.Client(api_key=self._api_key)

            # Build function declarations for tools
            func_decls = []
            for tool in VITALS_TOOLS:
                func_decls.append(types.FunctionDeclaration(
                    name=tool["name"],
                    description=tool["description"],
                    parameters=types.Schema(
                        type="OBJECT",
                        properties={},
                    ),
                ))

            config = types.LiveConnectConfig(
                responseModalities=["AUDIO"],
                speechConfig=types.SpeechConfig(
                    voiceConfig=types.VoiceConfig(
                        prebuiltVoiceConfig=types.PrebuiltVoiceConfig(
                            voiceName=MODEL_CONFIG["voice"],
                        )
                    )
                ),
                systemInstruction=SYSTEM_INSTRUCTION,
                tools=[types.Tool(functionDeclarations=func_decls)],
                temperature=MODEL_CONFIG["temperature"],
                outputAudioTranscription=types.AudioTranscriptionConfig(),
            )

            async with self._client.aio.live.connect(
                model=MODEL_CONFIG["model"],
                config=config,
            ) as session:
                self._session = session
                logger.info("Gemini Live session connected successfully")

                # Kick off the conversation — Aria greets and asks their name
                await self._send_text(
                    "Start with Step 1 from your instructions. Greet them warmly and ask their name."
                )

                # Receive loop — runs until session ends
                await self._receive_loop()

        except asyncio.CancelledError:
            logger.info("Gemini session task cancelled")
        except Exception as e:
            logger.error(f"Gemini session error: {e}")
            import traceback
            logger.error(traceback.format_exc())
        finally:
            self._session = None
            logger.info("Gemini session closed")

    async def _send_text(self, text: str) -> None:
        """Send a text message to Gemini to prompt a response."""
        if not self._session:
            logger.warning("Cannot send text — no session")
            return
        try:
            logger.info(f"Sending text to Gemini: {text[:80]}...")
            await self._session.send_client_content(
                turns=types.Content(role="user", parts=[types.Part(text=text)]),
                turn_complete=True,
            )
            logger.info("Text sent successfully")
        except Exception as e:
            logger.error(f"Error sending text: {e}")
            import traceback
            logger.error(traceback.format_exc())

    async def send_audio(self, chunk: bytes) -> None:
        if not self._active or not self._session:
            return
        try:
            await self._session.send_realtime_input(
                audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
            )
        except Exception as e:
            logger.debug(f"Error sending audio: {e}")

    async def send_video_frame(self, jpeg_bytes: bytes) -> None:
        """Send a video frame (JPEG) to Gemini for vision."""
        if not self._active or not self._session:
            return
        try:
            await self._session.send_realtime_input(
                video=types.Blob(data=jpeg_bytes, mime_type="image/jpeg")
            )
        except Exception as e:
            logger.debug(f"Error sending video frame: {e}")

    def register_audio_callback(self, callback: Callable) -> None:
        self._audio_callbacks.append(callback)

    def register_text_callback(self, callback: Callable) -> None:
        self._text_callbacks.append(callback)

    async def inject_context(self, text: str) -> None:
        """Inject context without interrupting Gemini's current turn."""
        if not self._active or not self._session:
            return
        self._add_event("context_injected", text)
        try:
            # Use turn_complete=False so we don't interrupt Gemini
            await self._session.send_client_content(
                turns=types.Content(role="user", parts=[types.Part(text=f"[CONTEXT] {text}")]),
                turn_complete=False,
            )
        except Exception as e:
            logger.debug(f"Context inject error: {e}")

    async def stop_session(self) -> None:
        self._active = False
        if self._session:
            try:
                await self._session.close()
            except Exception:
                pass
        if self._session_task:
            self._session_task.cancel()
            try:
                await self._session_task
            except (asyncio.CancelledError, Exception):
                pass
            self._session_task = None
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
        """Receive responses from Gemini Live session."""
        logger.info("Gemini receive loop started")
        try:
            while self._active and self._session:
                try:
                    async for response in self._session.receive():
                        if not self._active:
                            break

                        # Debug: log what we got
                        resp_attrs = []
                        if getattr(response, 'server_content', None):
                            sc = response.server_content
                            if getattr(sc, 'model_turn', None):
                                parts = sc.model_turn.parts if hasattr(sc.model_turn, 'parts') else []
                                for p in parts:
                                    if hasattr(p, 'inline_data') and p.inline_data:
                                        resp_attrs.append(f"audio:{len(p.inline_data.data)}b")
                                    if hasattr(p, 'text') and p.text:
                                        resp_attrs.append(f"text:{p.text[:50]}")
                            if getattr(sc, 'output_transcription', None):
                                resp_attrs.append("transcript")
                            if getattr(sc, 'turn_complete', False):
                                resp_attrs.append("turn_complete")
                        if getattr(response, 'tool_call', None):
                            resp_attrs.append("tool_call")
                        if resp_attrs:
                            logger.info(f"Gemini response: {', '.join(resp_attrs)}")

                        # Handle server content (audio + text)
                        server_content = getattr(response, 'server_content', None)
                        if server_content:
                            parts = getattr(server_content, 'model_turn', None)
                            if parts and hasattr(parts, 'parts'):
                                for part in parts.parts:
                                    # Audio data
                                    if hasattr(part, 'inline_data') and part.inline_data:
                                        audio_data = part.inline_data.data
                                        logger.debug(f"Audio chunk: {len(audio_data)} bytes")
                                        await self._emit_audio(audio_data)
                                    # Text from model turn
                                    if hasattr(part, 'text') and part.text:
                                        self._add_event("gemini_spoke", part.text)
                                        await self._emit_text(part.text)

                            # Output audio transcription (what Aria said as text)
                            output_transcription = getattr(server_content, 'output_transcription', None)
                            if output_transcription and hasattr(output_transcription, 'text'):
                                text = output_transcription.text
                                if text and text.strip():
                                    self._add_event("gemini_transcript", text)
                                    await self._emit_text(text)

                            # Input audio transcription (what user said)
                            input_transcription = getattr(server_content, 'input_transcription', None)
                            if input_transcription and hasattr(input_transcription, 'text'):
                                text = input_transcription.text
                                if text and text.strip():
                                    self._add_event("user_spoke", text)

                        # Handle tool calls
                        tool_call = getattr(response, 'tool_call', None)
                        if tool_call and hasattr(tool_call, 'function_calls'):
                            for fc in tool_call.function_calls:
                                self._add_event("function_called", fc.name)
                                result = await self._function_router.handle_call(
                                    fc.name, dict(fc.args) if fc.args else {}
                                )
                                try:
                                    await self._session.send_tool_response(
                                        function_responses=[
                                            types.FunctionResponse(
                                                name=fc.name,
                                                id=fc.id,
                                                response=result,
                                            )
                                        ]
                                    )
                                except Exception as e:
                                    logger.error(f"Error sending function response: {e}")

                except StopAsyncIteration:
                    break
                except Exception as e:
                    if self._active:
                        logger.error(f"Receive loop error: {e}")
                        await asyncio.sleep(1)
                    else:
                        break
        except asyncio.CancelledError:
            pass
        logger.info("Gemini receive loop ended")
