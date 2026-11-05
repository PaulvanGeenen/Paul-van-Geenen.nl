import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { isLionBooksDomain } from '../../utils/domain';

interface LionBooksIntroProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

export function LionBooksIntro({ forceShow = false, onComplete }: LionBooksIntroProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user already saw the intro in this browser session
    const hasSeen = sessionStorage.getItem('lion_books_intro_seen');
    const isLion = isLionBooksDomain();
    const urlParams = new URLSearchParams(window.location.search);
    const forceParam = urlParams.has('intro') || urlParams.has('splash');

    // Show if forced by prop, URL param, or if first time in session (prioritizing lionbooks.nl or initial entry)
    if (forceShow || forceParam || (!hasSeen && isLion) || (!hasSeen && window.location.pathname === '/')) {
      setIsVisible(true);
      sessionStorage.setItem('lion_books_intro_seen', 'true');

      // Auto dismiss after 3.6 seconds total cinematic duration
      const timer = setTimeout(() => {
        handleDismiss();
      }, 3600);

      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('lion_books_intro_seen', 'true');
    if (onComplete) {
      setTimeout(onComplete, 800);
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
            scale: 1.06,
            filter: 'blur(10px)',
            transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] }
          }}
          onClick={handleDismiss}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0c0a09] cursor-pointer select-none overflow-hidden"
        >
          {/* Subtle warm ambient radial background glow */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-60"
            style={{
              background: 'radial-gradient(circle at 50% 45%, rgba(212, 175, 55, 0.18) 0%, rgba(20, 15, 12, 0.8) 55%, #0c0a09 100%)'
            }}
          />

          {/* Golden light rays / soft animated pulse behind the lion */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.85, 1.15, 1.05],
              opacity: [0, 0.5, 0.35]
            }}
            transition={{ duration: 3.2, ease: "easeOut" }}
            className="absolute w-[360px] h-[360px] sm:w-[500px] sm:h-[500px] rounded-full bg-gradient-to-tr from-amber-600/20 via-yellow-500/25 to-amber-200/10 blur-3xl pointer-events-none"
          />

          {/* Central Showcase Container */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-xl">
            
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
                    'drop-shadow(0 10px 25px rgba(212,175,55,0.3))',
                    'drop-shadow(0 15px 45px rgba(212,175,55,0.6))',
                    'drop-shadow(0 12px 35px rgba(212,175,55,0.45))'
                  ]
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
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
                transition={{ delay: 1.0, duration: 1.1, ease: "easeOut" }}
                className="text-xs sm:text-sm md:text-base font-light text-amber-300/90 tracking-[0.45em] uppercase font-sans"
              >
                Publishing
              </motion.div>
            </motion.div>

            {/* Elegant Divider */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ delay: 1.3, duration: 0.8, ease: "easeOut" }}
              className="w-32 sm:w-48 h-[1px] bg-gradient-to-r from-transparent via-[#C9A96E]/70 to-transparent my-4 sm:my-5"
            />

            {/* Tagline / Fonds */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: 1.6, duration: 0.8 }}
              className="text-xs sm:text-sm font-serif italic text-amber-100/70 tracking-widest"
            >
              Uitgeversfonds van Paul van Geenen
            </motion.p>
          </div>

          {/* Subtle click to skip indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.8, duration: 0.6 }}
            className="absolute bottom-6 sm:bottom-8 text-[11px] font-sans text-amber-200/50 tracking-widest uppercase hover:opacity-90 transition-opacity"
          >
            Tik om direct te openen &rarr;
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
