import { motion } from 'motion/react';
import { useRef, useEffect, useState } from 'react';
import { useAudio } from '../context/AudioContext';

export function About() {
  const { masterVolume, ambientMuted } = useAudio();
  const [isLionVisible, setIsLionVisible] = useState(false);
  const [isRoaring, setIsRoaring] = useState(false);
  const roaringVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const growlRef = useRef<HTMLAudioElement | null>(null);
  const lastTapRef = useRef<number>(0);

  const handleInteraction = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double click detected
      setIsLionVisible(false); // Make the side lion retreat to the right immediately
      setTimeout(() => {
        startRoaringSequence();
      }, 3000); // Wait 3 seconds before starting the roar sequence
    } else {
      // Single click potential - wait a bit to see if it's a double click
      setTimeout(() => {
        if (Date.now() - lastTapRef.current >= DOUBLE_TAP_DELAY) {
          setIsLionVisible(true);
          playGrowl();
          // Hide lion after roar duration
          setTimeout(() => setIsLionVisible(false), 3000);
        }
      }, DOUBLE_TAP_DELAY);
    }
    lastTapRef.current = now;
  };

  const startRoaringSequence = () => {
    setIsRoaring(true);
    if (roaringVideoRef.current) {
      roaringVideoRef.current.currentTime = 0;
      roaringVideoRef.current.play().catch(() => {});
    }
  };

  const onRoaringEnd = () => {
    setIsRoaring(false);
  };

  useEffect(() => {
    growlRef.current = new Audio('/audio/lion-growl.mp3');
  }, []);


  const playGrowl = () => {
    if (!ambientMuted && growlRef.current) {
      growlRef.current.currentTime = 0;
      growlRef.current.play().catch(() => {
        // Silently handle autoplay restrictions or missing file
      });
    }
  };

  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.playbackRate = 0.5; // Slow down the video
      bgVideoRef.current.play().catch(() => {
        // Handle potential autoplay block gracefully
      });
    }
  }, []);

  useEffect(() => {
    const effectiveVolume = ambientMuted ? 0 : masterVolume;
    
    if (growlRef.current) {
      growlRef.current.volume = effectiveVolume * 0.8;
    }
    if (roaringVideoRef.current) {
      roaringVideoRef.current.volume = effectiveVolume;
    }
  }, [masterVolume, ambientMuted]);

  return (
    <div className="bg-[#FDFCFB] min-h-screen relative overflow-hidden">
      {/* Background Video Loop - High visibility with readability protection */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden h-full w-full">
        <video 
          ref={bgVideoRef}
          autoPlay 
          muted 
          loop 
          playsInline
          className="w-full h-full object-cover opacity-[0.3] saturate-[0.9]"
        >
          <source src="/videos/home.mp4" type="video/mp4" />
        </video>
        {/* Readability overlay: subtle white tint to separate text from video */}
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] z-10" />
      </div>

      <section className="section-padding max-w-7xl mx-auto pt-24 md:pt-32 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          
          {/* Image/Video Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-5 relative lg:sticky lg:top-32"
          >
            <motion.div 
              className="relative cursor-pointer"
              onMouseEnter={() => {
                if (!isRoaring) {
                  setIsLionVisible(true);
                  playGrowl();
                }
              }}
              onMouseLeave={() => setIsLionVisible(false)}
              onTap={handleInteraction}
            >
              <motion.div 
                initial={{ rotate: -2 }}
                animate={{ rotate: isLionVisible ? 0 : -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] relative z-10 border-[12px] border-white bg-earth-dark/5 transition-shadow"
              >
                {/* Main Portrait Base (The Photo) */}
                <motion.div
                  animate={{ opacity: isRoaring ? 0 : 1 }}
                  transition={{ duration: 1 }}
                  className="absolute inset-0"
                >
                  <img 
                    src="/images/pvg001.jpg" 
                    alt="Paul van Geenen"
                    className="w-full h-full object-cover object-[65%_center]"
                    onError={(e) => {
                      // Fallback if image doesn't exist
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800';
                    }}
                  />
                </motion.div>

                {/* Brullende Leeuw Video (Fades in during roar) */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isRoaring ? 1 : 0 }}
                  transition={{ duration: 0.8 }}
                  className="absolute inset-0 z-30 bg-black"
                >
                  <video 
                    ref={roaringVideoRef}
                    playsInline
                    onEnded={onRoaringEnd}
                    className="w-full h-full object-cover"
                  >
                    <source src="/videos/Brullende_leeuw.mov" type="video/mp4" />
                  </video>
                </motion.div>

                {/* Ghost Lion (Single Tap effect) */}
                <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                  <motion.img 
                    src="/images/lion1.png" 
                    alt="" 
                    initial={{ opacity: 0, x: "100%", filter: "blur(4px)" }}
                    animate={{ 
                      opacity: (isLionVisible && !isRoaring) ? 0.7 : 0, 
                      x: (isLionVisible && !isRoaring) ? "33.33%" : "100%",
                      filter: (isLionVisible && !isRoaring) ? "blur(0px)" : "blur(4px)"
                    }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                    className="absolute right-0 top-0 h-full w-auto object-contain object-right brightness-125 contrast-125"
                  />
                </div>
                
                {/* Subtle light leak/glow on hover */}
                <motion.div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent to-earth-warm/5 pointer-events-none z-10" 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: isLionVisible ? 1 : 0 }}
                  transition={{ duration: 0.5 }}
                />
              </motion.div>
              
              {/* Decorative accents */}
              <div className="absolute -bottom-8 -right-8 w-64 h-64 bg-earth-clay/10 rounded-full blur-3xl z-0" />
              <div className="absolute -top-12 -left-12 w-32 h-32 border-l-2 border-t-2 border-earth-gold/30 rounded-tl-3xl z-0" />
            </motion.div>
          </motion.div>

          {/* Text Content Column */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
            className="lg:col-span-7"
          >
            <header className="mb-12 relative">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-block text-earth-gold uppercase tracking-[0.3em] text-xs font-bold mb-4"
              >
                Mijn Verhaal
              </motion.span>
              <h1 className="text-5xl md:text-7xl font-serif italic text-earth-dark leading-[1.1] mb-6">
                Wie ben ik?
              </h1>
              
              <div className="absolute -top-10 -right-20 text-[15rem] font-serif font-black text-earth-dark/[0.06] select-none pointer-events-none hidden xl:block">
                Paul
              </div>
            </header>

            <div className="prose prose-xl prose-earth max-w-none">
              <motion.p 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="font-serif italic text-2xl md:text-3xl text-earth-dark mb-12 leading-tight border-l-4 border-earth-gold pl-8 py-2 bg-earth-gold/[0.03]"
              >
                "Het leven is een cadeau dat we te vaak ongeopend laten liggen."
              </motion.p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-earth-warm leading-relaxed text-lg">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="space-y-6"
                >
                  <p>
                    <span className="text-4xl font-serif font-bold text-earth-gold float-left mr-3 mt-1 leading-none">G</span>
                    eboren in een tijd van stilte, vocht ik mijn allereerste strijd uit in de kille glazen muren van een couveuse.
                    Jarenlang was zwijgen mijn veiligste cocon, mijn ultieme bescherming tegen een wereld die vaak te luid was.
                  </p>
                  <p>
                    Mijn ware stem vond ik destijds pas op twee plekken: hoog op het oksaal, waar ik de hemel bestormde achter de klavieren van een majestueus kerkorgel, en later in de stille, perfecte logica van computercode.
                  </p>
                </motion.div>

                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: 0.2 }}
                   className="space-y-6"
                >
                  <p>
                    Op mijn zestigste dwong een tumor – een onzichtbare, fluisterende demoon – mij om de stilte definitief te doorbreken. Het besef sloeg in als een bliksem: mijn levensverhaal was te groot, te rauw en te echt om in voorgedrukte vakjes te stoppen.
                  </p>
                  <p>
                    In mijn reeks boeken neem ik je mee op een adembenemende reis. Van de deinende gewelven van een kerk naar de eenzame, donkerste dalen en de absolute toppen van mijn bestaan.
                  </p>
                </motion.div>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="mt-16 pt-12 border-t border-earth-gold/10 text-center"
              >
                <p className="text-2xl md:text-3xl font-serif italic text-earth-dark/40 leading-relaxed max-w-2xl mx-auto">
                  Vandaag de dag zwijg ik niet meer. Ik spreek, ik schrijf en ik brul. Muziek en de oerkracht van woorden hebben de leeuw in mij voorgoed doen ontwaken.
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
