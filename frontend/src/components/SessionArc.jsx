import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { Heart, Clock, Activity, Zap, ArrowRight, Sparkles } from 'lucide-react'

export default function SessionArc({ data, onNewSession }) {
  const chartData = useMemo(() => {
    if (!data?.vitals_timeline) return []
    return data.vitals_timeline.map((v, i) => ({
      i,
      hr: v.heart_rate,
      stress: v.stress_composite,
    }))
  }, [data])

  const stats = data?.stats || {}
  const narrative = data?.narrative || 'Session complete. Thank you for this mindful moment.'
  const assessment = data?.overall_assessment || 'calm'

  const assessmentColors = {
    calm: { bg: '#ecfbef', color: '#51cf66', label: 'Calm' },
    mild: { bg: '#fff8ed', color: '#ffa94d', label: 'Mild Stress' },
    elevated: { bg: '#fff0f0', color: '#ff6b6b', label: 'Elevated' },
    high: { bg: '#fff0f0', color: '#ff6b6b', label: 'High Stress' },
  }
  const assess = assessmentColors[assessment] || assessmentColors.calm

  return (
    <div className="h-screen w-screen overflow-y-auto"
         style={{ background: 'linear-gradient(180deg, #f8f9fc, #ede8fb)' }}>
      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-3xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #7c5ce0, #4dabf7)' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1a1d2e' }}>Session Complete</h1>
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-medium"
                style={{ background: assess.bg, color: assess.color }}>
            {assess.label}
          </span>
        </motion.div>

        {/* Stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-4 gap-3 mb-8"
        >
          {[
            { icon: Clock, label: 'Duration', value: `${stats.duration_minutes || 0}m`, color: '#7c5ce0' },
            { icon: Heart, label: 'Avg HR', value: stats.avg_heart_rate || '--', color: '#ff6b6b' },
            { icon: Zap, label: 'Max Stress', value: stats.max_stress || '--', color: '#ffa94d' },
            { icon: Activity, label: 'Events', value: stats.total_events || 0, color: '#4dabf7' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-4 text-center"
                 style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} strokeWidth={1.5} />
              <p className="text-lg font-bold" style={{ color: '#1a1d2e' }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#9ca3bc' }}>{s.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Chart */}
        {chartData.length > 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl p-5 mb-8"
            style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: '#6b7190' }}>Session Timeline</p>
            <div style={{ height: 140 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="arcHr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="arcStress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7c5ce0" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#7c5ce0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis hide />
                  <YAxis hide />
                  <Area type="monotone" dataKey="hr" stroke="#ff6b6b" strokeWidth={2}
                        fill="url(#arcHr)" dot={false} />
                  <Area type="monotone" dataKey="stress" stroke="#7c5ce0" strokeWidth={1.5}
                        fill="url(#arcStress)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: '#ff6b6b' }} />
                <span className="text-xs" style={{ color: '#9ca3bc' }}>Heart Rate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded" style={{ background: '#7c5ce0' }} />
                <span className="text-xs" style={{ color: '#9ca3bc' }}>Stress</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Narrative */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="rounded-2xl p-6 mb-8"
          style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
        >
          <p className="text-sm font-medium mb-3" style={{ color: '#6b7190' }}>Session Summary</p>
          <p className="text-sm leading-relaxed" style={{ color: '#1a1d2e' }}>{narrative}</p>
        </motion.div>

        {/* Key moments */}
        {data?.key_moments?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="rounded-2xl p-5 mb-8"
            style={{ background: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: '#6b7190' }}>Key Moments</p>
            <div className="space-y-2">
              {data.key_moments.map((m, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                        style={{ background: '#7c5ce0' }} />
                  <p className="text-sm" style={{ color: '#1a1d2e' }}>{m}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* New session button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center"
        >
          <button
            onClick={onNewSession}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl text-white font-semibold border-none cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #7c5ce0, #4dabf7)',
              boxShadow: '0 4px 20px rgba(124, 92, 224, 0.25)',
            }}
          >
            New Session <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </div>
  )
}
