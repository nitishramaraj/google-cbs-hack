"""
vitals.py -- All vital sign computations with research-backed accuracy improvements.

Improvements over baseline:
- Forehead-weighted ROI (60% forehead, 20% each cheek)
- Motion gating via landmark displacement
- Bandpass-filtered SpO2 ratio computation
- Multi-landmark respiratory rate
- Temporal consistency checks
"""

import collections
import math
import threading
import time
from typing import Optional, Dict, List, Tuple

import numpy as np
from scipy.signal import butter, filtfilt, detrend

from rppg import RPPGProcessor


class VitalsProcessor:
    LEFT_EYE = [362, 385, 387, 263, 373, 380]
    RIGHT_EYE = [33, 160, 158, 133, 153, 144]
    NOSE_LANDMARKS = [1, 2, 4, 5]  # Multiple nose landmarks for respiratory rate

    def __init__(self, fps: int = 30) -> None:
        self._fps = fps
        self._lock = threading.Lock()
        self._rppg = RPPGProcessor(fps=fps, window_seconds=10)

        # Buffers
        self._rgb_buffer: collections.deque = collections.deque(maxlen=fps * 15)
        self._nose_y_buffers: Dict[int, collections.deque] = {
            lm: collections.deque(maxlen=fps * 15) for lm in self.NOSE_LANDMARKS
        }
        self._blink_times: collections.deque = collections.deque(maxlen=100)
        self._ear_prev = 1.0
        self._blink_cooldown = 0

        # Motion tracking
        self._prev_landmarks = None
        self._motion_scores: collections.deque = collections.deque(maxlen=30)

        # SpO2 buffers
        self._red_buffer: collections.deque = collections.deque(maxlen=fps * 10)
        self._blue_buffer: collections.deque = collections.deque(maxlen=fps * 10)

        # EMA smoothed values
        self._ema_alpha = 0.2  # Smoother than 0.3
        self._hr_ema = None
        self._hrv_ema = None
        self._rr_ema = None
        self._blink_ema = None
        self._stress_ema = None
        self._tension_ema = None
        self._spo2_ema = None

        # State
        self._last_landmarks = None
        self._last_pulse_peak = False
        self._signal_quality = "poor"
        self._frame_count = 0

        # Respiratory bandpass (0.1-0.5 Hz = 6-30 breaths/min)
        nyq = fps / 2.0
        low = max(0.1 / nyq, 0.001)
        high = min(0.5 / nyq, 0.99)
        if low < high:
            self._resp_b, self._resp_a = butter(3, [low, high], btype='band')
        else:
            self._resp_b, self._resp_a = None, None

        # SpO2 bandpass (centered on typical HR range)
        spo2_low = max(0.65 / nyq, 0.001)
        spo2_high = min(3.5 / nyq, 0.99)
        if spo2_low < spo2_high:
            self._spo2_b, self._spo2_a = butter(4, [spo2_low, spo2_high], btype='band')
        else:
            self._spo2_b, self._spo2_a = None, None

    def _ema(self, prev: Optional[float], new: float) -> float:
        if prev is None:
            return new
        return self._ema_alpha * new + (1 - self._ema_alpha) * prev

    @staticmethod
    def _eye_aspect_ratio(landmarks: list, eye_indices: List[int]) -> float:
        p = [np.array([landmarks[i][0], landmarks[i][1]]) for i in eye_indices]
        v1 = np.linalg.norm(p[1] - p[5])
        v2 = np.linalg.norm(p[2] - p[4])
        h = np.linalg.norm(p[0] - p[3])
        if h == 0:
            return 1.0
        return (v1 + v2) / (2.0 * h)

    def _compute_motion_score(self, landmarks: list) -> float:
        """Compute average landmark displacement between frames."""
        if self._prev_landmarks is None:
            return 0.0
        displacements = []
        # Sample key stable landmarks (forehead, nose bridge)
        key_indices = [10, 151, 9, 8, 168, 6, 197, 195]
        for idx in key_indices:
            if idx < len(landmarks) and idx < len(self._prev_landmarks):
                dx = landmarks[idx][0] - self._prev_landmarks[idx][0]
                dy = landmarks[idx][1] - self._prev_landmarks[idx][1]
                displacements.append(math.sqrt(dx * dx + dy * dy))
        return sum(displacements) / len(displacements) if displacements else 0.0

    def _compute_respiratory_rate(self) -> Optional[float]:
        """Multi-landmark respiratory rate estimation."""
        if self._resp_b is None:
            return None

        # Average Y-displacement across multiple nose landmarks
        signals = []
        for lm_idx in self.NOSE_LANDMARKS:
            buf = self._nose_y_buffers[lm_idx]
            if len(buf) >= self._fps * 5:
                signals.append(np.array(list(buf)))

        if not signals:
            return None

        # Average the signals for noise reduction
        min_len = min(len(s) for s in signals)
        avg_signal = np.mean([s[:min_len] for s in signals], axis=0)

        try:
            # Detrend then filter
            avg_signal = detrend(avg_signal)
            filtered = filtfilt(self._resp_b, self._resp_a, avg_signal)
        except ValueError:
            return None

        n = len(filtered)
        fft_vals = np.abs(np.fft.rfft(filtered * np.hanning(n)))
        freqs = np.fft.rfftfreq(n, d=1.0 / self._fps)
        valid = (freqs >= 0.1) & (freqs <= 0.5)
        if not np.any(valid):
            return None

        fft_valid = fft_vals[valid]
        freqs_valid = freqs[valid]
        peak_freq = freqs_valid[np.argmax(fft_valid)]
        return round(peak_freq * 60.0, 1)

    def _compute_facial_tension(self, landmarks: list) -> float:
        # Brow distance (landmarks 66 and 296)
        brow_l = np.array([landmarks[66][0], landmarks[66][1]])
        brow_r = np.array([landmarks[296][0], landmarks[296][1]])
        brow_dist = np.linalg.norm(brow_l - brow_r)

        # Jaw openness (landmarks 13 top lip, 14 bottom lip)
        lip_top = np.array([landmarks[13][0], landmarks[13][1]])
        lip_bot = np.array([landmarks[14][0], landmarks[14][1]])
        jaw_open = np.linalg.norm(lip_top - lip_bot)

        # Normalize by face width
        face_l = np.array([landmarks[234][0], landmarks[234][1]])
        face_r = np.array([landmarks[454][0], landmarks[454][1]])
        face_width = np.linalg.norm(face_l - face_r)
        if face_width == 0:
            return 50.0

        brow_ratio = brow_dist / face_width
        jaw_ratio = jaw_open / face_width
        tension = (1.0 - brow_ratio) * 60 + jaw_ratio * 40
        return max(0, min(100, tension))

    def _compute_spo2(self) -> Optional[float]:
        """Bandpass-filtered SpO2 estimation using R and B channels."""
        if self._spo2_b is None:
            return None
        if len(self._red_buffer) < self._fps * 5:
            return None

        red = np.array(list(self._red_buffer))
        blue = np.array(list(self._blue_buffer))

        r_dc = np.mean(red)
        b_dc = np.mean(blue)
        if r_dc == 0 or b_dc == 0:
            return None

        # Bandpass filter to extract AC component at pulse frequency
        try:
            r_ac_signal = filtfilt(self._spo2_b, self._spo2_a, red)
            b_ac_signal = filtfilt(self._spo2_b, self._spo2_a, blue)
        except ValueError:
            return None

        # AC as peak-to-trough amplitude (more accurate than std)
        from scipy.signal import find_peaks
        r_peaks, _ = find_peaks(r_ac_signal, distance=int(self._fps * 0.4))
        r_troughs, _ = find_peaks(-r_ac_signal, distance=int(self._fps * 0.4))

        if len(r_peaks) < 2 or len(r_troughs) < 2:
            # Fallback to std-based
            r_ac = np.std(r_ac_signal)
            b_ac = np.std(b_ac_signal)
        else:
            r_ac = np.mean(r_ac_signal[r_peaks]) - np.mean(r_ac_signal[r_troughs])
            b_peaks, _ = find_peaks(b_ac_signal, distance=int(self._fps * 0.4))
            b_troughs, _ = find_peaks(-b_ac_signal, distance=int(self._fps * 0.4))
            if len(b_peaks) >= 2 and len(b_troughs) >= 2:
                b_ac = np.mean(b_ac_signal[b_peaks]) - np.mean(b_ac_signal[b_troughs])
            else:
                b_ac = np.std(b_ac_signal)

        if b_ac == 0:
            return None

        ratio = (r_ac / r_dc) / (b_ac / b_dc)
        # Calibration constants (common starting values for RGB webcam)
        spo2 = 104 - 17 * ratio
        return max(90, min(100, round(spo2, 1)))

    def process_frame(self, frame, face_landmarks: Optional[list]) -> None:
        with self._lock:
            self._frame_count += 1
            if face_landmarks is None:
                self._last_landmarks = None
                self._signal_quality = "poor"
                self._prev_landmarks = None
                return

            self._last_landmarks = face_landmarks

            # Motion gating
            motion = self._compute_motion_score(face_landmarks)
            self._motion_scores.append(motion)
            self._prev_landmarks = face_landmarks

            # Nose tip Y for respiratory rate (multiple landmarks)
            for lm_idx in self.NOSE_LANDMARKS:
                if lm_idx < len(face_landmarks):
                    self._nose_y_buffers[lm_idx].append(face_landmarks[lm_idx][1])

            # Blink detection
            ear_l = self._eye_aspect_ratio(face_landmarks, self.LEFT_EYE)
            ear_r = self._eye_aspect_ratio(face_landmarks, self.RIGHT_EYE)
            ear = (ear_l + ear_r) / 2.0

            if self._blink_cooldown > 0:
                self._blink_cooldown -= 1
            elif ear < 0.21 and self._ear_prev >= 0.21:
                self._blink_times.append(time.time())
                self._blink_cooldown = int(self._fps * 0.15)
            self._ear_prev = ear

    def add_rgb_sample(self, rgb: Tuple[float, float, float]) -> None:
        with self._lock:
            # Motion gating: skip samples during high motion
            avg_motion = sum(self._motion_scores) / len(self._motion_scores) if self._motion_scores else 0
            if avg_motion < 3.0:  # Only add if motion is low (< 3 pixels)
                self._rgb_buffer.append(rgb)
                self._red_buffer.append(rgb[0])
                self._blue_buffer.append(rgb[2])

    def get_vitals_snapshot(self) -> Dict:
        with self._lock:
            if self._last_landmarks is None or len(self._rgb_buffer) < self._fps * 4:
                return {
                    "heart_rate": None, "heart_rate_confidence": "calibrating",
                    "hrv_rmssd": None, "respiratory_rate": None,
                    "blink_rate": None, "facial_tension": "calibrating",
                    "stress_composite": None, "spo2_estimate": "calibrating",
                    "signal_quality": "calibrating",
                }

            # rPPG
            rppg_result = self._rppg.process(list(self._rgb_buffer))
            hr = rppg_result["heart_rate"]
            hrv = rppg_result["hrv_rmssd"]
            self._signal_quality = rppg_result["signal_quality"]
            self._last_pulse_peak = len(rppg_result["pulse_peaks"]) > 0

            if hr is not None:
                self._hr_ema = self._ema(self._hr_ema, hr)
            if hrv is not None:
                self._hrv_ema = self._ema(self._hrv_ema, hrv)

            # Respiratory rate
            rr = self._compute_respiratory_rate()
            if rr is not None:
                self._rr_ema = self._ema(self._rr_ema, rr)

            # Blink rate
            now = time.time()
            recent_blinks = [t for t in self._blink_times if now - t < 60]
            blink_rate = len(recent_blinks)
            self._blink_ema = self._ema(self._blink_ema, float(blink_rate))

            # Facial tension
            tension = self._compute_facial_tension(self._last_landmarks)
            self._tension_ema = self._ema(self._tension_ema, tension)

            # SpO2
            spo2 = self._compute_spo2()
            if spo2 is not None:
                self._spo2_ema = self._ema(self._spo2_ema, spo2)

            # Stress composite
            stress = self._compute_stress()
            if stress is not None:
                self._stress_ema = self._ema(self._stress_ema, stress)

            # Confidence
            confidence = "high" if self._signal_quality == "good" else (
                "medium" if self._signal_quality == "fair" else "low")

            # Tension label
            t_val = self._tension_ema or 50
            tension_label = "relaxed" if t_val < 35 else ("mild" if t_val < 60 else "tense")

            # SpO2 label
            spo2_label = f"{int(self._spo2_ema)}%" if self._spo2_ema else "calibrating"

            return {
                "heart_rate": round(self._hr_ema) if self._hr_ema else None,
                "heart_rate_confidence": confidence,
                "hrv_rmssd": round(self._hrv_ema, 1) if self._hrv_ema else None,
                "respiratory_rate": round(self._rr_ema) if self._rr_ema else None,
                "blink_rate": round(self._blink_ema) if self._blink_ema else None,
                "facial_tension": tension_label,
                "stress_composite": round(self._stress_ema) if self._stress_ema else None,
                "spo2_estimate": spo2_label,
                "signal_quality": self._signal_quality,
            }

    def _compute_stress(self) -> Optional[float]:
        components = []
        weights = []

        if self._hr_ema is not None:
            hr_dev = abs(self._hr_ema - 72) / 40 * 100
            components.append(min(100, hr_dev))
            weights.append(0.4)

        if self._hrv_ema is not None:
            hrv_norm = max(0, min(100, 100 - self._hrv_ema))
            components.append(hrv_norm)
            weights.append(0.25)

        if self._blink_ema is not None:
            blink_dev = abs(self._blink_ema - 17) / 15 * 100
            components.append(min(100, blink_dev))
            weights.append(0.15)

        if self._rr_ema is not None:
            rr_dev = abs(self._rr_ema - 16) / 10 * 100
            components.append(min(100, rr_dev))
            weights.append(0.1)

        if self._tension_ema is not None:
            components.append(self._tension_ema)
            weights.append(0.1)

        if not components:
            return None

        total_weight = sum(weights)
        stress = sum(c * w for c, w in zip(components, weights)) / total_weight
        return max(0, min(100, stress))

    def get_overlay_data(self) -> Dict:
        with self._lock:
            if self._last_landmarks is None:
                return {
                    "landmarks": [], "pulse_peak_detected": False,
                    "current_hr": None, "stress_level": "unknown",
                    "roi_polygons": {"forehead": [], "left_cheek": [], "right_cheek": []},
                }

            stress_val = self._stress_ema or 0
            if stress_val < 25:
                level = "low"
            elif stress_val < 50:
                level = "mild"
            elif stress_val < 75:
                level = "elevated"
            else:
                level = "high"

            landmarks_list = [[lm[0], lm[1], lm[2]] for lm in self._last_landmarks]

            from capture import FOREHEAD_LANDMARKS, LEFT_CHEEK_LANDMARKS, RIGHT_CHEEK_LANDMARKS
            roi = {
                "forehead": [[int(self._last_landmarks[i][0]), int(self._last_landmarks[i][1])]
                             for i in FOREHEAD_LANDMARKS if i < len(self._last_landmarks)],
                "left_cheek": [[int(self._last_landmarks[i][0]), int(self._last_landmarks[i][1])]
                               for i in LEFT_CHEEK_LANDMARKS if i < len(self._last_landmarks)],
                "right_cheek": [[int(self._last_landmarks[i][0]), int(self._last_landmarks[i][1])]
                                for i in RIGHT_CHEEK_LANDMARKS if i < len(self._last_landmarks)],
            }

            return {
                "landmarks": landmarks_list,
                "pulse_peak_detected": self._last_pulse_peak,
                "current_hr": round(self._hr_ema) if self._hr_ema else None,
                "stress_level": level,
                "roi_polygons": roi,
            }
