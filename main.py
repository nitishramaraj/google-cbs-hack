"""
main.py -- FastAPI backend + Socket.IO for VitalSense (real pipeline only).
"""

import asyncio
import json
import logging
import time
import traceback
from typing import Optional, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio

from config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("vitalsense")

# --- FastAPI App ---
app = FastAPI(title="VitalSense API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

# --- Socket.IO ---
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*",
                           logger=False, engineio_logger=False)
combined_app = socketio.ASGIApp(sio, other_asgi_app=app)

# --- Session State ---
session_state: Dict = {
    "phase": "waiting",
    "start_time": None,
    "tasks": [],
    "sid": None,
}

# Pipeline references — initialized per session, cleaned up after
vision_pipeline = None
gemini_session = None
session_store = None
capture_engine = None


class RealVisionPipeline:
    """Wraps CaptureEngine + VitalsProcessor."""

    def __init__(self, cap_engine, vitals_proc):
        self._capture = cap_engine
        self._vitals = vitals_proc
        self._last_rgb_count = 0

    def _sync_rgb_data(self):
        """Feed ALL new weighted RGB samples from capture buffer into vitals."""
        buffers = self._capture.get_rgb_buffers()
        combined = buffers.get("combined", [])
        new_count = len(combined)
        if new_count > self._last_rgb_count:
            for sample in combined[self._last_rgb_count:]:
                self._vitals.add_rgb_sample(sample)
            self._last_rgb_count = new_count

    def get_vitals_snapshot(self) -> Dict:
        frame, landmarks = self._capture.get_frame()
        if frame is not None:
            self._vitals.process_frame(frame, landmarks)
        self._sync_rgb_data()
        snapshot = self._vitals.get_vitals_snapshot()
        # Add stress_level for frontend
        stress = snapshot.get("stress_composite") or 0
        if stress < 25:
            snapshot["stress_level"] = "low"
        elif stress < 50:
            snapshot["stress_level"] = "mild"
        elif stress < 75:
            snapshot["stress_level"] = "elevated"
        else:
            snapshot["stress_level"] = "high"
        return snapshot

    def get_overlay_data(self) -> Dict:
        frame, landmarks = self._capture.get_frame()
        if frame is not None:
            self._vitals.process_frame(frame, landmarks)
        self._sync_rgb_data()

        data = self._vitals.get_overlay_data()
        # Normalize landmarks to 0-1 range for frontend
        if data.get("landmarks"):
            normalized = []
            for lm in data["landmarks"]:
                normalized.append([lm[0] / 640.0, lm[1] / 480.0, lm[2]])
            data["landmarks"] = normalized
            if data.get("roi_polygons"):
                for key in data["roi_polygons"]:
                    data["roi_polygons"][key] = [
                        [p[0] / 640.0, p[1] / 480.0] for p in data["roi_polygons"][key]
                    ]
        return data


def _start_pipeline():
    """Initialize real pipeline for a new session."""
    global vision_pipeline, gemini_session, session_store, capture_engine

    from capture import CaptureEngine
    from vitals import VitalsProcessor
    from gemini_session import GeminiSession as RealGeminiSession

    capture_engine = CaptureEngine(settings.CAMERA_INDEX, settings.FRAME_RATE)
    capture_engine.start()
    vitals_proc = VitalsProcessor(settings.FRAME_RATE)
    vision_pipeline = RealVisionPipeline(capture_engine, vitals_proc)
    gemini_session = RealGeminiSession(settings.GOOGLE_API_KEY)
    logger.info("Pipeline: REAL mode (camera + MediaPipe + Gemini)")

    # Wire Gemini function handlers to real data
    gemini_session._function_router.register_handler(
        "get_vitals_snapshot",
        lambda **_: vision_pipeline.get_vitals_snapshot() if vision_pipeline else {}
    )

    from session_store import SessionStore
    session_store = SessionStore()

    gemini_session._function_router.register_handler(
        "get_baseline_comparison",
        lambda **_: session_store.get_baseline_comparison() if session_store else {}
    )
    gemini_session._function_router.register_handler(
        "get_session_arc",
        lambda **_: session_store.get_session_arc() if session_store else {}
    )


