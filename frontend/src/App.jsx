import { useState, useCallback } from 'react'
import { useSocket } from './hooks/useSocket'
import { useAudio } from './hooks/useAudio'
import LandingPage from './components/LandingPage'
import CameraFeed from './components/CameraFeed'
import AROverlay from './components/AROverlay'
import VitalsDashboard from './components/VitalsDashboard'
import SessionArc from './components/SessionArc'
import Controls from './components/Controls'

function App() {
  const [view, setView] = useState('landing') // landing | live | arc
  const { connected, vitals, vitalsHistory, landmarks, sessionArc, phase, error,
          startSession, stopSession } = useSocket()
  const { isPlaying } = useAudio()

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

  if (view === 'landing') {
    return <LandingPage onStart={handleStart} connected={connected} error={error} />
  }

  if (view === 'arc') {
    return <SessionArc data={sessionArc} onNewSession={handleNewSession} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0a0a0f' }}>
      {/* Error banner */}
      {error && (
        <div className="absolute top-0 left-0 right-0 p-3 text-center text-sm z-50"
             style={{ background: '#ff446622', color: '#ff4466', borderBottom: '1px solid #ff446644' }}>
          {error}
        </div>
      )}
      {/* Camera + Overlay: 60% */}
      <div className="relative" style={{ width: '60%' }}>
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
        />
      </div>
      {/* Dashboard: 40% */}
      <div style={{ width: '40%' }} className="h-full overflow-y-auto">
        <VitalsDashboard vitals={vitals} history={vitalsHistory} phase={phase} />
      </div>
    </div>
  )
}

export default App
