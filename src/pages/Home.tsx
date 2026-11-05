import { motion } from 'motion/react';
import { ArrowRight, Quote, Volume2, VolumeX } from 'lucide-react';
import { IvoryHeartPendant } from '../components/ui/IvoryHeartPendant';
import { Link } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import page9Img from '../assets/images/hoofdstuk9.jpg';

export function Home() {
  const { ambientMuted, toggleAmbientMute, setIsAmbientPlaying, masterVolume } = useAudio();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isPhotoHovered, setIsPhotoHovered] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const playVideo = async () => {
      if (videoRef.current) {
        videoRef.current.volume = masterVolume;
        try {
          // Add a small delay to ensure DOM is ready and interaction might have happened
          await new Promise(resolve => setTimeout(resolve, 100));
          await videoRef.current.play();
        } catch (err) {
          // Silence warning as it's common with autoplay policies
        }
      }
    };
    playVideo();
  }, [masterVolume]);

  const handleVideoStart = () => {
    setVideoLoaded(true);
    setVideoError(false);
  };

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative min-h-[65vh] lg:min-h-[75vh] flex items-center bg-earth-dark pt-4">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <video 
            ref={videoRef}
            autoPlay 
            muted 
            loop 
            playsInline
            onPlaying={handleVideoStart}
            onCanPlay={handleVideoStart}
            onLoadedData={handleVideoStart}
            onError={() => setVideoError(true)}
            className={`w-full h-full object-cover transition-opacity duration-1500 ${videoLoaded ? 'opacity-80' : 'opacity-0'}`}
          >
            <source src="/videos/home.mp4" type="video/mp4" />
            <source src="/videos/Demon.mov" type="video/quicktime" />
          </video>
          
          {/* Moody overlays for high contrast and atmosphere */}
          <div className="absolute inset-0 bg-black/20 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-earth-dark/95 via-earth-dark/50 to-transparent pointer-events-none" />
        </div>


        <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center py-6 md:py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col justify-center text-center lg:text-left items-center lg:items-start"
          >
            <span className="inline-block text-earth-gold uppercase tracking-[0.25em] text-[10px] md:text-[11px] font-bold mb-4 drop-shadow-sm">
              Vier boeken over het koesteren van het leven
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-7xl font-serif italic text-white leading-[1.1] mb-6 drop-shadow-lg">
              Van zwijgen <br />
              <span className="text-earth-gold drop-shadow-md">naar spreken.</span>
            </h1>
            <p className="text-base md:text-lg lg:text-xl text-white/80 mb-10 max-w-lg leading-relaxed font-light">
              Een tumor als keerpunt. Ontdek mijn persoonlijke verhaal door een unieke literaire reis van geboorte tot aan de diepste echo's van mijn hart.
            </p>
            <div className="flex flex-wrap gap-6 items-center justify-center lg:justify-start">
              <Link to="/boeken" className="btn-primary flex items-center gap-2 shadow-xl hover:-translate-y-1 transition-all duration-300">
                Ontdek de reeks <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </motion.div>

          {/* Photo shown on md even if 1 column, but below the text */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="md:block relative self-center w-full max-w-sm mx-auto mt-8 lg:mt-0"
          >
            <motion.div 
              initial={{ rotate: 2 }}
              animate={{ rotate: isPhotoHovered ? 0 : 2 }}
              onMouseEnter={() => setIsPhotoHovered(true)}
              onMouseLeave={() => setIsPhotoHovered(false)}
              onTapStart={() => setIsPhotoHovered(true)}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative z-10 rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)] max-w-[280px] lg:max-w-sm mx-auto cursor-pointer"
            >
              <img 
                src={page9Img} 
                alt="Hoofdstuk 9" 
                className="w-full h-auto block"
              />
            </motion.div>
            
            <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-earth-gold/10 rounded-full blur-3xl" />
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-earth-moss/10 rounded-full blur-3xl" />
          </motion.div>
        </div>


      </section>

      {/* Intro Section */}
      <section className="section-padding bg-white relative overflow-hidden">
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="flex flex-col items-center justify-center mb-6">
            <IvoryHeartPendant size="lg" />
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-8 text-earth-dark">Het keerpunt</h2>
          <div className="space-y-6 text-lg text-earth-warm leading-relaxed">
            <p>
              Veertig jaar lang heb ik gezwegen. En dat zwijgen heeft me bijna kapotgemaakt. Een tumor dwong mij eindelijk te kijken naar wat ik zo wanhopig had weggestopt: de schaamte, de verlamming, de spijt die elke nacht aan me vrat. Wat volgde was geen verhaal, maar een bloederige ontleding — van de verstikkende cocon van mijn jeugd, via de korte, wilde ontwaking van de leeuw, naar de diepe, zwarte afgrond waarin één seconde van lafheid een heel leven kan vernietigen. 
            </p>
            <p>
              Dit vierluik is geen boek. Dit is het openrijten van oude wonden. Dit is de echo die veertig jaar in mijn ziel huilt en vreet. Dit is de pijn die ik niemand gun. Durf je écht naar binnen te kijken?
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
