import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isLionBooksDomain } from '../../utils/domain';

interface LionBooksIntroProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function LionBooksIntro({ forceShow = false, onComplete }: LionBooksIntroProps) {
  // Synchronous initialization prevents ANY flash/FOUC of the underlying site
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const forceParam = urlParams.has('intro') || urlParams.has('splash');
      if (forceShow || forceParam) return true;

      const hasSeen = sessionStorage.getItem('lion_books_intro_seen_v6');
      const isLion = isLionBooksDomain();
      return (!hasSeen && isLion) || (!hasSeen && window.location.pathname === '/');
    } catch (e) {
      return false;
    }
  });

  // Accurate detection: only show "tik" on true touch-first mobile/tablet devices (coarse pointer without hover)
  const [isTouch, setIsTouch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  });

  useEffect(() => {
    const checkTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    setIsTouch(checkTouch);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('lion_books_intro_seen_v6', 'true');
    if (onComplete) {
      setTimeout(onComplete, 2200);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="lion-intro-overlay"
          initial={{ opacity: 1 }}
          exit={{ 
            opacity: 0,
            transition: { duration: 2.2, ease: [0.22, 1, 0.36, 1] }
          }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0c0a09] cursor-pointer select-none overflow-hidden"
        >
          {/* Subtle warm ambient radial background glow */}
          <motion.div 
            exit={{ opacity: 0, scale: 1.2, transition: { duration: 2.0, ease: "easeInOut" } }}
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(circle at 50% 45%, rgba(212, 175, 55, 0.18) 0%, rgba(20, 15, 12, 0.8) 55%, #0c0a09 100%)'
            }}
          />

          {/* Golden light rays / soft animated pulse behind the lion */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.9, 1.15, 0.95],
              opacity: [0.2, 0.45, 0.3]
            }}
            exit={{
              scale: 1.35,
              opacity: 0,
              transition: { duration: 2.0, ease: "easeInOut" }
            }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-[360px] h-[360px] sm:w-[520px] sm:h-[520px] rounded-full bg-gradient-to-tr from-amber-600/20 via-yellow-500/25 to-amber-200/10 blur-3xl pointer-events-none"
          />

          {/* Central Showcase Container */}
          <motion.div 
            exit={{ 
              scale: 1.08, 
              y: -15,
              opacity: 0, 
              filter: 'blur(10px)',
              transition: { duration: 1.8, ease: [0.22, 1, 0.36, 1] } 
            }}
            className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-xl"
          >
            
            {/* The Majestic Golden Lion Emblem */}
            <motion.div
              initial={{ scale: 0.72, opacity: 0, y: 25 }}
              animate={{ 
                scale: 1, 
                opacity: 1, 
                y: 0 
              }}
              transition={{ 
                duration: 1.3, 
                ease: [0.16, 1, 0.3, 1] 
              }}
              className="relative mb-6 sm:mb-8"
            >
              {/* Outer soft glow halo */}
              <div className="absolute inset-0 rounded-full blur-2xl bg-amber-400/20 scale-110 pointer-events-none" />

              <motion.img
                src="/images/lion-books-emblem.png"
                alt="Lion Books Publishing"
                className="w-44 h-44 sm:w-60 sm:h-60 md:w-72 md:h-72 object-contain relative drop-shadow-[0_10px_35px_rgba(212,175,55,0.45)]"
                animate={{
                  filter: [
                    'drop-shadow(0 10px 25px rgba(212,175,55,0.35))',
                    'drop-shadow(0 16px 45px rgba(212,175,55,0.65))',
                    'drop-shadow(0 12px 35px rgba(212,175,55,0.4))'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>

            {/* Title: Lion Books */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-1.5"
            >
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-bold tracking-[0.18em] sm:tracking-[0.22em] text-transparent bg-clip-text bg-gradient-to-b from-[#FFFDF8] via-[#F4E4BA] to-[#C9A96E] uppercase drop-shadow-md">
                Lion Books
              </h1>

              {/* Sub-label: PUBLISHING */}
              <motion.div
                initial={{ opacity: 0, letterSpacing: '0.2em' }}
                animate={{ opacity: 1, letterSpacing: '0.45em' }}
                transition={{ delay: 0.9, duration: 1.1, ease: "easeOut" }}
                className="text-xs sm:text-sm md:text-base font-light text-amber-300/90 tracking-[0.45em] uppercase font-sans"
              >
                Publishing
              </motion.div>
            </motion.div>

            {/* Elegant Divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8, ease: "easeOut" }}
              className="w-32 sm:w-48 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/70 to-transparent my-4 sm:my-5"
            />

            {/* Tagline / Fonds */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: 1.4, duration: 0.8 }}
              className="text-xs sm:text-sm font-serif italic text-amber-100/70 tracking-widest"
            >
              Uitgeversfonds van Paul van Geenen
            </motion.p>

            {/* Subtiele, rustige hint zonder kaders - past zich aan op apparaat */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.45, 0.35] }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              transition={{ delay: 1.8, duration: 1.2 }}
              className="mt-12 text-[11px] sm:text-xs font-light text-amber-200/40 tracking-[0.25em] lowercase hover:text-amber-200/80 transition-colors cursor-pointer"
            >
              {isTouch ? 'tik om verder te gaan' : 'klik om verder te gaan'}
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