def _stop_pipeline():
    """Release camera and cleanup."""
    global vision_pipeline, gemini_session, session_store, capture_engine
    if capture_engine:
        try:
            capture_engine.stop()
        except Exception:
            pass
        capture_engine = None
    vision_pipeline = None
    gemini_session = None
    session_store = None


# --- REST Endpoints ---
@app.get("/")
async def root():
    return {
        "status": "ok",
        "name": "VitalSense API",
        "mode": "real",
    }


@app.get("/status")
async def status():
    return {
        "phase": session_state["phase"],
        "mode": "real",
        "uptime": time.time() - session_state["start_time"] if session_state["start_time"] else 0,
    }


# --- Socket.IO Events ---
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")
    session_state["sid"] = sid
    await sio.emit("connection_status", {"connected": True}, room=sid)


@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")
    await _cleanup_session()


@sio.event
async def start_session(sid, data=None):
    logger.info(f"Starting session for {sid}")

    # Cleanup any previous session
    await _cleanup_session()

    # Init pipeline fresh
    try:
        _start_pipeline()
    except Exception as e:
        logger.error(f"Pipeline failed to start: {e}")
        logger.error(traceback.format_exc())
        await sio.emit("error", {"message": f"Camera/pipeline error: {e}"}, room=sid)
        return

    session_state["phase"] = "calibrating"
    session_state["start_time"] = time.time()
    session_state["sid"] = sid
    session_store.start()
    session_store.start_calibration()

    await sio.emit("phase_change", {"phase": "calibrating"}, room=sid)
    logger.info("Phase: calibrating")

    # Start Gemini
    if gemini_session:
        try:
            await gemini_session.start_session()
        except Exception as e:
            logger.error(f"Gemini start failed: {e}")

    # Start background tasks
    tasks = [
        asyncio.create_task(_vision_loop(sid)),
        asyncio.create_task(_vitals_emitter(sid)),
        asyncio.create_task(_calibration_timer(sid)),
        asyncio.create_task(_gemini_event_emitter(sid)),
        asyncio.create_task(_session_timeout(sid)),
    ]
    session_state["tasks"] = tasks


@sio.event
async def stop_session(sid, data=None):
    logger.info(f"Stopping session for {sid}")
    await _end_session(sid)


@sio.event
async def audio_input(sid, data):
    if gemini_session and hasattr(gemini_session, 'send_audio'):
        try:
            await gemini_session.send_audio(data)
        except Exception:
            pass


# --- Background Tasks ---
async def _vision_loop(sid: str) -> None:
    """Emit overlay data at ~10fps."""
    interval = 1.0 / 10
    try:
        while session_state["phase"] not in ("completed", "waiting"):
            if vision_pipeline:
                try:
                    overlay = vision_pipeline.get_overlay_data()
                    await sio.emit("overlay_data", overlay, room=sid)
                except Exception as e:
                    logger.debug(f"Overlay error: {e}")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        pass


async def _vitals_emitter(sid: str) -> None:
    """Emit vitals at 1Hz."""
    interval = 1.0 / settings.VITALS_EMIT_RATE
    try:
        while session_state["phase"] not in ("completed", "waiting"):
            if vision_pipeline:
                try:
                    vitals = vision_pipeline.get_vitals_snapshot()
                    vitals["phase"] = session_state["phase"]
                    await sio.emit("vitals_update", vitals, room=sid)

                    if session_store:
                        session_store.add_reading(vitals)

                    # Inject vitals context into Gemini
                    if gemini_session and hasattr(gemini_session, 'inject_context'):
                        context = (f"HR:{vitals.get('heart_rate')} "
                                   f"Stress:{vitals.get('stress_composite')} "
                                   f"Quality:{vitals.get('signal_quality')}")
                        try:
                            await gemini_session.inject_context(context)
                        except Exception:
                            pass

                    # Phase transitions based on stress
                    stress = vitals.get("stress_composite")
                    if stress is not None:
                        if stress > 50 and session_state["phase"] == "conversation":
                            session_state["phase"] = "adapting"
                            await sio.emit("phase_change", {"phase": "adapting"}, room=sid)
                            logger.info("Phase: adapting (stress elevated)")
                        elif stress < 35 and session_state["phase"] == "adapting":
                            session_state["phase"] = "conversation"
                            await sio.emit("phase_change", {"phase": "conversation"}, room=sid)
                            logger.info("Phase: conversation (stress normalized)")
                except Exception as e:
                    logger.debug(f"Vitals error: {e}")
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        pass


