import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'

function AnimatedNumber({ value, suffix = '' }) {
  return (
    <span className="tabular-nums">{value != null ? value : '--'}{suffix}</span>
  )
}

function StressGauge({ value = 0 }) {
  const angle = (value / 100) * 180
  const color = value < 25 ? '#00ff88' : value < 50 ? '#ffdd00' : value < 75 ? '#ff8800' : '#ff3344'

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="70" viewBox="0 0 120 70">
        {/* Background arc */}
        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#1e1e2e" strokeWidth="8" strokeLinecap="round" />
        {/* Filled arc */}
        <path
          d="M 10 65 A 50 50 0 0 1 110 65"
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${(angle / 180) * 157} 157`}
          style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.5s ease' }}
        />
        <text x="60" y="55" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
          {value != null ? value : '--'}
        </text>
        <text x="60" y="68" textAnchor="middle" fill="#8888aa" fontSize="9">STRESS</text>
      </svg>
    </div>
  )
}

function PhasePill({ phase }) {
  const config = {
    waiting: { label: 'WAITING', color: '#555', bg: '#1a1a1a' },
    calibrating: { label: 'CALIBRATING', color: '#ffdd00', bg: '#2a2500' },
    conversation: { label: 'CONVERSATION', color: '#00d4ff', bg: '#001a22' },
    adapting: { label: 'ADAPTING', color: '#ff8800', bg: '#221500' },
    closing: { label: 'CLOSING', color: '#ff4466', bg: '#220011' },
    completed: { label: 'COMPLETED', color: '#00ff88', bg: '#002200' },
  }
  const c = config[phase] || config.waiting
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold"
         style={{ background: c.bg, color: c.color, border: `1px solid ${c.color}33` }}>
      {(phase === 'calibrating' || phase === 'adapting') && (
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: c.color }} />
      )}
      {c.label}
    </div>
  )
}

export default function VitalsDashboard({ vitals, history, phase }) {
  const chartData = useMemo(() => {
    return (history || []).map((v, i) => ({
      idx: i,
      hr: v.heart_rate || 0,
      stress: v.stress_composite || 0,
    }))
  }, [history])

  const cards = [
    { label: 'Heart Rate', value: vitals?.heart_rate, suffix: ' BPM', color: '#ff4466' },
    { label: 'HRV', value: vitals?.hrv_rmssd, suffix: ' ms', color: '#00d4ff' },
    { label: 'Respiratory', value: vitals?.respiratory_rate, suffix: ' br/min', color: '#88ccff' },
    { label: 'Blink Rate', value: vitals?.blink_rate, suffix: ' /min', color: '#aa88ff' },
  ]

  return (
    <div className="h-full flex flex-col gap-3 p-4" style={{ background: '#0d0d14' }}>
      {/* Phase */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: '#8888aa' }}>VITALS MONITOR</h2>
        <PhasePill phase={phase} />
      </div>

      {/* HR Chart */}
      <div className="rounded-xl p-3" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
        <p className="text-xs mb-2" style={{ color: '#8888aa' }}>Heart Rate (60s)</p>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ff4466" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ff4466" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="idx" hide />
            <YAxis domain={['auto', 'auto']} hide />
            <Area type="monotone" dataKey="hr" stroke="#ff4466" fill="url(#hrGrad)"
                  strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stress Gauge */}
      <div className="rounded-xl p-3 flex justify-center" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
        <StressGauge value={vitals?.stress_composite} />
      </div>

      {/* Vital Cards */}
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
            <p className="text-xs mb-1" style={{ color: '#8888aa' }}>{card.label}</p>
            <p className="text-xl font-bold" style={{ color: card.color }}>
              <AnimatedNumber value={card.value} suffix={card.suffix} />
            </p>
          </div>
        ))}
      </div>

      {/* Tension + SpO2 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-3" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
          <p className="text-xs mb-1" style={{ color: '#8888aa' }}>Tension</p>
          <p className="text-sm font-semibold capitalize" style={{ color: '#ffdd00' }}>
            {vitals?.facial_tension || '--'}
          </p>
        </div>
        <div className="rounded-lg p-3" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
          <p className="text-xs mb-1" style={{ color: '#8888aa' }}>SpO2</p>
          <p className="text-sm font-semibold" style={{ color: '#00ff88' }}>
            {vitals?.spo2_estimate || '--'}
          </p>
        </div>
      </div>
    </div>
  )
}
