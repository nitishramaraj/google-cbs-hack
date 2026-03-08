import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Volume2 } from 'lucide-react'

export default function ConversationPanel({ transcript, isPlaying, isMicActive, phase }) {
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [transcript])

  const isActive = phase === 'calibrating' || phase === 'conversation' || phase === 'adapting'

  return (
    <div className="flex flex-col h-full" style={{ background: '#ffffff' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5"
           style={{ borderBottom: '1px solid #f0f1f5' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-sm font-bold text-white"
               style={{ background: 'linear-gradient(135deg, #7c5ce0, #4dabf7)' }}>
            A
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1a1d2e' }}>Aria</p>
            <p className="text-xs" style={{ color: '#9ca3bc' }}>Wellness Companion</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPlaying && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: '#ede8fb' }}>
              <Volume2 className="w-3 h-3" style={{ color: '#7c5ce0' }} />
              <div className="flex gap-0.5 items-end h-3">
                {[1, 2, 3].map(i => (
                  <motion.div key={i}
                    animate={{ height: [4, 10 + Math.random() * 4, 4] }}
                    transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.12 }}
                    className="w-0.5 rounded-full"
                    style={{ background: '#7c5ce0' }} />
                ))}
              </div>
            </div>
          )}
          {isMicActive && !isPlaying && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: '#ecfbef' }}>
              <Mic className="w-3 h-3" style={{ color: '#51cf66' }} />
              <span className="text-xs font-medium" style={{ color: '#51cf66' }}>Listening</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
           style={{ scrollBehavior: 'smooth' }}>

        {isActive && transcript.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-12 h-12 mx-auto mb-3 rounded-2xl flex items-center justify-center"
                style={{ background: '#ede8fb' }}>
                <Volume2 className="w-6 h-6" style={{ color: '#7c5ce0' }} />
              </motion.div>
              <p className="text-sm font-medium" style={{ color: '#6b7190' }}>Aria is connecting...</p>
            </div>
          </div>
        )}

        <AnimatePresence>
          {transcript.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex ${msg.role === 'aria' ? 'justify-start' : 'justify-end'}`}
            >
              <div className="max-w-[88%] px-4 py-2.5 text-sm leading-relaxed"
                   style={{
                     background: msg.role === 'aria' ? '#f8f9fc' : '#ede8fb',
                     color: msg.role === 'aria' ? '#1a1d2e' : '#4a3a8a',
                     borderRadius: msg.role === 'aria' ? '4px 18px 18px 18px' : '18px 18px 4px 18px',
                   }}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isPlaying && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="flex gap-1.5 px-4 py-3 rounded-2xl" style={{ background: '#f8f9fc' }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#9ca3bc' }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-4 py-3 flex items-center justify-center gap-2"
           style={{ borderTop: '1px solid #f0f1f5' }}>
        {isMicActive ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-2.5 h-2.5 rounded-full" style={{ background: '#51cf66' }} />
            <span className="text-xs font-medium" style={{ color: '#6b7190' }}>Speak naturally</span>
          </>
        ) : (
          <span className="text-xs" style={{ color: '#9ca3bc' }}>
            {phase === 'closing' ? 'Wrapping up...' : 'Starting...'}
          </span>
        )}
      </div>
    </div>
  )
}
