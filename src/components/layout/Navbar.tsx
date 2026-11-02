import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, BookOpen, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

const isDev = import.meta.env.DEV;

const NAV_ITEMS = [
  { name: 'Home', path: '/' },
  { name: 'Boeken', path: '/boeken' },
  { name: 'Fragmenten', path: '/fragmenten' },
  { name: 'Muziek', path: '/music' },
  { name: 'Achter de schermen', path: '/de-echo' },
  { name: 'Over mij', path: '/over-mij' },
  { name: 'Contact', path: '/contact' },
  ...(isDev ? [{ name: 'Beheer', path: '/beheer' }] : []),
];

import { VolumeControl } from './VolumeControl';
import { IvoryHeartPendant } from '../ui/IvoryHeartPendant';

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen action blocked by browser:', err);
      });
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#2D1E16] border-b border-white/5 h-16 md:h-20">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-full">
        <div className="flex flex-col gap-1 items-start">
          <Link to="/" className="flex items-center gap-3 group">
            <IvoryHeartPendant size="sm" className="shrink-0 -mt-1" />
            <span className="text-lg md:text-2xl font-serif tracking-tight text-white leading-none">
              <span className="font-bold">Paul</span> <span className="font-light opacity-80">van Geenen</span>
            </span>
          </Link>
        </div>
        
        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-3 lg:gap-10">
          <div className="flex items-center gap-2 lg:gap-8">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "nav-link text-white/50 hover:text-white uppercase text-[9px] lg:text-[10px] tracking-[0.15em] lg:tracking-[0.2em] font-bold transition-all duration-300 relative py-1",
                  location.pathname === item.path && "text-white"
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center gap-3 ml-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
                title={isFullscreen ? 'Verlaat volledig scherm' : 'Volledig scherm (F11)'}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4 text-earth-gold" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <div className="opacity-40 hover:opacity-100 transition-opacity">
                <VolumeControl />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 text-white/70 hover:text-white"
            title="Volledig scherm"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5 text-earth-gold" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            className="p-2 text-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-earth-dark-soft border-b border-white/10 px-6 py-8 flex flex-col gap-6"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "text-lg font-medium",
                  location.pathname === item.path ? "text-earth-gold font-bold" : "text-earth-light"
                )}
              >
                {item.name}
              </Link>
            ))}
            <div className="flex items-center justify-between pt-4 border-t border-white/5 opacity-80">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-2 text-xs text-earth-gold font-medium"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                <span>{isFullscreen ? 'Verlaat scherm' : 'Volledig scherm'}</span>
              </button>
              <VolumeControl />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
