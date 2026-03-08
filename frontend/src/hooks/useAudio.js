import { useState, useRef, useCallback } from 'react'

export function useAudio() {
  const [isPlaying, setIsPlaying] = useState(false)
  const ctxRef = useRef(null)
  const queueRef = useRef([])

  const getContext = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 })
    }
    return ctxRef.current
  }, [])

  const playChunk = useCallback(async (arrayBuffer) => {
    try {
      const ctx = getContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      source.onended = () => setIsPlaying(false)
      setIsPlaying(true)
      source.start()
    } catch {
      // silent fail for invalid audio chunks
    }
  }, [getContext])

  const getMicStream = useCallback(async () => {
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } })
    } catch {
      return null
    }
  }, [])

  return { isPlaying, playChunk, getMicStream }
}
