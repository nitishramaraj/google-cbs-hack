export default function LandingPage({ onStart, connected, error }) {
  const features = [
    { icon: '\u2764', title: 'Heart Rate Detection', desc: 'Real-time pulse monitoring through advanced computer vision' },
    { icon: '\u26A1', title: 'Stress Analysis', desc: 'Composite stress scoring from multiple physiological signals' },
    { icon: '\uD83C\uDFA4', title: 'Voice AI Coach', desc: 'Empathetic AI companion that adapts to your emotional state' },
    { icon: '\uD83D\uDCC8', title: 'Session Insights', desc: 'Beautiful post-session analysis with key moments highlighted' },
  ]

  return (
    <div className="h-screen flex flex-col items-center justify-center px-8" style={{ background: 'linear-gradient(135deg, #0a0a0f 0%, #0d1117 50%, #0a0a0f 100%)' }}>
      <div className="animate-fade-in text-center max-w-3xl">
        <h1 className="text-6xl font-bold mb-3" style={{
          background: 'linear-gradient(135deg, #00d4ff, #00ffaa, #00d4ff)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        }}>
          VitalSense
        </h1>
        <p className="text-xl mb-12" style={{ color: '#8888aa' }}>
          AI-Powered Real-Time Wellness Monitoring
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12">
          {features.map((f, i) => (
            <div key={i} className="p-5 rounded-xl text-left" style={{
              background: '#12121a', border: '1px solid #1e1e2e',
              animationDelay: `${i * 0.1}s`,
            }}>
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: '#00d4ff' }}>{f.title}</h3>
              <p className="text-xs" style={{ color: '#8888aa' }}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Connection status */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: connected ? '#00ff88' : '#ff4466' }} />
          <span className="text-sm" style={{ color: connected ? '#00ff88' : '#ff4466' }}>
            {connected ? 'Backend connected' : 'Waiting for backend...'}
          </span>
        </div>

        {error && (
          <p className="text-sm mb-4" style={{ color: '#ff4466' }}>{error}</p>
        )}

        <button
          onClick={onStart}
          disabled={!connected}
          className="px-10 py-4 rounded-full text-lg font-semibold cursor-pointer border-none transition-all duration-300 hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: connected ? 'linear-gradient(135deg, #00d4ff, #00a8cc)' : '#333',
            color: connected ? '#0a0a0f' : '#888',
          }}
        >
          Begin Session
        </button>

        {!connected && (
          <p className="text-xs mt-4" style={{ color: '#555' }}>
            Start the backend with: python3 main.py
          </p>
        )}
      </div>
    </div>
  )
}
