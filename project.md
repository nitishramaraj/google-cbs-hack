# VitalSense — Team Task Allocation (4 People, 24 Hours)

## Team Roles

```
Person A: VISION ENGINEER — MediaPipe + rPPG signal processing
Person B: GEMINI ENGINEER — Gemini Live API + voice agent
Person C: FRONTEND ENGINEER — React UI + AR overlay + session arc
Person D: INTEGRATION ENGINEER — Backend server + wiring + demo lead
```

---

## Why This Split

Person A and B work independently for the first 6-8 hours — no dependencies between them. A builds the vision pipeline that outputs vitals JSON. B builds the Gemini voice agent that consumes vitals JSON. They don't need each other's code until integration. Person C builds the frontend that receives data from D's backend. Person D owns the FastAPI server, the WebSocket bridge, and stitches everything together. D is also the "glue person" who unblocks others and runs the final demo.

---

## Person A: Vision Engineer

**Owns:** Everything from webcam frame to vitals JSON output

### Hour 0-1: Setup
- Set up Python environment, install mediapipe, opencv, numpy, scipy
- Write `capture.py` — webcam capture loop at 30fps using OpenCV
- Verify MediaPipe Face Mesh runs on the demo laptop's camera
- Test: landmarks drawing on a live video feed

### Hour 1-3: ROI Extraction
- Map MediaPipe landmark indices for forehead, left cheek, right cheek, eyes
- Write ROI extraction — polygon mask from landmarks, compute mean RGB per region
- Buffer RGB values in sliding window (deque, 15 seconds)
- Test: print RGB values per frame, verify they fluctuate slightly (that's the pulse)

### Hour 3-6: rPPG Core (CRITICAL PATH)
- Implement CHROM algorithm in `rppg.py`
  - Normalize RGB channels by mean
  - Build chrominance signals: Xs = 3R - 2G, Ys = 1.5R + G - 1.5B
  - Bandpass filter at 0.7-4.0 Hz (butterworth order 4)
  - Combine: alpha = std(Xs)/std(Ys), pulse = Xs - alpha*Ys
- Implement FFT-based heart rate extraction
- Implement peak detection for inter-beat intervals
- Test: compare your HR reading against a smartwatch or manual pulse count
- THIS IS THE MOST IMPORTANT DELIVERABLE — don't move on until HR works

### Hour 6-8: Additional Vitals
- Implement blink rate from Eye Aspect Ratio (6 eye landmarks per eye)
- Implement respiratory rate from nose tip landmark Y-coordinate oscillation
- Implement facial tension score from landmark geometry (brow distance, jaw clench)
- Build stress composite scorer (weighted fusion of all signals)
- Implement signal quality/confidence metric (FFT peak SNR)
- Write `vitals.py` — clean function: `get_vitals(frame) → dict`

### Hour 8-10: SpO2 + Robustness
- Implement SpO2 estimate from red/blue channel ratio (experimental tier)
- Add exponential moving average smoothing to all vitals
- Handle edge cases: face lost, motion artifact, poor lighting
- Suppress readings when signal quality is poor (show "calibrating")
- Test with different people, different skin tones if possible

### Hour 10-12: Integration Support
- Work with Person D to plug vitals pipeline into FastAPI backend
- Ensure `get_vitals()` returns clean JSON that matches Gemini function call schema
- Optimize for speed — pipeline must process each frame in < 30ms
- Help Person D debug any signal quality issues during integration testing

### Hour 12-18: Refinement
- Tune bandpass filter parameters based on real testing
- Tune stress composite weights
- Add baseline calibration logic (store first 30 sec averages, compute deltas)
- Build `get_session_arc()` — store timestamped vitals for end-of-session report
- Help Person C with overlay data format (which landmarks to send, pulse timing)

### Hour 18-24: Demo Support
- Test pipeline under demo conditions (venue lighting, ring light)
- Validate accuracy with 2-3 different test subjects
- On standby for any signal processing bugs during rehearsals

### Deliverables
```
capture.py      → Webcam + MediaPipe face mesh + ROI extraction
rppg.py         → CHROM algorithm + signal processing
vitals.py       → All vital sign computations + stress composite
session_store.py → Time-series storage + baseline + session arc
```

### Key Interfaces (what Person A gives to others)
```python
# Person D calls this from the backend
def get_vitals_snapshot() -> dict:
    return {
        "heart_rate": 72,
        "heart_rate_confidence": "high",
        "hrv_rmssd": 42,
        "respiratory_rate": 16,
        "blink_rate": 18,
        "facial_tension": "relaxed",
        "stress_composite": 23,
        "spo2_estimate": "96-99%",
        "signal_quality": "good"
    }

# Person C needs this for overlay
def get_overlay_data() -> dict:
    return {
        "landmarks": [...],          # 468 face mesh points
        "pulse_peak_detected": True,  # For syncing pulse animation
        "current_hr": 72,
        "stress_level": "low",        # For color coding
        "roi_polygons": {             # For showing ROI regions
            "forehead": [...],
            "left_cheek": [...],
            "right_cheek": [...]
        }
    }
```

---

## Person B: Gemini Engineer

**Owns:** Everything related to Gemini Live API — session, voice, function calling, agent behavior

### Hour 0-1: Setup
- Install google-genai SDK, pyaudio
- Get GOOGLE_API_KEY configured
- Test basic Gemini text API call to confirm key works
- Read Gemini Live API docs thoroughly (ai.google.dev/gemini-api/docs/live)

### Hour 1-4: Basic Voice Loop (CRITICAL PATH)
- Establish Gemini Live WebSocket session
- Get mic audio capture working (16kHz PCM mono via pyaudio)
- Stream mic audio to Gemini session
- Receive audio output from Gemini, play through speaker (24kHz)
- Test: have a full voice conversation with Gemini
- Handle barge-in (interrupt Gemini mid-sentence)
- THIS MUST WORK before anything else — it's the foundation

### Hour 4-6: System Instruction + Persona
- Write and refine the VitalSense system instruction (use project plan as base)
- Test different voice options (Kore, Leda, Puck) — pick warmest/calmest
- Enable affective dialog for emotional tone adaptation
- Test: Gemini should sound like a calm wellness agent, not a generic assistant
- Iterate on system instruction wording until personality feels right

### Hour 6-9: Function Calling
- Define function call schemas:
  - `get_vitals_snapshot()` — current readings
  - `get_baseline_comparison()` — deviation from baseline
  - `get_session_arc()` — full session timeline
- Register functions at session start
- Build mock vitals responses for testing (hardcoded JSON)
- Test: Gemini should proactively call `get_vitals_snapshot()` during conversation
- Verify Gemini adapts its tone when it receives high-stress vitals
- Test with mock data: send calm vitals → send stressed vitals → verify voice shifts

### Hour 9-12: Adaptive Behavior Tuning
- Test the conversation flow phases: calibration → exploration → adaptive → resolution
- Ensure Gemini doesn't over-reference vitals ("I see your heart rate is 92")
- It should feel intuitive, not clinical ("something shifted just now")
- Test interruption handling — judge talks over Gemini, it should stop gracefully
- Experiment with thinking budget config for response quality vs latency tradeoff

### Hour 12-14: Integration with Real Vitals
- Work with Person D to replace mock vitals with real pipeline data
- Wire function call handlers to actual `vitals.py` outputs
- Test: real vitals flowing into Gemini during a live conversation
- Tune vitals injection frequency (every 3-5 seconds as text context)
- Verify Gemini reacts to actual stress spikes, not just mock data

### Hour 14-18: Edge Cases + Polish
- Handle session timeout (10 min max) — graceful session end
- Handle WebSocket drops — auto-reconnect logic
- Handle audio echo — test with headphones, adjust if needed
- Implement conversation event logging (what Gemini said at each timestamp)
  - Person C needs this for the session arc annotations
- Test with Person D: full end-to-end conversation with real vitals

### Hour 18-24: Demo Prep
- Practice the demo conversation flow 5+ times
- Prepare fallback questions if Gemini goes off-script
- Tune system instruction based on rehearsal observations
- On standby for any Gemini-related issues during rehearsals

### Deliverables
```
gemini_session.py   → Live API connection, session management, audio I/O
function_tools.py   → Function call definitions + handler routing
config.py           → System instruction, model config, voice selection
```

### Key Interfaces (what Person B gives/needs)
```python
# Person B needs this FROM Person A (via Person D)
# When Gemini calls get_vitals_snapshot(), D routes to A's vitals.py

# Person B gives this TO Person C (via Person D)
def get_conversation_events() -> list:
    return [
        {"timestamp": 62, "type": "gemini_spoke", "text": "Tell me about a challenge..."},
        {"timestamp": 95, "type": "stress_detected", "vitals": {...}},
        {"timestamp": 98, "type": "gemini_adapted", "text": "I sense something shifted..."},
    ]

# Person B gives this TO Person D
# Audio output stream → D forwards to frontend for playback
```

---

## Person C: Frontend Engineer

**Owns:** React UI, AR overlay, vitals dashboard, session arc visualization

### Hour 0-1: Setup
- Create React app with Vite
- Install socket.io-client, recharts, tailwind
- Set up basic app shell with dark theme
- Connect Socket.IO to Person D's backend (even if backend isn't ready, set up the client)

