import { useRef, useEffect, useCallback } from 'react'
import { drawFaceMesh, drawROI, drawPulse, drawLabel, stressToColor } from '../utils/overlayRenderer'

export default function AROverlay({ landmarks, vitals, stressLevel, pulsePeak, roiPolygons, signalQuality }) {
  const canvasRef = useRef(null)
  const pulseRef = useRef(0)
  const animRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    ctx.clearRect(0, 0, w, h)

    const color = stressToColor(stressLevel || 'low')

    // Draw face mesh
    if (landmarks && landmarks.length > 0) {
      drawFaceMesh(ctx, landmarks, w, h, color, 0.25)
    }

    // Draw ROI regions
    if (roiPolygons) {
      if (roiPolygons.forehead) drawROI(ctx, landmarks, roiPolygons.forehead, w, h, color)
      if (roiPolygons.left_cheek) drawROI(ctx, landmarks, roiPolygons.left_cheek, w, h, color)
      if (roiPolygons.right_cheek) drawROI(ctx, landmarks, roiPolygons.right_cheek, w, h, color)
    }

    // Pulse animation
    if (pulsePeak) {
      pulseRef.current = 1
    }
    if (pulseRef.current > 0) {
      const cx = w * 0.5
      const cy = h * 0.3
      drawPulse(ctx, cx, cy, 20, 1 - pulseRef.current)
      pulseRef.current = Math.max(0, pulseRef.current - 0.03)
    }

    // Vital labels
    if (vitals) {
      if (vitals.heart_rate) {
        drawLabel(ctx, `${vitals.heart_rate} BPM`, 20, 40, '#ff4466', 16)
      }
      if (vitals.stress_composite != null) {
        drawLabel(ctx, `Stress: ${vitals.stress_composite}`, w - 140, 40, color, 14)
      }
      if (vitals.respiratory_rate) {
        drawLabel(ctx, `RR: ${vitals.respiratory_rate}`, 20, 65, '#88aacc', 12)
      }
    }

    // Signal quality dot
    if (signalQuality) {
      const dotColor = signalQuality === 'good' ? '#00ff88' : signalQuality === 'fair' ? '#ffdd00' : '#ff3344'
      ctx.beginPath()
      ctx.arc(w - 20, 20, 5, 0, Math.PI * 2)
      ctx.fillStyle = dotColor
      ctx.fill()
    }

    animRef.current = requestAnimationFrame(draw)
  }, [landmarks, vitals, stressLevel, pulsePeak, roiPolygons, signalQuality])

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw)
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 10 }}
    />
  )
}
