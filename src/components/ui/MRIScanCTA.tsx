import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ArrowRight } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MRIScanCTAProps {
  className?: string;
}

export function MRIScanCTA({ className }: MRIScanCTAProps) {
  return (
    <div className={cn("p-8 md:p-10 bg-earth-light border border-earth-clay/10 rounded-2xl shadow-xl flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden", className)}>
      {/* Soft background glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-earth-gold/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Left Image - Medical Reference */}
      <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0 rounded-2xl overflow-hidden shadow-lg border-4 border-white relative group">
        <img 
          src="https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&q=80&w=250&h=250" 
          alt="Medische realiteit"
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-earth-clay/10 group-hover:bg-transparent transition-colors duration-500" />
      </div>

      {/* Right Content */}
      <div className="flex-1 text-center md:text-left z-10">
        <h3 className="text-xl md:text-2xl font-serif text-earth-dark mb-3 tracking-tight font-bold">
          Ontdek de medische realiteit
        </h3>
        <p className="text-earth-warm/80 text-base md:text-lg font-serif italic leading-relaxed mb-8">
          Bekijk mijn eigen MRI-beelden van de tumor die mijn leven voorgoed veranderde.
        </p>
        
        <Link 
          to="/mri-scan" 
          className="inline-flex items-center gap-3 px-6 py-3 bg-earth-dark text-white rounded-full font-bold text-xs uppercase tracking-[0.2em] hover:bg-earth-gold transition-all duration-300 shadow-md hover:shadow-lg hover:-translate-y-0.5"
        >
          Open de mri-scan <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
