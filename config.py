"""
VitalSense Configuration -- loads from .env with defaults.
"""

import os

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class Settings:
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    CAMERA_INDEX: int = int(os.getenv("CAMERA_INDEX", "0"))
    FRAME_RATE: int = int(os.getenv("FRAME_RATE", "30"))
    VITALS_EMIT_RATE: float = float(os.getenv("VITALS_EMIT_RATE", "1.0"))
    CALIBRATION_DURATION: int = int(os.getenv("CALIBRATION_DURATION", "30"))
    SESSION_MAX_DURATION: int = int(os.getenv("SESSION_MAX_DURATION", "600"))


settings = Settings()
