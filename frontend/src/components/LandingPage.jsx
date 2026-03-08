import { motion } from 'framer-motion'
import { Heart, Waves, Brain, Shield } from 'lucide-react'

const features = [
  { icon: Heart, label: 'Heart Rate', desc: 'Real-time rPPG detection', color: '#ff6b6b' },
  { icon: Brain, label: 'Stress Analysis', desc: 'AI-powered insights', color: '#7c5ce0' },
  { icon: Waves, label: 'Breathing', desc: 'Respiratory tracking', color: '#51cf66' },
  { icon: Shield, label: 'SpO2', desc: 'Oxygen estimation', color: '#4dabf7' },
]

export default function LandingPage({ onStart, connected, error }) {
  return (
    <div className="h-screen w-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #f8f9fc 0%, #ede8fb 50%, #edf5ff 100%)' }}>

      {/* Decorative blurred circles */}
      <div className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
           style={{ background: '#7c5ce0', top: '-10%', right: '-5%' }} />
      <div className="absolute w-80 h-80 rounded-full opacity-20 blur-3xl"
           style={{ background: '#4dabf7', bottom: '-10%', left: '-5%' }} />
      <div className="absolute w-64 h-64 rounded-full opacity-20 blur-3xl"
           style={{ background: '#ff6b6b', top: '40%', left: '20%' }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="text-center z-10 max-w-xl px-6"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center shadow-lg"
          style={{ background: 'linear-gradient(135deg, #7c5ce0, #4dabf7)' }}
        >
          <Heart className="w-10 h-10 text-white" strokeWidth={1.5} />
        </motion.div>

        <h1 className="text-5xl font-bold mb-3"
            style={{ background: 'linear-gradient(135deg, #1a1d2e, #7c5ce0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          VitalSense
        </h1>
        <p className="text-lg mb-10" style={{ color: '#6b7190' }}>
          Your AI wellness companion. Real-time vitals, real conversations.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {features.map((f, i) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
              style={{ background: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            >
              <f.icon className="w-4 h-4" style={{ color: f.color }} strokeWidth={2} />
              <span className="text-sm font-medium" style={{ color: '#1a1d2e' }}>{f.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Start button */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
          whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(124, 92, 224, 0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onStart}
          disabled={!connected}
          className="px-10 py-4 rounded-2xl text-white font-semibold text-lg border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: connected ? 'linear-gradient(135deg, #7c5ce0, #4dabf7)' : '#ccc',
            boxShadow: connected ? '0 4px 20px rgba(124, 92, 224, 0.25)' : 'none',
          }}
        >
          {connected ? 'Begin Session' : 'Connecting...'}
        </motion.button>

        {/* Connection status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center justify-center gap-2 mt-5"
        >
          <span className="w-2 h-2 rounded-full"
                style={{ background: connected ? '#51cf66' : '#ffa94d', boxShadow: connected ? '0 0 8px #51cf66' : 'none' }} />
          <span className="text-xs" style={{ color: '#9ca3bc' }}>
            {connected ? 'Backend connected' : 'Waiting for backend...'}
          </span>
        </motion.div>

        {error && (
          <p className="mt-3 text-sm px-4 py-2 rounded-xl" style={{ background: '#fff0f0', color: '#ff6b6b' }}>
            {error}
          </p>
        )}
      </motion.div>
    </div>
  )
}
