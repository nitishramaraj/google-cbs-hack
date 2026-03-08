# VitalSense — Real-Time Vital Signs Monitor + AI Wellness Coach

## Project Overview
Real-time contactless vital signs monitoring system using webcam + rPPG (remote photoplethysmography) with an AI wellness coach powered by Gemini.

## Architecture
- **Backend**: FastAPI + python-socketio (port 8765)
- **Frontend**: React + Vite + Tailwind CSS (port 5173, proxies to backend)
- **Vision Pipeline**: OpenCV + MediaPipe FaceLandmarker (Tasks API) + CHROM rPPG algorithm
- **AI Agent**: Gemini 3 Flash Preview (`gemini-3-flash-preview`) for voice wellness coaching
- **No mock mode** — all data comes from real camera + real Gemini API

## Key Files
- `main.py` — FastAPI + Socket.IO server, RealVisionPipeline wrapper, session lifecycle
- `capture.py` — Webcam capture + MediaPipe FaceLandmarker (new Tasks API, not legacy mp.solutions)
- `rppg.py` — CHROM algorithm, Butterworth bandpass, FFT HR extraction
- `vitals.py` — All vitals computation (HR, HRV, RR, blink rate, tension, stress composite)
- `gemini_session.py` — Gemini Live API session management
- `gemini_config.py` — "Aria" persona system instruction, model config
- `narrative_generator.py` — Session arc narrative generation via Gemini
- `session_store.py` — Timeline storage + baseline calibration
- `config.py` — Settings from .env
- `frontend/` — React app (Vite + Tailwind)

## Session Lifecycle
`waiting` → `calibrating` (30s) → `conversation` → `adapting` (stress>50) → `closing` → `completed`

## Socket.IO Events
- `overlay_data` (10fps) — face landmarks + ROI polygons
- `vitals_update` (1Hz) — HR, HRV, stress, etc.
- `phase_change` — session phase transitions
- `session_arc` — end-of-session summary
- `conversation_event` — Gemini speech events
- `audio_input` — user audio to Gemini

## Running
```bash
# Backend
pip3 install -r requirements.txt
python3 main.py

# Frontend
cd frontend && npm install && npm run dev
```

## Important Notes
- MediaPipe 0.10.32+ uses new Tasks API (FaceLandmarker), NOT legacy `mp.solutions.face_mesh`
- Model file `face_landmarker.task` must exist in project root (auto-downloaded by capture.py)
- EPIPE errors from Vite WebSocket proxy are harmless timing issues
- Camera access requires browser permission (frontend) AND system permission (backend OpenCV)
- Gemini API key is in `.env` — do not commit
- Port 8765 (not 8000) to avoid conflicts

## Commands
- Start backend: `python3 main.py`
- Start frontend: `cd frontend && npm run dev`
- Build frontend: `cd frontend && npm run build`
- Run both: `bash start.sh`
