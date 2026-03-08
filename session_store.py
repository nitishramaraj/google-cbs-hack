"""
session_store.py -- Time-series storage, baseline calibration, session arc.
"""

import threading
import time
from typing import Dict, List, Optional


class SessionStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._readings: List[Dict] = []
        self._start_time: Optional[float] = None
        self._calibrating = False
        self._calibration_start: Optional[float] = None
        self._baseline: Optional[Dict] = None

    def start(self) -> None:
        with self._lock:
            self._start_time = time.time()
            self._readings = []
            self._baseline = None

    def start_calibration(self) -> None:
        with self._lock:
            self._calibrating = True
            self._calibration_start = time.time()

    def end_calibration(self) -> None:
        with self._lock:
            self._calibrating = False
            if not self._readings:
                self._baseline = {}
                return

            keys = ["heart_rate", "hrv_rmssd", "respiratory_rate",
                    "blink_rate", "stress_composite"]
            baseline = {}
            for key in keys:
                values = [r["vitals"].get(key) for r in self._readings
                          if r["vitals"].get(key) is not None]
                if values:
                    baseline[key] = sum(values) / len(values)
            self._baseline = baseline

    def is_calibrating(self) -> bool:
        with self._lock:
            return self._calibrating

    def add_reading(self, vitals: Dict) -> None:
        with self._lock:
            self._readings.append({
                "timestamp": time.time(),
                "elapsed": time.time() - self._start_time if self._start_time else 0,
                "vitals": vitals.copy(),
            })

    def get_baseline_comparison(self) -> Dict:
        with self._lock:
            if not self._baseline or not self._readings:
                return {"status": "no_baseline"}

            latest = self._readings[-1]["vitals"]
            comparison = {}
            for key, base_val in self._baseline.items():
                current = latest.get(key)
                if current is not None and base_val is not None and base_val != 0:
                    deviation = ((current - base_val) / base_val) * 100
                    comparison[key] = {
                        "baseline": round(base_val, 1),
                        "current": round(current, 1),
                        "deviation_pct": round(deviation, 1),
                    }
            return comparison

    def get_session_arc(self) -> Dict:
        with self._lock:
            if not self._readings:
                return {"vitals_timeline": [], "duration_seconds": 0,
                        "baseline": {}, "peaks": []}

            timeline = []
            for r in self._readings:
                timeline.append({
                    "t": round(r["elapsed"], 1),
                    "hr": r["vitals"].get("heart_rate"),
                    "stress": r["vitals"].get("stress_composite"),
                    "rr": r["vitals"].get("respiratory_rate"),
                    "hrv": r["vitals"].get("hrv_rmssd"),
                })

            duration = self._readings[-1]["elapsed"] if self._readings else 0

            # Find stress peaks
            peaks = []
            stress_vals = [(r["elapsed"], r["vitals"].get("stress_composite", 0))
                           for r in self._readings
                           if r["vitals"].get("stress_composite") is not None]
            if stress_vals:
                avg_stress = sum(s for _, s in stress_vals) / len(stress_vals)
                for t, s in stress_vals:
                    if s > avg_stress * 1.3:
                        peaks.append({"t": round(t, 1), "stress": round(s, 1)})

            return {
                "vitals_timeline": timeline,
                "duration_seconds": round(duration, 1),
                "baseline": self._baseline or {},
                "peaks": peaks,
            }

    def reset(self) -> None:
        with self._lock:
            self._readings = []
            self._start_time = None
            self._calibrating = False
            self._calibration_start = None
            self._baseline = None
