import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts'

export default function SessionArc({ data, onNewSession }) {
  const chartData = useMemo(() => {
    if (!data?.vitals_timeline) return []
    return data.vitals_timeline.map(v => ({
      time: v.t,
      label: `${Math.floor(v.t / 60)}:${String(Math.floor(v.t % 60)).padStart(2, '0')}`,
      hr: v.hr,
      stress: v.stress,
    }))
  }, [data])

  const events = data?.events || []
  const narrative = data?.narrative || ''
  const stats = data?.stats || {}
  const assessment = data?.overall_assessment || 'calm'

  const assessmentColors = { calm: '#00ff88', moderate: '#ffdd00', elevated: '#ff8800' }

  return (
    <div className="h-screen overflow-y-auto p-8" style={{
      background: 'linear-gradient(180deg, #0a0a0f 0%, #0d1117 100%)',
    }}>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2" style={{
            background: 'linear-gradient(135deg, #00d4ff, #00ffaa)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Session Complete
          </h1>
          <p style={{ color: '#8888aa' }}>
            Duration: {stats.duration_minutes || 0} minutes
          </p>
          <div className="inline-flex mt-3 px-4 py-1 rounded-full text-sm font-semibold"
               style={{ background: `${assessmentColors[assessment]}22`, color: assessmentColors[assessment],
                        border: `1px solid ${assessmentColors[assessment]}44` }}>
            {assessment.toUpperCase()} SESSION
          </div>
        </div>

        {/* Timeline Chart */}
        <div className="rounded-xl p-6 mb-6" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#8888aa' }}>VITALS TIMELINE</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <XAxis dataKey="label" stroke="#555" fontSize={10} interval="preserveStartEnd" />
              <YAxis stroke="#555" fontSize={10} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#8888aa' }}
              />
              <Line type="monotone" dataKey="hr" name="Heart Rate" stroke="#ff4466" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="stress" name="Stress" stroke="#ffaa00" strokeWidth={2} dot={false} />
              {events.filter(e => e.type === 'stress_detected').map((e, i) => (
                <ReferenceDot key={i} x={chartData.find(d => d.time >= e.timestamp)?.label}
                              y={chartData.find(d => d.time >= e.timestamp)?.stress}
                              r={5} fill="#ff3344" stroke="none" />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Key Events */}
        <div className="rounded-xl p-6 mb-6" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#8888aa' }}>KEY MOMENTS</h3>
          <div className="space-y-3">
            {events.map((event, i) => {
              const colors = {
                gemini_spoke: '#00d4ff', stress_detected: '#ff4466',
                gemini_adapted: '#ffaa00', user_spoke: '#88ff88',
              }
              const icons = {
                gemini_spoke: '\uD83D\uDDE3', stress_detected: '\u26A1',
                gemini_adapted: '\uD83E\uDDE0', user_spoke: '\uD83C\uDF99',
              }
              const minutes = Math.floor(event.timestamp / 60)
              const seconds = Math.floor(event.timestamp % 60)
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: '#0a0a0f' }}>
                  <span className="text-lg">{icons[event.type] || '\u2022'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: '#8888aa' }}>
                        {minutes}:{String(seconds).padStart(2, '0')}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded" style={{
                        background: `${colors[event.type] || '#555'}22`,
                        color: colors[event.type] || '#888',
                      }}>
                        {event.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm mt-1" style={{ color: '#ccc' }}>{event.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Narrative */}
        {narrative && (
          <div className="rounded-xl p-6 mb-6" style={{
            background: '#12121a', border: '1px solid #1e1e2e',
            borderLeft: '3px solid #00d4ff',
          }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#8888aa' }}>AI INSIGHTS</h3>
            <p className="text-sm leading-relaxed italic" style={{ color: '#ccc' }}>
              "{narrative}"
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Avg HR', value: `${stats.avg_heart_rate || 0}`, unit: 'BPM', color: '#ff4466' },
            { label: 'Peak Stress', value: `${stats.max_stress || 0}`, unit: '/100', color: '#ffaa00' },
            { label: 'Duration', value: `${stats.duration_minutes || 0}`, unit: 'min', color: '#00d4ff' },
            { label: 'Events', value: `${stats.total_events || 0}`, unit: '', color: '#aa88ff' },
          ].map((s, i) => (
            <div key={i} className="rounded-lg p-4 text-center" style={{ background: '#12121a', border: '1px solid #1e1e2e' }}>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs" style={{ color: '#8888aa' }}>{s.label} {s.unit}</p>
            </div>
          ))}
        </div>

        {/* New Session */}
        <div className="text-center mb-12">
          <button
            onClick={onNewSession}
            className="px-8 py-3 rounded-full text-sm font-semibold cursor-pointer border-none transition-all duration-300 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #00a8cc)', color: '#0a0a0f' }}
          >
            New Session
          </button>
        </div>
      </div>
    </div>
  )
}
