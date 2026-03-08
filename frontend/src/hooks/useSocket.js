import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

// Global audio player — survives re-renders
let audioCtx = null
let nextPlayTime = 0
let playingCount = 0
let onPlayingChange = null

function getAudioCtx() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playPcmChunk(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 2) return
  try {
    const ctx = getAudioCtx()
    const int16 = new Int16Array(arrayBuffer)
    const float32 = new Float32Array(int16.length)
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0
    }

    const buf = ctx.createBuffer(1, float32.length, 24000)
    buf.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = buf
    source.connect(ctx.destination)

    const now = ctx.currentTime
    if (nextPlayTime < now - 0.2 || nextPlayTime === 0) {
      nextPlayTime = now + 0.01
    }
    source.start(nextPlayTime)
    nextPlayTime += buf.duration

    playingCount++
    if (onPlayingChange) onPlayingChange(true)

    source.onended = () => {
      playingCount--
      if (playingCount <= 0) {
        playingCount = 0
        if (onPlayingChange) onPlayingChange(false)
      }
    }
  } catch (e) {
    console.error('PCM play error:', e)
  }
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [vitals, setVitals] = useState(null)
  const [vitalsHistory, setVitalsHistory] = useState([])
  const [landmarks, setLandmarks] = useState(null)
  const [sessionArc, setSessionArc] = useState(null)
  const [phase, setPhase] = useState('waiting')
  const [error, setError] = useState(null)
  const [transcript, setTranscript] = useState([])
  const [isPlaying, setIsPlaying] = useState(false)
  const socketRef = useRef(null)

  // Wire playing state
  useEffect(() => {
    onPlayingChange = setIsPlaying
    return () => { onPlayingChange = null }
  }, [])

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Socket.IO connected')
      setConnected(true)
      setError(null)
    })

    socket.on('disconnect', () => {
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      setError('Cannot connect to backend. Is the server running?')
    })

    socket.on('vitals_update', (data) => {
      setVitals(data)
      setVitalsHistory(prev => [...prev, { ...data, t: Date.now() }].slice(-120))
    })

    socket.on('overlay_data', (data) => {
      setLandmarks(data)
    })

    socket.on('session_arc', (data) => {
      setSessionArc(data)
    })

    socket.on('phase_change', (data) => {
      setPhase(data.phase)
    })

    socket.on('connection_status', () => {})

    // Gemini audio — play directly
    socket.on('audio_output', (data) => {
      let buf = data
      if (data instanceof Uint8Array) {
        buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      }
      playPcmChunk(buf)
    })

    // Gemini text transcript
    socket.on('gemini_text', (data) => {
      setTranscript(prev => [...prev, { role: 'aria', text: data.text, time: Date.now() }].slice(-50))
    })

    socket.on('conversation_event', (data) => {
      // Also capture transcripts from events
      if (data.type === 'gemini_transcript' && data.text) {
        setTranscript(prev => [...prev, { role: 'aria', text: data.text, time: Date.now() }].slice(-50))
      }
    })

    socket.on('error', (data) => {
      setError(data.message)
    })

    return () => { socket.disconnect() }
  }, [])

  const startSession = useCallback(() => {
    setVitalsHistory([])
    setSessionArc(null)
    setTranscript([])
    setError(null)
    nextPlayTime = 0
    playingCount = 0

    // Init AudioContext on user gesture
    getAudioCtx()

    if (socketRef.current?.connected) {
      socketRef.current.emit('start_session')
      setPhase('calibrating')
    } else {
      setError('Not connected to backend. Please start the server first.')
    }
  }, [])

  const stopSession = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop_session')
    }
  }, [])

  const sendAudio = useCallback((data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('audio_input', data)
    }
  }, [])

  return {
    connected, vitals, vitalsHistory, landmarks, sessionArc, phase, error,
    transcript, socketRef, isPlaying,
    startSession, stopSession, sendAudio,
  }
}
