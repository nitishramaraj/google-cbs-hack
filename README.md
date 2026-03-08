# VitalSense

Real-time vital signs monitoring through webcam-based computer vision, paired with an AI wellness companion powered by Gemini.

## What It Does

VitalSense uses your webcam and MediaPipe face landmarks to extract physiological signals in real time:

- **Heart Rate** -- rPPG (remote photoplethysmography) using dual CHROM + POS algorithms
- **HRV (Heart Rate Variability)** -- RMSSD from inter-beat intervals
- **Respiratory Rate** -- nose landmark oscillation with FFT
- **Blink Rate** -- eye aspect ratio detection
- **SpO2 Estimate** -- ratio-of-ratios from R/B channels
- **Facial Tension** -- brow distance and jaw geometry
- **Stress Composite** -- weighted score from all vitals

An AI voice agent (Aria) converses with you in real time, subtly adapting based on your physiological state.

## Architecture

```
Webcam → CaptureEngine (MediaPipe) → VitalsProcessor (rPPG + signal processing)
                                          ↓
FastAPI + Socket.IO ←→ React Frontend (AR overlay + dashboard)
                                          ↓
                                    Gemini Live API (voice agent)
```

| File                   | Role                                         |
|------------------------|----------------------------------------------|
| `capture.py`           | Webcam capture, MediaPipe face landmarks, ROI extraction |
| `rppg.py`              | CHROM + POS dual-algorithm rPPG with overlap-add |
| `vitals.py`            | All vital sign computations, motion gating, EMA smoothing |
| `main.py`              | FastAPI backend + Socket.IO event loop        |
| `gemini_session.py`    | Gemini Live API voice session                 |
| `gemini_config.py`     | Aria persona, model config (Gemini 3 Flash)   |
| `function_tools.py`    | Gemini function call schemas + routing        |
| `narrative_generator.py`| End-of-session narrative via Gemini text API  |
| `session_store.py`     | Time-series storage, baseline calibration     |
| `config.py`            | Settings from `.env`                          |
| `frontend/`            | React + Vite frontend with AR overlay         |

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- A webcam
- Google API key (for Gemini)

### Install

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

### Configure

Create a `.env` file in the project root:

```env
GOOGLE_API_KEY=your_key_here
CAMERA_INDEX=0
HOST=0.0.0.0
PORT=8765
```

### Run

```bash
# Option 1: Launch script
chmod +x start.sh && ./start.sh

# Option 2: Manual
python3 -m uvicorn main:combined_app --host 0.0.0.0 --port 8765 &
cd frontend && npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. Click **Begin Session** -- the system calibrates for 30 seconds
2. Sit still with good lighting on your face
3. Vitals appear in the dashboard once calibration completes
4. Aria (voice agent) engages in conversation, adapting to your stress level
5. Click **End Session** to see the session arc with narrative summary

## Signal Processing

The rPPG pipeline uses research-backed techniques for accuracy:

- **CHROM** (de Haan & Jeanne, 2013) -- chrominance-based pulse extraction
- **POS** (Wang et al., 2017) -- plane-orthogonal-to-skin projection
- Overlap-add with 1.6s Hanning-windowed segments at 50% overlap
- 6th-order Butterworth bandpass (0.65--3.5 Hz)
- FFT peak detection with SNR-based algorithm selection
- Temporal consistency filtering (rejects >15 BPM jumps)
- Motion gating via landmark displacement tracking
- Weighted multi-ROI: 60% forehead, 20% left cheek, 20% right cheek

## License

MIT
