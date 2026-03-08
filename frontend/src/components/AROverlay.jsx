import { useRef, useEffect } from 'react'

export default function AROverlay({ landmarks, vitals, stressLevel, pulsePeak, roiPolygons, signalQuality }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width = canvas.parentElement?.clientWidth || 640
    const h = canvas.height = canvas.parentElement?.clientHeight || 480

    ctx.clearRect(0, 0, w, h)

    if (!landmarks || landmarks.length === 0) return

    // Subtle face outline — just key contour points
    const contour = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
                     397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
                     172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]

    ctx.beginPath()
    ctx.strokeStyle = 'rgba(124, 92, 224, 0.25)'
    ctx.lineWidth = 1.5
    contour.forEach((idx, i) => {
      if (idx >= landmarks.length) return
      const x = landmarks[idx][0] * w
      const y = landmarks[idx][1] * h
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()

    // ROI highlights — soft colored regions
    if (roiPolygons) {
      const regions = [
        { key: 'forehead', color: 'rgba(124, 92, 224, 0.08)' },
        { key: 'left_cheek', color: 'rgba(77, 171, 247, 0.08)' },
        { key: 'right_cheek', color: 'rgba(77, 171, 247, 0.08)' },
      ]
      regions.forEach(({ key, color }) => {
        const pts = roiPolygons[key]
        if (!pts || pts.length === 0) return
        ctx.beginPath()
        ctx.fillStyle = color
        pts.forEach((p, i) => {
          const x = p[0] * w / 640
          const y = p[1] * h / 480
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
        ctx.fill()
      })
    }

    // Pulse flash
    if (pulsePeak) {
      ctx.fillStyle = 'rgba(255, 107, 107, 0.08)'
      ctx.fillRect(0, 0, w, h)
    }

  }, [landmarks, vitals, stressLevel, pulsePeak, roiPolygons, signalQuality])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ zIndex: 10, pointerEvents: 'none' }}
    />
  )
}
