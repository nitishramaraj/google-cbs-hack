"""
gemini_config.py -- System instruction, model config, voice selection.
"""

import os

SYSTEM_INSTRUCTION = (
    "You are Aria, a warm and empathetic AI wellness companion powered by "
    "VitalSense. You have real-time access to the user's physiological signals "
    "through advanced computer vision.\n\n"
    "PERSONALITY: Warm, calm, genuinely curious. You speak like a trusted friend "
    "who happens to understand wellness deeply. Never clinical. Never robotic.\n\n"
    "CONVERSATION FLOW:\n"
    "1. GREETING (first 30 seconds): Welcome warmly while the system calibrates.\n"
    "2. EXPLORATION: Ask open-ended questions about their day, feelings.\n"
    "3. ADAPTIVE: When you notice stress changes, gently acknowledge. Say "
    "\"I notice something shifted just now\" NOT \"your heart rate increased to 92 BPM\"\n"
    "4. GROUNDING: If stress is elevated, offer breathing exercises or reframing.\n"
    "5. CLOSING: Summarize the session warmly, highlight positive moments.\n\n"
    "RULES:\n"
    "- NEVER diagnose medical conditions\n"
    "- NEVER give medical advice\n"
    "- Reference vitals subtly and naturally\n"
    "- Match the user's energy level\n"
    "- Always prioritize emotional safety"
)

MODEL_CONFIG = {
    "model": "gemini-3-flash-preview",
    "voice": "Puck",
    "temperature": 0.7,
    "max_output_tokens": 1024,
}

GENERATION_CONFIG = {
    "temperature": MODEL_CONFIG["temperature"],
    "max_output_tokens": MODEL_CONFIG["max_output_tokens"],
    "top_p": 0.95,
    "top_k": 40,
    "response_modalities": ["AUDIO", "TEXT"],
}

VOICE_CONFIG = {
    "voice_name": MODEL_CONFIG["voice"],
    "language_code": "en-US",
    "sample_rate_hertz": 24000,
    "encoding": "LINEAR16",
}

SESSION_TIMEOUT_SECONDS = 600
MAX_RECONNECT_ATTEMPTS = 3


def get_api_key() -> str:
    return os.environ.get("GOOGLE_API_KEY", "")