async def _calibration_timer(sid: str) -> None:
    """Handle calibration phase."""
    try:
        await asyncio.sleep(settings.CALIBRATION_DURATION)
        if session_state["phase"] == "calibrating":
            if session_store:
                session_store.end_calibration()
            session_state["phase"] = "conversation"
            await sio.emit("phase_change", {"phase": "conversation"}, room=sid)
            logger.info("Phase: conversation (calibration complete)")
    except asyncio.CancelledError:
        pass


async def _gemini_event_emitter(sid: str) -> None:
    """Forward Gemini events to frontend."""
    last_count = 0
    try:
        while session_state["phase"] not in ("completed", "waiting"):
            if gemini_session and hasattr(gemini_session, 'get_conversation_events'):
                events = gemini_session.get_conversation_events()
                if len(events) > last_count:
                    for event in events[last_count:]:
                        await sio.emit("conversation_event", event, room=sid)
                    last_count = len(events)
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        pass


async def _session_timeout(sid: str) -> None:
    """End session after max duration."""
    try:
        await asyncio.sleep(settings.SESSION_MAX_DURATION)
        if session_state["phase"] not in ("completed", "waiting"):
            logger.info("Session timeout")
            await _end_session(sid)
    except asyncio.CancelledError:
        pass


async def _end_session(sid: str) -> None:
    """End session, generate arc, cleanup."""
    if session_state["phase"] in ("completed", "waiting"):
        return

    session_state["phase"] = "closing"
    await sio.emit("phase_change", {"phase": "closing"}, room=sid)

    # Cancel background tasks
    for task in session_state.get("tasks", []):
        task.cancel()
    session_state["tasks"] = []

    # Stop Gemini
    if gemini_session:
        try:
            await gemini_session.stop_session()
        except Exception:
            pass

    # Generate session arc
    arc_data = {
        "vitals_timeline": [], "events": [],
        "narrative": "", "duration_seconds": 0,
        "key_moments": [], "overall_assessment": "calm",
        "stats": {"duration_minutes": 0, "avg_heart_rate": 0, "max_stress": 0, "total_events": 0},
    }

    if session_store:
        arc = session_store.get_session_arc()
        arc_data["vitals_timeline"] = arc.get("vitals_timeline", [])
        arc_data["duration_seconds"] = arc.get("duration_seconds", 0)

    if gemini_session and hasattr(gemini_session, 'get_conversation_events'):
        arc_data["events"] = gemini_session.get_conversation_events()

    # Generate narrative (with 10s timeout)
    try:
        from narrative_generator import generate_narrative
        narrative_result = await asyncio.wait_for(
            generate_narrative(
                arc_data["vitals_timeline"],
                arc_data["events"],
                arc_data["duration_seconds"],
            ),
            timeout=10.0,
        )
        arc_data["narrative"] = narrative_result.get("narrative", "")
        arc_data["key_moments"] = narrative_result.get("key_moments", [])
        arc_data["overall_assessment"] = narrative_result.get("overall_assessment", "calm")
        arc_data["stats"] = narrative_result.get("stats", arc_data["stats"])
    except asyncio.TimeoutError:
        logger.warning("Narrative generation timed out")
        arc_data["narrative"] = "Session complete. Thank you for this mindful moment."
    except Exception as e:
        logger.error(f"Narrative failed: {e}")
        arc_data["narrative"] = "Session complete. Thank you for this mindful moment."

    await sio.emit("session_arc", arc_data, room=sid)
    session_state["phase"] = "completed"
    await sio.emit("phase_change", {"phase": "completed"}, room=sid)

    # Release camera
    _stop_pipeline()
    logger.info("Session ended, arc delivered, pipeline released")


async def _cleanup_session() -> None:
    for task in session_state.get("tasks", []):
        task.cancel()
    session_state["phase"] = "waiting"
    session_state["tasks"] = []
    _stop_pipeline()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(combined_app, host=settings.HOST, port=settings.PORT)
