import { motion } from 'motion/react';
import { Play } from 'lucide-react';

interface FragmentVideoLoopProps {
  videoUrl: string;
  title: string;
  subtitle?: string;
}

export function FragmentVideoLoop({ videoUrl, title, subtitle }: FragmentVideoLoopProps) {
  return (
    <div className="relative aspect-video rounded-3xl overflow-hidden group border border-border-subtle shadow-lg">
      <div className="absolute inset-0 bg-earth-dark/40 group-hover:bg-earth-dark/20 transition-all z-10"></div>
      
      <video 
        src={videoUrl}
        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
        autoPlay
        muted
        loop
        playsInline
      />
      
      <div className="absolute inset-0 z-20 p-8 flex flex-col justify-end">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          <h3 className="text-2xl font-serif font-bold text-white mb-1">{title}</h3>
          {subtitle && <p className="text-white/70 text-sm italic">{subtitle}</p>}
        </motion.div>
      </div>
      
      <div className="absolute top-4 right-4 z-20">
        <span className="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-[10px] text-white uppercase tracking-widest">
          Sfeerfragment
        </span>
      </div>
    </div>
  );
}
