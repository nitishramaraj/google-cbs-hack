import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Heart, Wind, Eye, Activity, Droplets, Gauge } from 'lucide-react'

function VitalCard({ icon: Icon, label, value, unit, color, colorLight, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl p-4"
      style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f1f5' }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
             style={{ background: colorLight }}>
          <Icon className="w-4 h-4" style={{ color }} strokeWidth={2} />
        </div>
        <span className="text-xs font-medium" style={{ color: '#6b7190' }}>{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold" style={{ color: '#1a1d2e' }}>
          {value ?? '--'}
        </span>
        {unit && <span className="text-xs font-medium" style={{ color: '#9ca3bc' }}>{unit}</span>}
      </div>
    </motion.div>
  )
}

function StressGauge({ value }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  const angle = (pct / 100) * 180
  const color = pct < 30 ? '#51cf66' : pct < 60 ? '#ffa94d' : '#ff6b6b'
  const label = pct < 25 ? 'Low' : pct < 50 ? 'Mild' : pct < 75 ? 'Elevated' : 'High'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-2xl p-5 col-span-2"
      style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f1f5' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#ede8fb' }}>
          <Gauge className="w-4 h-4" style={{ color: '#7c5ce0' }} strokeWidth={2} />
        </div>
        <span className="text-xs font-medium" style={{ color: '#6b7190' }}>Stress Level</span>
      </div>
      <div className="flex items-center justify-between">
        {/* Arc gauge */}
        <div className="relative" style={{ width: 100, height: 56 }}>
          <svg viewBox="0 0 100 56" className="w-full">
            <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke="#f0f1f5" strokeWidth="8" strokeLinecap="round" />
            <path d="M 8 52 A 42 42 0 0 1 92 52" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(angle / 180) * 132} 132`}
                  style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.5s ease' }} />
          </svg>
          <div className="absolute inset-0 flex items-end justify-center pb-0">
            <span className="text-lg font-bold" style={{ color: '#1a1d2e' }}>{value ?? '--'}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold px-3 py-1 rounded-full"
                style={{ background: color + '18', color }}>
            {label}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function HRChart({ history }) {
  const data = useMemo(() =>
    history.filter(h => h.heart_rate).slice(-60).map((h, i) => ({
      i, hr: h.heart_rate,
    })),
    [history]
  )

  if (data.length < 2) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="rounded-2xl p-5 col-span-2"
      style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)', border: '1px solid #f0f1f5' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#fff0f0' }}>
          <Activity className="w-4 h-4" style={{ color: '#ff6b6b' }} strokeWidth={2} />
        </div>
        <span className="text-xs font-medium" style={{ color: '#6b7190' }}>Heart Rate Trend</span>
      </div>
      <div style={{ height: 100 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="hr" stroke="#ff6b6b" strokeWidth={2}
                  fill="url(#hrGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}

export default function VitalsDashboard({ vitals, history, phase }) {
  const isCalibrating = !vitals?.heart_rate

  return (
    <div className="h-full p-4 overflow-y-auto" style={{ background: '#f8f9fc' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold" style={{ color: '#1a1d2e' }}>Vitals</h2>
        <span className="text-xs px-3 py-1 rounded-full font-medium"
              style={{
                background: phase === 'calibrating' ? '#fff8ed' : phase === 'conversation' ? '#ecfbef' : '#ede8fb',
                color: phase === 'calibrating' ? '#ffa94d' : phase === 'conversation' ? '#51cf66' : '#7c5ce0',
              }}>
          {phase === 'calibrating' ? 'Calibrating' : phase === 'adapting' ? 'Adapting' : 'Live'}
        </span>
      </div>

      {isCalibrating ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
               style={{ background: '#ede8fb' }}>
            <Heart className="w-8 h-8 animate-pulse" style={{ color: '#7c5ce0' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#6b7190' }}>Reading your vitals...</p>
          <p className="text-xs mt-1" style={{ color: '#9ca3bc' }}>Stay still with good lighting</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <VitalCard icon={Heart} label="Heart Rate" value={vitals?.heart_rate} unit="BPM"
                     color="#ff6b6b" colorLight="#fff0f0" delay={0} />
          <VitalCard icon={Wind} label="Respiratory" value={vitals?.respiratory_rate} unit="/min"
                     color="#51cf66" colorLight="#ecfbef" delay={0.05} />
          <VitalCard icon={Droplets} label="SpO2" value={vitals?.spo2_estimate} unit=""
                     color="#4dabf7" colorLight="#edf5ff" delay={0.1} />
          <VitalCard icon={Eye} label="Blink Rate" value={vitals?.blink_rate} unit="/min"
                     color="#ffa94d" colorLight="#fff8ed" delay={0.15} />

          <StressGauge value={vitals?.stress_composite} />
          <HRChart history={history} />

          {/* Signal quality */}
          <div className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl"
               style={{ background: 'white', border: '1px solid #f0f1f5' }}>
            <span className="w-2 h-2 rounded-full"
                  style={{
                    background: vitals?.signal_quality === 'good' ? '#51cf66'
                      : vitals?.signal_quality === 'fair' ? '#ffa94d' : '#ff6b6b',
                  }} />
            <span className="text-xs" style={{ color: '#9ca3bc' }}>
              Signal: {vitals?.signal_quality || 'checking'}
            </span>
            <span className="text-xs ml-auto" style={{ color: '#9ca3bc' }}>
              {vitals?.facial_tension}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
