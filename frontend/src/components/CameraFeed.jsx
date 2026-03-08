import { useEffect, useRef, useState } from 'react'

export default function CameraFeed() {
  const videoRef = useRef(null)
  const [status, setStatus] = useState('connecting') // connecting | active | error

  useEffect(() => {
    let stream = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {})
            setStatus('active')
          }
        }
      } catch (err) {
        console.warn('Camera access failed:', err.name, err.message)
        setStatus('error')
      }
    }

    startCamera()

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: '#0a0a0f' }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full"
        style={{
          objectFit: 'cover',
          transform: 'scaleX(-1)',
          display: status === 'active' ? 'block' : 'none',
        }}
      />

      {status === 'error' && (
        <div className="w-full h-full flex items-center justify-center" style={{
          background: 'radial-gradient(circle at center, #12121a 0%, #0a0a0f 100%)'
        }}>
          <div className="text-center">
            <p className="text-lg font-semibold" style={{ color: '#ff4466' }}>Camera Unavailable</p>
            <p className="text-sm mt-2" style={{ color: '#8888aa' }}>
              Allow camera access in your browser to see the video feed.
            </p>
            <p className="text-xs mt-3" style={{ color: '#555' }}>
              Vitals are still being captured by the backend pipeline.
            </p>
          </div>
        </div>
      )}

      {status === 'connecting' && (
        <div className="w-full h-full flex items-center justify-center" style={{
          background: 'radial-gradient(circle at center, #12121a 0%, #0a0a0f 100%)'
        }}>
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                 style={{ borderColor: '#00d4ff', borderTopColor: 'transparent' }} />
            <p style={{ color: '#8888aa' }}>Connecting to camera...</p>
          </div>
        </div>
      )}
    </div>
  )
}