### Hour 1-4: Camera Feed + Basic Overlay
- Implement webcam display using getUserMedia
- Set up dual canvas: video layer + transparent overlay layer
- Receive landmark data from backend via WebSocket
- Draw face mesh wireframe on overlay canvas (thin lines, cyan/blue tint)
- Test with mock landmark data first, then real data from Person D

### Hour 4-8: AR Overlay — Vitals Visualization
- Build pulsing heart animation synced to heartbeat events from backend
  - Opacity pulse or scale pulse on each detected beat
  - Use requestAnimationFrame for smooth 60fps animation
- Color-code the face mesh based on stress level:
  - Green (calm) → Yellow (mild) → Orange (elevated) → Red (high stress)
  - Smooth color transition, not abrupt jumps
- Display live vitals as floating labels near the face:
  - HR with BPM near top-left
  - Stress score near top-right
  - Respiratory rate smaller, below HR
- Show ROI regions highlighted (subtle glow on forehead/cheeks)
- Add "signal quality" indicator (green dot = good, yellow = fair, hidden = poor)

### Hour 8-12: Vitals Dashboard Panel
- Build side panel or bottom bar showing:
  - Real-time HR graph (last 60 seconds, rolling line chart with recharts)
  - Stress composite gauge (0-100, color-coded arc)
  - Blink rate number
  - Respiratory rate number
  - Phase indicator (CALIBRATING → CONVERSATION → ADAPTING)
