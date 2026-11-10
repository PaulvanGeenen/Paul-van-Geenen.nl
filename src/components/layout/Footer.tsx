import { Link, useLocation } from 'react-router-dom';
import { Mail, Github, Linkedin, Instagram } from 'lucide-react';
import { NewsletterSignup } from '../ui/NewsletterSignup';

export function Footer() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/beheer');

  return (
    <footer className="bg-[#2D2926] text-earth-light py-16 px-6 md:px-12 lg:px-24 border-t border-earth-clay">
      {!isAdminPage && (
        <div className="max-w-7xl mx-auto mb-16 pb-16 border-b border-earth-clay/10">
          <NewsletterSignup />
        </div>
      )}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
        <div className="col-span-1 md:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <img 
              src="/images/lion-books-emblem.jpg" 
              alt="Lion Books Publishing" 
              className="w-16 h-16 md:w-20 md:h-20 rounded-2xl object-cover border-2 border-earth-gold/50 shadow-2xl shrink-0" 
            />
            <div className="flex flex-col">
              <span className="font-serif font-bold text-white text-xl md:text-2xl tracking-wide">Lion Books Publishing</span>
              <span className="text-xs text-earth-gold font-mono uppercase tracking-widest mt-0.5">Onafhankelijk Uitgeversfonds</span>
            </div>
          </div>
          <p className="text-earth-light opacity-60 max-w-md leading-relaxed italic">
            Deze vier boeken zijn geen gewone memoires; ze vormen samen één rauw, kloppend levenswerk over de meest allesbepalende periode uit mijn bestaan. Hoewel ze een krachtig chronologisch geheel vormen, zijn de delen ook uitstekend los van elkaar te lezen.
          </p>
        </div>

        <div>
          <h4 className="font-bold border-b border-earth-warm pb-2 mb-4">Navigatie</h4>
          <ul className="space-y-2 text-earth-light opacity-60 text-sm">
            <li><Link to="/" className="hover:text-white transition-colors">Home</Link></li>
            <li><Link to="/boeken" className="hover:text-white transition-colors">Alle Boeken</Link></li>
            <li><Link to="/fragmenten" className="hover:text-white transition-colors">Fragmenten</Link></li>
            <li><Link to="/de-echo" className="hover:text-white transition-colors">Achter de schermen</Link></li>
            <li><Link to="/over-mij" className="hover:text-white transition-colors">Wie ben ik</Link></li>
            <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold border-b border-earth-warm pb-2 mb-4">Inspiratie</h4>
          <p className="text-xs text-earth-light opacity-60 italic leading-relaxed">
            "De muren luisterden mee naar wat ik nooit durfde te zeggen."
          </p>
        </div>
      </div>

      {/* Official Copyright Bar */}
      <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-earth-clay/20 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-earth-light/70">
        <p className="font-medium text-white/85 text-center sm:text-left">
          &copy; 2026 Paul van Geenen / Lion Books. Alle rechten voorbehouden.
        </p>
        <div className="shrink-0">
          <Link to="/privacy" className="underline hover:text-white transition-colors">Privacyverklaring</Link>
        </div>
      </div>
    </footer>
  );
}
