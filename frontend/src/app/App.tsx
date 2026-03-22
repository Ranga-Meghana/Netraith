import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpaceScene } from './components/SpaceScene';
import { GlobeScene } from './components/GlobeScene';
import { Dashboard } from './components/Dashboard';
import { SocketProvider } from './components/SocketProvider';

type Scene = 'space' | 'globe' | 'dashboard';

export default function App() {
  const [scene, setScene] = useState<Scene>('space');

  return (
    <SocketProvider>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          background: '#000',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Global styles */}
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Share+Tech+Mono&display=swap');
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; background: #000; }
          ::-webkit-scrollbar { width: 3px; }
          ::-webkit-scrollbar-track { background: rgba(0,0,0,0); }
          ::-webkit-scrollbar-thumb { background: rgba(0,200,180,0.3); border-radius: 2px; }
          @keyframes neon-pulse {
            0%, 100% { text-shadow: 0 0 8px rgba(0,255,212,0.8), 0 0 20px rgba(0,255,212,0.4); }
            50% { text-shadow: 0 0 20px rgba(0,255,212,1), 0 0 40px rgba(0,255,212,0.6), 0 0 80px rgba(0,255,212,0.2); }
          }
        `}</style>

        <AnimatePresence mode="wait">
          {scene === 'space' && (
            <motion.div
              key="space"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={{ duration: 1 }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <SpaceScene onComplete={() => setScene('globe')} />
            </motion.div>
          )}

          {scene === 'globe' && (
            <motion.div
              key="globe"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.08, filter: 'blur(8px)' }}
              transition={{ duration: 1.2 }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <GlobeScene onComplete={() => setScene('dashboard')} />
            </motion.div>
          )}

          {scene === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, filter: 'blur(20px)' }}
              animate={{ opacity: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <Dashboard />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scene skip buttons (dev helper) — bottom right */}
        {scene !== 'dashboard' && (
          <div
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              zIndex: 999,
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              onClick={() => setScene('dashboard')}
              style={{
                padding: '6px 14px',
                background: 'rgba(0,12,25,0.8)',
                border: '1px solid rgba(0,200,180,0.3)',
                color: 'rgba(0,200,180,0.6)',
                fontFamily: '"Share Tech Mono", monospace',
                fontSize: 9,
                letterSpacing: '0.2em',
                cursor: 'pointer',
                borderRadius: 2,
              }}
            >
              SKIP → DASHBOARD
            </button>
          </div>
        )}
      </div>
    </SocketProvider>
  );
}