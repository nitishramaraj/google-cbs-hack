import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, Radio, Square } from 'lucide-react'

export default function Controls({ phase, connected, onStop, isPlaying, isMicActive }) {
  const [calibrationProgress, setCalibrationProgress] = useState(0)

  useEffect(() => {
    if (phase !== 'calibrating') {
      setCalibrationProgress(phase === 'conversation' || phase === 'adapting' ? 100 : 0)
      return
    }
    const start = Date.now()
    const duration = 30000
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
         style={{
           zIndex: 20,
           background: 'linear-gradient(transparent, rgba(255,255,255,0.95))',
           backdropFilter: 'blur(8px)',
         }}>
      <div className="flex items-center gap-3">
        {/* Connection */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
             style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
          <span className="w-2 h-2 rounded-full"
                style={{ background: connected ? '#51cf66' : '#ff6b6b' }} />
          <span className="text-xs font-medium" style={{ color: '#6b7190' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* Mic */}
        {isMicActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          >
            <Mic className="w-3 h-3" style={{ color: '#51cf66' }} />
            <span className="text-xs font-medium" style={{ color: '#51cf66' }}>Mic</span>
          </motion.div>
        )}

        {/* Speaking */}
        {isPlaying && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}
          >
            <Radio className="w-3 h-3" style={{ color: '#7c5ce0' }} />
            <span className="text-xs font-medium" style={{ color: '#7c5ce0' }}>Aria</span>
          </motion.div>
        )}
      </div>

      {/* Calibration */}
      {phase === 'calibrating' && (
        <div className="flex-1 mx-6">
          <p className="text-xs text-center mb-1.5 font-medium" style={{ color: '#7c5ce0' }}>
            Establishing baseline...
          </p>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#f0f1f5' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ width: `${calibrationProgress}%`, background: 'linear-gradient(90deg, #7c5ce0, #4dabf7)' }}
              transition={{ duration: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* End button */}
      {(phase === 'conversation' || phase === 'adapting') && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onStop}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer border-none"
          style={{ background: '#ff6b6b', color: 'white', boxShadow: '0 2px 12px rgba(255,107,107,0.3)' }}
        >
          <Square className="w-3 h-3" fill="white" />
          End Session
        </motion.button>
      )}
    </div>
  )
}
