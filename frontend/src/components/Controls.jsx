import { useState, useEffect } from 'react'

export default function Controls({ phase, connected, onStop, isPlaying }) {
  const [calibrationProgress, setCalibrationProgress] = useState(0)

  useEffect(() => {
    if (phase !== 'calibrating') {
      setCalibrationProgress(phase === 'conversation' || phase === 'adapting' ? 100 : 0)
      return
    }
    const start = Date.now()
    const duration = 30000 // 30s calibration
    const interval = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(100, (elapsed / duration) * 100)
      setCalibrationProgress(progress)
      if (progress >= 100) clearInterval(interval)
    }, 100)
    return () => clearInterval(interval)
  }, [phase])

  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between"
         style={{ zIndex: 20, background: 'linear-gradient(transparent, rgba(10,10,15,0.9))' }}>
      <div className="flex items-center gap-3">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: connected ? '#00ff88' : '#ff4466' }} />
          <span className="text-xs" style={{ color: '#8888aa' }}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>

        {/* Gemini speaking indicator */}
        {isPlaying && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#00d4ff' }} />
            <span className="text-xs" style={{ color: '#00d4ff' }}>Aria speaking</span>
          </div>
        )}
      </div>

      {/* Calibration bar */}
      {phase === 'calibrating' && (
        <div className="flex-1 mx-6">
          <p className="text-xs text-center mb-1" style={{ color: '#ffdd00' }}>Establishing baseline...</p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1e1e2e' }}>
            <div className="h-full rounded-full transition-all duration-200"
                 style={{ width: `${calibrationProgress}%`, background: 'linear-gradient(90deg, #ffdd00, #00d4ff)' }} />
          </div>
        </div>
      )}

      {/* Stop button */}
      {(phase === 'conversation' || phase === 'adapting') && (
        <button
          onClick={onStop}
          className="px-5 py-2 rounded-full text-xs font-semibold cursor-pointer border-none transition-all duration-200 hover:scale-105"
          style={{ background: '#ff4466', color: 'white' }}
        >
          End Session
        </button>
      )}
    </div>
  )
}
