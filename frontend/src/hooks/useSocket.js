import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

export function useSocket() {
  const [connected, setConnected] = useState(false)
  const [vitals, setVitals] = useState(null)
  const [vitalsHistory, setVitalsHistory] = useState([])
  const [landmarks, setLandmarks] = useState(null)
  const [sessionArc, setSessionArc] = useState(null)
  const [phase, setPhase] = useState('waiting')
  const [error, setError] = useState(null)
  const socketRef = useRef(null)

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
      console.log('Socket.IO disconnected')
      setConnected(false)
    })

    socket.on('connect_error', (err) => {
      console.error('Socket.IO connection error:', err.message)
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
      console.log('Received session arc', data)
      setSessionArc(data)
    })

    socket.on('phase_change', (data) => {
      console.log('Phase change:', data.phase)
      setPhase(data.phase)
    })

    socket.on('connection_status', (data) => {
      console.log('Connection status:', data)
    })

    socket.on('conversation_event', (data) => {
      console.log('Gemini event:', data)
    })

    socket.on('error', (data) => {
      console.error('Server error:', data.message)
      setError(data.message)
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const startSession = useCallback(() => {
    setVitalsHistory([])
    setSessionArc(null)
    setError(null)

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

  return { connected, vitals, vitalsHistory, landmarks, sessionArc, phase, error, startSession, stopSession, sendAudio }
}
