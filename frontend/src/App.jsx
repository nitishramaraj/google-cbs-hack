import { useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSocket } from './hooks/useSocket'
import { useAudio } from './hooks/useAudio'
import LandingPage from './components/LandingPage'
import CameraFeed from './components/CameraFeed'
import AROverlay from './components/AROverlay'
import VitalsDashboard from './components/VitalsDashboard'
import ConversationPanel from './components/ConversationPanel'
import SessionArc from './components/SessionArc'
import Controls from './components/Controls'

function App() {
  const [view, setView] = useState('landing')
  const { connected, vitals, vitalsHistory, landmarks, sessionArc, phase, error,
          transcript, socketRef, isPlaying,
          startSession, stopSession } = useSocket()
  const { isMicActive } = useAudio(socketRef, phase)

  const handleStart = useCallback(() => {
    setView('live')
    startSession()
  }, [startSession])

  const handleStop = useCallback(() => {
    stopSession()
    setTimeout(() => setView('arc'), 1500)
  }, [stopSession])

  const handleNewSession = useCallback(() => {
    setView('landing')
  }, [])

  return (
    <AnimatePresence mode="wait">
      {view === 'landing' && (
        <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <LandingPage onStart={handleStart} connected={connected} error={error} />
        </motion.div>
      )}

      {view === 'arc' && (
        <motion.div key="arc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <SessionArc data={sessionArc} onNewSession={handleNewSession} />
        </motion.div>
      )}

      {view === 'live' && (
        <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="flex h-screen w-screen overflow-hidden" style={{ background: '#f8f9fc' }}>
          {/* Error banner */}
          {error && (
            <div className="absolute top-0 left-0 right-0 p-3 text-center text-sm z-50"
                 style={{ background: '#fff0f0', color: '#ff6b6b', borderBottom: '1px solid #ffe0e0' }}>
              {error}
            </div>
          )}

          {/* Camera + Overlay */}
          <div className="relative" style={{ width: '45%' }}>
            <CameraFeed />
            <AROverlay
              landmarks={landmarks?.landmarks}
              vitals={vitals}
              stressLevel={vitals?.stress_level || 'low'}
              pulsePeak={landmarks?.pulse_peak}
              roiPolygons={landmarks?.roi_polygons}
              signalQuality={vitals?.signal_quality}
            />
            <Controls
              phase={phase}
              connected={connected}
              onStop={handleStop}
              isPlaying={isPlaying}
              isMicActive={isMicActive}
            />
          </div>

          {/* Conversation */}
          <div style={{ width: '25%', borderLeft: '1px solid #e8eaf0', borderRight: '1px solid #e8eaf0' }}>
            <ConversationPanel
              transcript={transcript}
              isPlaying={isPlaying}
              isMicActive={isMicActive}
              phase={phase}
            />
          </div>

          {/* Dashboard */}
          <div style={{ width: '30%' }} className="h-full overflow-y-auto">
            <VitalsDashboard vitals={vitals} history={vitalsHistory} phase={phase} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default App