- Add smooth number transitions (count up/down animation, not jumps)
- Make it look polished — this is what the audience stares at during the demo

### Hour 12-16: Session Arc Screen
- Build the end-of-session visualization:
  - Timeline chart (X = time, Y = HR and stress as dual lines)
  - Annotated markers at key moments (Gemini's questions, stress spikes, adaptations)
  - AI-generated narrative text below the chart
- Transition animation from live view → session arc view
- Make it visually striking — this is the closing shot of the demo

### Hour 16-18: Audio Integration
- Implement Web Audio API for playing Gemini's voice output
  - Receive audio chunks from backend via WebSocket
  - Buffer and play smoothly (handle jitter)
- Add visual audio waveform or speaking indicator when Gemini is talking
- Handle mic permissions in browser

### Hour 18-20: Polish + Responsive
- Add start screen / landing state before session begins
- Add calibration progress bar (0-30 seconds with "establishing baseline...")
- Smooth all transitions and animations
- Dark theme fine-tuning — the demo should look premium on a projector
- Test on the actual demo laptop screen resolution

### Hour 20-24: Demo Prep
- Test full flow: start → calibrate → conversation → arc reveal
- Fix any visual glitches
- Ensure overlay performs well (no frame drops in canvas rendering)
- Optimize bundle size if needed for fast load

### Deliverables
```
App.jsx              → Main shell, routing between live/arc views
CameraFeed.jsx       → Webcam display + frame sending to backend
AROverlay.jsx        → Canvas overlay (mesh, pulse, color, labels)
VitalsDashboard.jsx  → Side panel with real-time charts/numbers
SessionArc.jsx       → End-of-session timeline + narrative
Controls.jsx         → Start/stop/calibrate buttons
useSocket.js         → Socket.IO hook
useAudio.js          → Web Audio API hook for Gemini voice playback
overlayRenderer.js   → Canvas drawing utilities
```

### Key Interfaces (what Person C needs from others)
```javascript
// FROM Person D via WebSocket — every frame (~30fps)
socket.on('overlay_data', {
  landmarks: [[x, y, z], ...],     // 468 points, normalized 0-1
  pulse_peak: true/false,           // Sync heartbeat animation
  roi_polygons: { forehead: [...], ... }
});

// FROM Person D via WebSocket — every 1 second
socket.on('vitals_update', {
  heart_rate: 72,
  stress_composite: 23,
  respiratory_rate: 16,
  blink_rate: 18,
  stress_level: "low",              // For color coding
  signal_quality: "good",
  phase: "conversation"             // calibrating | conversation | adapting
});

// FROM Person D via WebSocket — streaming
socket.on('audio_chunk', ArrayBuffer);  // Gemini voice output

// FROM Person D via WebSocket — session end
socket.on('session_arc', {
  vitals_timeline: [{ t, hr, stress }],
  events: [{ t, type, text }],
  narrative: "At 1:02, heart rate elevated..."
});
```

---

## Person D: Integration Engineer & Demo Lead

**Owns:** FastAPI backend, WebSocket bridge, async orchestration, and the overall demo

### Hour 0-2: Backend Skeleton
- Set up FastAPI with uvicorn
- Set up python-socketio for real-time communication with frontend
- Create WebSocket endpoint for receiving video frames from browser
- Create WebSocket endpoint for sending vitals/landmarks to browser
- Create WebSocket endpoint for audio streaming (Gemini → browser)
- Test: browser connects, sends a frame, backend acknowledges

### Hour 2-4: Camera Pipeline Integration
- Wire Person A's `capture.py` into the backend
  - Option 1: Backend captures from webcam directly (simpler)
  - Option 2: Frontend sends frames via WebSocket (more flexible for web deploy)
- Decide on architecture — recommend Option 1 for hackathon simplicity
- Set up async frame processing loop:
  - Capture frame → pass to Person A's pipeline → get vitals + landmarks
  - Send landmarks to frontend at 30fps for overlay
  - Send vitals to frontend at 1Hz for dashboard
- Test: vitals JSON printing in console as someone sits in front of camera

### Hour 4-6: Audio Bridge
- Set up mic capture (pyaudio, 16kHz PCM) on backend
- Set up speaker output or WebSocket audio streaming to frontend
- Create audio queue system:
  - Mic → queue → Gemini session
  - Gemini output → queue → speaker/frontend
- Test: audio round-trip works (speak into mic, hear Gemini respond)

### Hour 6-9: Gemini Integration Wiring
- Wire Person B's `gemini_session.py` into the backend
- Route function calls: when Gemini calls `get_vitals_snapshot()`,
  pull from Person A's `vitals.py` and return the response
- Set up vitals injection: every 3-5 seconds, send current vitals
  as a text message into the Gemini session alongside audio
- Build session state manager:
  - Track phase (calibrating → conversation → adapting → closing)
  - Store baseline values after calibration
  - Log conversation events with timestamps
- Test: full loop — person speaks, vitals computed, Gemini responds with awareness

### Hour 9-12: End-to-End Integration
- Run the complete pipeline end-to-end
- Debug async issues:
  - Frame processing blocking audio? → separate threads
  - Audio queue backing up? → adjust buffer sizes
  - Vitals lagging? → check processing bottleneck
- Ensure all WebSocket channels work simultaneously:
  - Landmarks → frontend (30fps)
  - Vitals → frontend (1Hz)
  - Audio → frontend (streaming)
  - Conversation events → frontend (on each Gemini turn)
- Test: person sits down, sees overlay, hears Gemini, metrics update live

### Hour 12-16: Robustness
- Implement graceful error handling:
  - Camera disconnects → show message, attempt reconnect
  - Gemini session drops → auto-reconnect, resume conversation
  - MediaPipe loses face → suppress vitals, show "calibrating"
- Implement session lifecycle:
  - Start button → open camera + start Gemini session
  - Calibration phase → 30 seconds, lock baseline
  - Active phase → conversation with vitals
  - End button → close session, trigger arc generation
- Add logging throughout for debugging

### Hour 16-18: Session Arc Generation
- At session end, compile:
  - Full vitals time-series from Person A's `session_store.py`
  - Conversation events from Person B's event log
  - Merge into annotated timeline
- Call Gemini text API to generate narrative summary
- Send compiled session arc data to frontend

### Hour 18-20: Demo Environment Setup
- Set up ring light and camera positioning
- Lock camera exposure if possible
- Test in conditions as close to venue as possible
- Prepare `.env` with all API keys
- Create one-command startup script: `./start.sh` that launches backend + frontend

### Hour 20-24: Demo Lead Duties
- Run 5+ full rehearsals with team as test subjects
- Time the demo to exactly 3 minutes
- Identify and fix any reliability issues
- Prepare backup: pre-recorded video of a successful run
- Write judge-facing one-pager / README
- Lead the actual demo presentation

### Deliverables
```
main.py          → FastAPI app, all WebSocket endpoints, session lifecycle
config.py        → Shared configuration (ports, API keys, constants)
start.sh         → One-command launch script
requirements.txt → All Python dependencies
README.md        → Setup instructions + project summary for judges
```

### Key Interfaces (what Person D manages)
```
Frontend ←WebSocket→ Backend ←Pipeline→ Vision (Person A)
                            ←WebSocket→ Gemini (Person B)

D is the router:
  Frame in → A processes → vitals out → B's Gemini + C's frontend
  Mic in → B's Gemini → audio out → C's frontend speaker
  B's events → C's session arc
```

---

## Dependency Graph

```
Hour 0-6: PARALLEL WORK (no blockers)
├── Person A: MediaPipe + rPPG → outputs vitals JSON
├── Person B: Gemini Live → outputs voice conversation
├── Person C: React + overlay → consumes mock data
└── Person D: FastAPI skeleton → WebSocket endpoints ready

Hour 6-12: INTEGRATION BEGINS
├── D wires A's vitals into the backend
├── D wires B's Gemini session into the backend  
├── D starts sending real data to C's frontend
├── A + D debug signal quality together
└── B + D debug function calling together

Hour 12-18: POLISH (everyone has working pieces)
├── A: tunes algorithms, handles edge cases
├── B: tunes Gemini personality, conversation flow
├── C: polishes overlay, builds session arc
└── D: robustness, error handling, session lifecycle

Hour 18-24: DEMO PREP (all hands)
├── Everyone: full rehearsals together
├── D: leads demo, manages timing
├── C: fixes any visual issues live
└── A + B: on standby for pipeline/Gemini fixes
```

---

## Communication Protocol During Hackathon

### Sync Points (mandatory check-ins)
- **Hour 3:** "Does your piece work independently?" (all four)
- **Hour 6:** "Ready to integrate?" (A + B confirm to D)
- **Hour 9:** "End-to-end working?" (D confirms to all)
- **Hour 12:** "What's broken?" (everyone flags issues)
- **Hour 18:** "Demo rehearsal #1" (full team)
- **Hour 21:** "Demo rehearsal #2" (full team)
- **Hour 23:** "Final rehearsal" (full team)

### Shared Contracts (agree on these BEFORE coding)
```
1. Vitals JSON schema → A and D agree at Hour 0
2. WebSocket event names → C and D agree at Hour 0
3. Gemini function call schemas → B and D agree at Hour 0
4. Everyone uses the same Python 3.11 + Node 18+ versions
5. Single shared .env file for API keys
6. Git repo with clear branch per person, merge to main at integration
```

### Slack/Discord Channel Structure
```
#general        — coordination, blockers, decisions
#vision         — Person A's signal processing questions
#gemini         — Person B's API issues
#frontend       — Person C's UI questions  
#integration    — Person D's wiring issues (everyone watches this)
```

---

## If Someone Finishes Early

**Person A finishes early →** Help D with integration testing, or add video 
feed to Gemini session (send 1fps webcam frames for behavioral observation)

**Person B finishes early →** Write the narrative generation prompt for 
session arc, or experiment with Gemini video input for richer behavioral analysis

**Person C finishes early →** Build a landing page / pitch slide, or add 
screen recording capability for backup demo video

**Person D finishes early →** Help whoever is behind, or build the 
one-command deploy script and README for judges

---

## Minimum Viable Demo (if things go wrong)

If at Hour 18 the full pipeline isn't working, here's the stripped-down version:

```
MUST HAVE (non-negotiable):
✓ MediaPipe face overlay on webcam feed
✓ Live heart rate number on screen
✓ Gemini voice conversation happening
✓ At least one visible moment where Gemini reacts to a vitals change

NICE TO HAVE (cut if behind):
○ Full stress composite (just show HR is fine)
○ Session arc visualization (skip, just end the conversation)
○ SpO2 estimate (skip entirely)
○ Polished AR animation (static overlay is fine)
○ Blink rate / respiratory rate (skip, HR is enough)
```

The core demo is: "person's heartbeat visible on screen + AI voice adapts to stress." 
Everything else is polish that makes it better, but the core is enough to win.