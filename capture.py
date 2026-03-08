"""
capture.py -- Webcam capture + MediaPipe Face Landmarker + ROI extraction.
Uses the new MediaPipe Tasks API (0.10.14+).
"""

import collections
import os
import threading
import time
from typing import Optional, Tuple, List, Dict

import cv2
import mediapipe as mp
import numpy as np

FOREHEAD_LANDMARKS = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323,
                      361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
                      176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
                      162, 21, 54, 103, 67, 109]

LEFT_CHEEK_LANDMARKS = [116, 117, 118, 119, 100, 36, 205, 187, 123]
RIGHT_CHEEK_LANDMARKS = [345, 346, 347, 348, 329, 266, 425, 411, 352]

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")


class CaptureEngine:
    def __init__(self, camera_index: int = 0, target_fps: int = 30,
                 rgb_buffer_maxlen: int = 450) -> None:
        self._camera_index = camera_index
        self._target_fps = target_fps
        self._frame_interval = 1.0 / target_fps

        # New MediaPipe Tasks API
        BaseOptions = mp.tasks.BaseOptions
        FaceLandmarker = mp.tasks.vision.FaceLandmarker
        FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
        VisionRunningMode = mp.tasks.vision.RunningMode

        options = FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=MODEL_PATH),
            running_mode=VisionRunningMode.VIDEO,
            num_faces=1,
            min_face_detection_confidence=0.5,
            min_face_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
        )
        self._landmarker = FaceLandmarker.create_from_options(options)
        self._frame_timestamp_ms = 0

        self._lock = threading.Lock()
        self._current_frame: Optional[np.ndarray] = None
        self._current_landmarks = None

        self._rgb_buffer_forehead: collections.deque = collections.deque(maxlen=rgb_buffer_maxlen)
        self._rgb_buffer_left_cheek: collections.deque = collections.deque(maxlen=rgb_buffer_maxlen)
        self._rgb_buffer_right_cheek: collections.deque = collections.deque(maxlen=rgb_buffer_maxlen)
        self._timestamp_buffer: collections.deque = collections.deque(maxlen=rgb_buffer_maxlen)

        self._cap: Optional[cv2.VideoCapture] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self) -> None:
        if self._running:
            return
        self._cap = cv2.VideoCapture(self._camera_index)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open camera index {self._camera_index}")
        self._cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self._cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self._cap.set(cv2.CAP_PROP_FPS, self._target_fps)
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread is not None:
            self._thread.join(timeout=2.0)
            self._thread = None
        if self._cap is not None:
            self._cap.release()
            self._cap = None
        if self._landmarker:
            self._landmarker.close()

    def get_frame(self) -> Tuple[Optional[np.ndarray], Optional[list]]:
        with self._lock:
            frame = self._current_frame.copy() if self._current_frame is not None else None
            landmarks = list(self._current_landmarks) if self._current_landmarks is not None else None
        return frame, landmarks

    def get_rgb_buffers(self) -> Dict[str, list]:
        """Return raw ROI buffers and a weighted combined buffer.

        Weighting: 60% forehead, 20% left cheek, 20% right cheek.
        Research shows forehead is most stable and accurate for rPPG.
        """
        with self._lock:
            forehead = list(self._rgb_buffer_forehead)
            left = list(self._rgb_buffer_left_cheek)
            right = list(self._rgb_buffer_right_cheek)

            # Build weighted combined buffer from aligned samples
            min_len = min(len(forehead), len(left), len(right))
            combined = []
            if min_len > 0:
                for i in range(min_len):
                    r = 0.6 * forehead[i][0] + 0.2 * left[i][0] + 0.2 * right[i][0]
                    g = 0.6 * forehead[i][1] + 0.2 * left[i][1] + 0.2 * right[i][1]
                    b = 0.6 * forehead[i][2] + 0.2 * left[i][2] + 0.2 * right[i][2]
                    combined.append((r, g, b))
            elif len(forehead) > 0:
                combined = forehead  # Fallback to forehead only

            return {
                "forehead": forehead,
                "left_cheek": left,
                "right_cheek": right,
                "combined": combined,
                "timestamps": list(self._timestamp_buffer),
            }

    def get_roi_polygons(self, landmarks: list) -> Dict[str, List[Tuple[int, int]]]:
        return {
            "forehead": [(int(landmarks[i][0]), int(landmarks[i][1])) for i in FOREHEAD_LANDMARKS],
            "left_cheek": [(int(landmarks[i][0]), int(landmarks[i][1])) for i in LEFT_CHEEK_LANDMARKS],
            "right_cheek": [(int(landmarks[i][0]), int(landmarks[i][1])) for i in RIGHT_CHEEK_LANDMARKS],
        }

    @staticmethod
    def extract_roi_mean_rgb(frame: np.ndarray, landmarks: list,
                             roi_indices: List[int]) -> Optional[Tuple[float, float, float]]:
        h, w = frame.shape[:2]
        pts = []
        for idx in roi_indices:
            x = max(0, min(w - 1, int(landmarks[idx][0])))
            y = max(0, min(h - 1, int(landmarks[idx][1])))
            pts.append([x, y])
        pts_array = np.array(pts, dtype=np.int32)
        mask = np.zeros((h, w), dtype=np.uint8)
        cv2.fillConvexPoly(mask, pts_array, 255)
        if cv2.countNonZero(mask) == 0:
            cv2.fillPoly(mask, [pts_array], 255)
        if cv2.countNonZero(mask) == 0:
            return None
        mean_bgr = cv2.mean(frame, mask=mask)[:3]
        return (mean_bgr[2], mean_bgr[1], mean_bgr[0])

    def _capture_loop(self) -> None:
        while self._running:
            loop_start = time.monotonic()
            if self._cap is None or not self._cap.isOpened():
                time.sleep(0.01)
                continue
            ret, frame = self._cap.read()
            if not ret or frame is None:
                time.sleep(0.01)
                continue

            # Convert BGR -> RGB for MediaPipe
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            # Monotonically increasing timestamp required for VIDEO mode
            self._frame_timestamp_ms += int(self._frame_interval * 1000)
            result = self._landmarker.detect_for_video(mp_image, self._frame_timestamp_ms)

            landmarks = None
            forehead_rgb = left_cheek_rgb = right_cheek_rgb = None

            if result.face_landmarks and len(result.face_landmarks) > 0:
                face = result.face_landmarks[0]
                h, w = frame.shape[:2]
                landmarks = [(lm.x * w, lm.y * h, lm.z) for lm in face]
                forehead_rgb = self.extract_roi_mean_rgb(frame, landmarks, FOREHEAD_LANDMARKS)
                left_cheek_rgb = self.extract_roi_mean_rgb(frame, landmarks, LEFT_CHEEK_LANDMARKS)
                right_cheek_rgb = self.extract_roi_mean_rgb(frame, landmarks, RIGHT_CHEEK_LANDMARKS)

            with self._lock:
                self._current_frame = frame
                self._current_landmarks = landmarks
                now = time.time()
                if forehead_rgb is not None:
                    self._rgb_buffer_forehead.append(forehead_rgb)
                    self._timestamp_buffer.append(now)
                if left_cheek_rgb is not None:
                    self._rgb_buffer_left_cheek.append(left_cheek_rgb)
                if right_cheek_rgb is not None:
                    self._rgb_buffer_right_cheek.append(right_cheek_rgb)

            elapsed = time.monotonic() - loop_start
            sleep_time = self._frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)
