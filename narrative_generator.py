"""
narrative_generator.py -- Generate session arc narrative.
"""

import os
import logging
from typing import Dict, List, Optional

logger = logging.getLogger("vitalsense.narrative")

try:
    from google import genai
    HAS_GENAI = True
except ImportError:
    HAS_GENAI = False


async def generate_narrative(vitals_timeline: List[Dict],
                             conversation_events: List[Dict],
                             duration_seconds: float) -> Dict:
    """Generate a narrative summary of the session."""
    duration_min = round(duration_seconds / 60, 1)

    # Extract stats
    hrs = [v.get("hr") for v in vitals_timeline if v.get("hr")]
    stresses = [v.get("stress") for v in vitals_timeline if v.get("stress")]
    avg_hr = round(sum(hrs) / len(hrs)) if hrs else 0
    max_stress = round(max(stresses)) if stresses else 0
    min_stress = round(min(stresses)) if stresses else 0

    # Find key moments
    key_moments = []
    for event in conversation_events:
        if event["type"] in ("stress_detected", "gemini_adapted"):
            t = event["timestamp"]
            minutes = int(t // 60)
            seconds = int(t % 60)
            key_moments.append({
                "time": f"{minutes}:{seconds:02d}",
                "timestamp": t,
                "type": event["type"],
                "description": event.get("text", ""),
            })

    # Try Gemini API for narrative
    api_key = os.environ.get("GOOGLE_API_KEY", "")
    if api_key and HAS_GENAI:
        try:
            client = genai.Client(api_key=api_key)
            prompt = (
                f"Write a warm, empathetic 3-4 sentence summary of a {duration_min}-minute "
                f"wellness session. Average heart rate was {avg_hr} BPM. "
                f"Stress ranged from {min_stress} to {max_stress}. "
                f"Key moments: {key_moments}. "
                "Be encouraging and highlight positive trends."
            )
            response = await client.aio.models.generate_content(
                model="gemini-3-flash-preview",
                contents=prompt,
            )
            narrative_text = response.text
        except Exception as e:
            logger.warning(f"Gemini narrative generation failed: {e}")
            narrative_text = _template_narrative(duration_min, avg_hr, max_stress, min_stress, key_moments)
    else:
        narrative_text = _template_narrative(duration_min, avg_hr, max_stress, min_stress, key_moments)

    # Overall assessment
    avg_stress = sum(stresses) / len(stresses) if stresses else 0
    if avg_stress < 30:
        assessment = "calm"
    elif avg_stress < 55:
        assessment = "moderate"
    else:
        assessment = "elevated"

    return {
        "narrative": narrative_text,
        "key_moments": key_moments,
        "overall_assessment": assessment,
        "stats": {
            "duration_minutes": duration_min,
            "avg_heart_rate": avg_hr,
            "max_stress": max_stress,
            "total_events": len(conversation_events),
        },
    }


def _template_narrative(duration_min: float, avg_hr: int, max_stress: int,
                        min_stress: int, key_moments: list) -> str:
    parts = [f"During your {duration_min}-minute session, your heart rate averaged {avg_hr} BPM."]

    if max_stress > 50:
        parts.append(
            f"There were moments of elevated stress (peaking at {max_stress}), "
            "but your body showed a wonderful ability to self-regulate."
        )
    else:
        parts.append("Your stress levels remained within a comfortable range throughout.")

    if key_moments:
        moment = key_moments[0]
        parts.append(f"At {moment['time']}, a notable shift occurred, and you responded with resilience.")

    parts.append(
        "Overall, this session reflects your capacity for mindful awareness. "
        "Keep nurturing this connection with yourself."
    )

    return " ".join(parts)
