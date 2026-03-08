import { useState, useRef, useCallback, useEffect } from 'react'

export function useAudio(socketRef, phase) {
  const [isMicActive, setIsMicActive] = useState(false)
  const micStreamRef = useRef(null)
  const processorRef = useRef(null)
  const sourceRef = useRef(null)
  const micCtxRef = useRef(null)

  const startMic = useCallback(async () => {
    const socket = socketRef?.current
    if (!socket?.connected || micStreamRef.current) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })
      micStreamRef.current = stream

      const ctx = new AudioContext({ sampleRate: 16000 })
      micCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source

      const processor = ctx.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!socket?.connected) return
        const float32 = e.inputBuffer.getChannelData(0)
        const int16 = new Int16Array(float32.length)
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]))
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        socket.emit('audio_input', int16.buffer)
      }

      source.connect(processor)
      processor.connect(ctx.destination)
      setIsMicActive(true)
    } catch (e) {
      console.error('Mic access failed:', e)
    }
  }, [socketRef])

  const stopMic = useCallback(() => {
    if (processorRef.current) { processorRef.current.disconnect(); processorRef.current = null }
    if (sourceRef.current) { sourceRef.current.disconnect(); sourceRef.current = null }
    if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null }
    if (micCtxRef.current) { micCtxRef.current.close(); micCtxRef.current = null }
    setIsMicActive(false)
  }, [])

  useEffect(() => {
    if (phase === 'calibrating' || phase === 'conversation' || phase === 'adapting') {
      startMic()
    } else if (phase === 'completed' || phase === 'waiting' || phase === 'closing') {
      stopMic()
    }
  }, [phase, startMic, stopMic])

  useEffect(() => {
    return () => stopMic()
  }, [stopMic])

  return { isMicActive }
}
