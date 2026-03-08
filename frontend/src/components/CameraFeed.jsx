import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, CameraOff } from 'lucide-react'

export default function CameraFeed() {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    // Backend owns the camera, show a placeholder
    // Try to get a preview stream for the user
    let stream = null
    async function startPreview() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setStatus('active')
        }
      } catch {
        setStatus('error')
      }
    }
    startPreview()
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="relative w-full h-full overflow-hidden"
         style={{ background: '#f0f2f8', borderRadius: '0' }}>
      {status === 'active' && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      )}

      {status === 'connecting' && (
        <div className="flex items-center justify-center h-full">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-center"
          >
            <Camera className="w-10 h-10 mx-auto mb-3" style={{ color: '#9ca3bc' }} />
            <p className="text-sm" style={{ color: '#9ca3bc' }}>Starting camera...</p>
          </motion.div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <CameraOff className="w-10 h-10 mx-auto mb-3" style={{ color: '#9ca3bc' }} />
            <p className="text-sm" style={{ color: '#6b7190' }}>Camera in use by backend</p>
            <p className="text-xs mt-1" style={{ color: '#9ca3bc' }}>Vitals are being captured</p>
          </div>
        </div>
      )}
    </div>
  )
}
