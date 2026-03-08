"""
rppg.py -- CHROM + POS dual-algorithm rPPG with overlap-add windowing.

Based on:
- de Haan & Jeanne (2013) - CHROM algorithm
- Wang et al. (2017) - POS algorithm
- Best practices from rPPG literature for accuracy
"""

import numpy as np
from scipy.signal import butter, filtfilt, find_peaks, detrend
from typing import Dict, Optional, List, Tuple


class RPPGProcessor:
    def __init__(self, fps: int = 30, window_seconds: int = 10) -> None:
        self._fps = fps
        self._window_size = fps * window_seconds
        self._min_samples = fps * 4  # 4 seconds minimum for any estimate

        # Segment size for overlap-add (1.6 seconds per CHROM paper)
        self._segment_len = int(fps * 1.6)
        self._segment_stride = self._segment_len // 2  # 50% overlap

        # Wide bandpass for HR estimation: 0.65-3.5 Hz (39-210 BPM)
        nyq = fps / 2.0
        low = 0.65 / nyq
        high = min(3.5 / nyq, 0.99)
        self._b_wide, self._a_wide = butter(6, [low, high], btype='band')

        # Previous HR for temporal consistency
        self._prev_hr: Optional[float] = None

    def process(self, rgb_buffer: list, weights: Optional[list] = None) -> Dict:
        """Process RGB buffer using dual CHROM+POS and return heart rate info.

        Args:
            rgb_buffer: list of (R, G, B) tuples
            weights: optional per-sample quality weights (0-1)
        """
        result = {
            "heart_rate": None,
            "hrv_rmssd": None,
            "signal_quality": "poor",
            "pulse_peaks": [],
            "pulse_signal": [],
        }

        if len(rgb_buffer) < self._min_samples:
            return result

        rgb = np.array(rgb_buffer[-self._window_size:], dtype=np.float64)
        if rgb.shape[0] < self._min_samples:
            return result

        # Step 1: Detrend each channel to remove slow baseline drift
        r = detrend(rgb[:, 0])
        g = detrend(rgb[:, 1])
        b = detrend(rgb[:, 2])

        # Add back means for normalization
        r += rgb[:, 0].mean()
        g += rgb[:, 1].mean()
        b += rgb[:, 2].mean()

        n = len(r)

        # Step 2: Overlap-add CHROM
        chrom_signal = self._chrom_overlap_add(r, g, b, n)

        # Step 3: POS algorithm
        pos_signal = self._pos_overlap_add(r, g, b, n)

        # Step 4: Bandpass filter both signals
        try:
            chrom_filtered = filtfilt(self._b_wide, self._a_wide, chrom_signal)
            pos_filtered = filtfilt(self._b_wide, self._a_wide, pos_signal)
        except ValueError:
            return result

        # Step 5: Compute SNR for both, pick better one
        chrom_hr, chrom_snr = self._fft_heart_rate(chrom_filtered)
        pos_hr, pos_snr = self._fft_heart_rate(pos_filtered)

        if chrom_snr >= pos_snr and chrom_hr is not None:
            pulse_signal = chrom_filtered
            heart_rate = chrom_hr
            snr = chrom_snr
        elif pos_hr is not None:
            pulse_signal = pos_filtered
            heart_rate = pos_hr
            snr = pos_snr
        else:
            return result

        # Step 6: Temporal consistency check
        if self._prev_hr is not None and heart_rate is not None:
            jump = abs(heart_rate - self._prev_hr)
            if jump > 15:
                # Large jump — blend with previous
                heart_rate = 0.3 * heart_rate + 0.7 * self._prev_hr
        self._prev_hr = heart_rate

        # Step 7: Signal quality assessment
        if snr > 0.25:
            quality = "good"
        elif snr > 0.12:
            quality = "fair"
        else:
            quality = "poor"

        # Step 8: Peak detection for HRV
        # Use narrow bandpass centered on detected HR for cleaner peaks
        hrv_rmssd = None
        pulse_peaks = []
        if heart_rate is not None and quality != "poor":
            narrow_signal = self._narrow_bandpass(pulse_signal, heart_rate)
            if narrow_signal is not None:
                min_distance = int(self._fps * 60 / (heart_rate + 30))  # adaptive
                peaks, _ = find_peaks(narrow_signal, distance=max(5, min_distance), height=0)
                pulse_peaks = peaks.tolist()

                if len(peaks) >= 3:
                    ibis = np.diff(peaks) / self._fps * 1000  # ms
                    # Filter out physiologically impossible IBIs
                    ibis = ibis[(ibis > 300) & (ibis < 1500)]
                    if len(ibis) >= 2:
                        successive_diffs = np.diff(ibis)
                        hrv_rmssd = float(np.sqrt(np.mean(successive_diffs ** 2)))

        # Normalize pulse signal for output
        pulse_std = np.std(pulse_signal)
        if pulse_std > 0:
            pulse_signal = pulse_signal / pulse_std

        result["heart_rate"] = round(heart_rate, 1) if heart_rate else None
        result["hrv_rmssd"] = round(hrv_rmssd, 1) if hrv_rmssd is not None else None
        result["signal_quality"] = quality
        result["pulse_peaks"] = pulse_peaks
        result["pulse_signal"] = pulse_signal.tolist()

        return result

    def _chrom_overlap_add(self, r: np.ndarray, g: np.ndarray, b: np.ndarray, n: int) -> np.ndarray:
        """CHROM with per-segment normalization and overlap-add (de Haan & Jeanne 2013)."""
        pulse = np.zeros(n)
        count = np.zeros(n)

        for start in range(0, n - self._segment_len + 1, self._segment_stride):
            end = start + self._segment_len
            rs = r[start:end]
            gs = g[start:end]
            bs = b[start:end]

            # Per-segment normalization
            r_mean = rs.mean()
            g_mean = gs.mean()
            b_mean = bs.mean()

            if r_mean == 0 or g_mean == 0 or b_mean == 0:
                continue

            rn = rs / r_mean
            gn = gs / g_mean
            bn = bs / b_mean

            # Chrominance signals
            xs = 3.0 * rn - 2.0 * gn
            ys = 1.5 * rn + gn - 1.5 * bn

            # Per-segment alpha
            std_xs = np.std(xs)
            std_ys = np.std(ys)
            if std_ys == 0:
                continue

            alpha = std_xs / std_ys
            segment_pulse = xs - alpha * ys

            # Apply Hanning window for smooth overlap-add
            window = np.hanning(self._segment_len)
            pulse[start:end] += segment_pulse * window
            count[start:end] += window

        # Normalize by overlap count
        mask = count > 0
        pulse[mask] /= count[mask]
        return pulse

    def _pos_overlap_add(self, r: np.ndarray, g: np.ndarray, b: np.ndarray, n: int) -> np.ndarray:
        """POS algorithm with overlap-add (Wang et al. 2017)."""
        pulse = np.zeros(n)
        count = np.zeros(n)

        for start in range(0, n - self._segment_len + 1, self._segment_stride):
            end = start + self._segment_len
            rs = r[start:end]
            gs = g[start:end]
            bs = b[start:end]

            r_mean = rs.mean()
            g_mean = gs.mean()
            b_mean = bs.mean()

            if r_mean == 0 or g_mean == 0 or b_mean == 0:
                continue

            rn = rs / r_mean
            gn = gs / g_mean
            bn = bs / b_mean

            # POS projection
            s1 = gn - bn
            s2 = gn + bn - 2.0 * rn

            std_s1 = np.std(s1)
            std_s2 = np.std(s2)
            if std_s2 == 0:
                continue

            alpha = std_s1 / std_s2
            segment_pulse = s1 + alpha * s2  # Note: PLUS for POS

            window = np.hanning(self._segment_len)
            pulse[start:end] += segment_pulse * window
            count[start:end] += window

        mask = count > 0
        pulse[mask] /= count[mask]
        return pulse

    def _fft_heart_rate(self, signal: np.ndarray) -> Tuple[Optional[float], float]:
        """Extract heart rate from signal using FFT. Returns (hr_bpm, snr)."""
        n = len(signal)
        fft_vals = np.abs(np.fft.rfft(signal * np.hanning(n)))
        freqs = np.fft.rfftfreq(n, d=1.0 / self._fps)

        # Valid HR range
        valid = (freqs >= 0.65) & (freqs <= 3.5)
        if not np.any(valid):
            return None, 0.0

        fft_valid = fft_vals[valid]
        freqs_valid = freqs[valid]

        peak_idx = np.argmax(fft_valid)
        peak_freq = freqs_valid[peak_idx]
        heart_rate = peak_freq * 60.0

        # SNR: peak power vs total power in valid range
        peak_power = fft_valid[peak_idx] ** 2
        total_power = np.sum(fft_valid ** 2)
        snr = peak_power / total_power if total_power > 0 else 0

        # Check peak sharpness — peak should drop by 50% within ±5 BPM
        bpm_resolution = (freqs[1] - freqs[0]) * 60 if len(freqs) > 1 else 1
        bins_5bpm = max(1, int(5 / bpm_resolution))
        start = max(0, peak_idx - bins_5bpm)
        end = min(len(fft_valid), peak_idx + bins_5bpm + 1)
        neighbors = np.concatenate([fft_valid[start:peak_idx], fft_valid[peak_idx + 1:end]])
        if len(neighbors) > 0:
            sharpness = fft_valid[peak_idx] / (np.median(neighbors) + 1e-10)
            if sharpness < 2.0:
                snr *= 0.5  # Penalize broad peaks

        return heart_rate, snr

    def _narrow_bandpass(self, signal: np.ndarray, hr_bpm: float) -> Optional[np.ndarray]:
        """Apply narrow bandpass centered on detected HR for clean peak detection."""
        hr_hz = hr_bpm / 60.0
        nyq = self._fps / 2.0
        low = max(0.01, (hr_hz - 0.3) / nyq)
        high = min(0.99, (hr_hz + 0.3) / nyq)
        if low >= high:
            return None
        try:
            b, a = butter(3, [low, high], btype='band')
            return filtfilt(b, a, signal)
        except ValueError:
            return None
