// Face mesh tessellation connections (subset for wireframe)
const FACE_OVAL = [
  [10, 338], [338, 297], [297, 332], [332, 284], [284, 251], [251, 389],
  [389, 356], [356, 454], [454, 323], [323, 361], [361, 288], [288, 397],
  [397, 365], [365, 379], [379, 378], [378, 400], [400, 377], [377, 152],
  [152, 148], [148, 176], [176, 149], [149, 150], [150, 136], [136, 172],
  [172, 58], [58, 132], [132, 93], [93, 234], [234, 127], [127, 162],
  [162, 21], [21, 54], [54, 103], [103, 67], [67, 109], [109, 10],
]

const LIPS = [
  [61, 146], [146, 91], [91, 181], [181, 84], [84, 17], [17, 314],
  [314, 405], [405, 321], [321, 375], [375, 291], [291, 61],
]

const LEFT_EYE = [
  [362, 385], [385, 387], [387, 263], [263, 373], [373, 380], [380, 362],
]

const RIGHT_EYE = [
  [33, 160], [160, 158], [158, 133], [133, 153], [153, 144], [144, 33],
]

const NOSE = [
  [168, 6], [6, 197], [197, 195], [195, 5], [5, 4], [4, 1],
]

export const CONNECTIONS = [...FACE_OVAL, ...LIPS, ...LEFT_EYE, ...RIGHT_EYE, ...NOSE]

export function stressToColor(level) {
  const colors = { low: '#00ff88', mild: '#ffdd00', elevated: '#ff8800', high: '#ff3344', unknown: '#00d4ff' }
  return colors[level] || colors.unknown
}

export function interpolateColor(c1, c2, t) {
  const parse = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  const [r1, g1, b1] = parse(c1)
  const [r2, g2, b2] = parse(c2)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

export function drawFaceMesh(ctx, landmarks, width, height, color = '#00d4ff', opacity = 0.3) {
  if (!landmarks || landmarks.length < 468) return
  ctx.strokeStyle = color
  ctx.globalAlpha = opacity
  ctx.lineWidth = 0.5

  for (const [i, j] of CONNECTIONS) {
    if (i >= landmarks.length || j >= landmarks.length) continue
    const x1 = landmarks[i][0] * width
    const y1 = landmarks[i][1] * height
    const x2 = landmarks[j][0] * width
    const y2 = landmarks[j][1] * height
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

export function drawROI(ctx, landmarks, indices, width, height, color) {
  if (!landmarks || !indices || indices.length < 2) return
  ctx.fillStyle = color
  ctx.globalAlpha = 0.08
  ctx.beginPath()
  const first = indices[0]
  ctx.moveTo(first[0] * width, first[1] * height)
  for (let i = 1; i < indices.length; i++) {
    ctx.lineTo(indices[i][0] * width, indices[i][1] * height)
  }
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = 1
}

export function drawPulse(ctx, x, y, size, progress) {
  ctx.save()
  ctx.globalAlpha = Math.max(0, 1 - progress)
  ctx.strokeStyle = '#ff4466'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x, y, size * (1 + progress * 0.5), 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

export function drawLabel(ctx, text, x, y, color = '#00d4ff', fontSize = 14) {
  ctx.save()
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  const metrics = ctx.measureText(text)
  ctx.fillRect(x - 4, y - fontSize, metrics.width + 8, fontSize + 6)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}
