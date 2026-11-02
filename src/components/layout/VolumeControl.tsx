import { Volume2, VolumeX, Volume1 } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';

export function VolumeControl() {
  const { ambientMuted, toggleAmbientMute, masterVolume, setMasterVolume } = useAudio();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="relative flex items-center h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={toggleAmbientMute}
        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors group"
        aria-label={ambientMuted ? "Geluid aanzetten" : "Geluid uitzetten"}
      >
        <AnimatePresence mode="wait">
          {ambientMuted ? (
            <motion.div
              key="mute"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <VolumeX className="w-5 h-5 text-white/40 group-hover:text-white transition-colors" />
            </motion.div>
          ) : masterVolume < 0.5 ? (
            <motion.div
              key="low"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Volume1 className="w-5 h-5 text-white group-hover:scale-110 transition-all" />
            </motion.div>
          ) : (
            <motion.div
              key="high"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Volume2 className="w-5 h-5 text-white group-hover:scale-110 transition-all" />
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      {/* Volume Popover */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50 pointer-events-auto"
          >
            <div className="bg-[#1a120d] border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-4 min-w-[50px]">
              <div className="h-32 flex items-center py-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={masterVolume}
                  onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
                  className="h-full w-1 rounded-full appearance-none cursor-pointer accent-earth-gold transition-all"
                  style={{
                    WebkitAppearance: 'slider-vertical',
                    background: `linear-gradient(to top, #D4AF37 ${masterVolume * 100}%, rgba(255,255,255,0.1) ${masterVolume * 100}%)`
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-earth-gold font-bold">
                {Math.round(masterVolume * 100)}%
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
