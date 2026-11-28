import { Link, useLocation } from 'react-router-dom';
import { Mail, Github, Linkedin, Instagram, Sparkles, Play, Pause, ExternalLink } from 'lucide-react';
import { NewsletterSignup } from '../ui/NewsletterSignup';
import { useChristmasTheme } from '../../lib/christmasTheme';
import { christmasAlbumPlayer, useChristmasAlbumPlayer } from '../../lib/christmasAlbumPlayer';

export function Footer() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/beheer');
  const { isActive: isChristmasActive } = useChristmasTheme();
  const christmasPlayer = useChristmasAlbumPlayer();

  return (
    <footer className="bg-[#2D2926] text-earth-light py-16 px-6 md:px-12 lg:px-24 border-t border-earth-clay">
      {!isAdminPage && isChristmasActive && (
        <div className="max-w-7xl mx-auto mb-12 rounded-2xl border border-earth-gold/35 bg-gradient-to-r from-[#261b12] via-[#342416] to-[#261b12] p-6 md:p-8 shadow-[0_12px_40px_rgba(212,175,106,0.12)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left space-y-1.5">
            <div className="inline-flex items-center gap-2 text-earth-gold text-xs uppercase tracking-[0.22em] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Warme Kerstdagen &amp; een Gezond 2027</span>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <p className="font-serif text-lg md:text-xl text-white">
              Sta stil, kijk om je heen en zoek elkaar op deze kerst.
            </p>
            <p className="text-xs md:text-sm text-earth-light/70 max-w-xl">
              Luister naar het kerstalbum <span className="text-earth-gold italic">Echoes of Christmas</span> terwijl je rustig verder kijkt op de site — of open hem in de volledige muziekspeler.
            </p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 shrink-0">
            <button
              type="button"
              onClick={() => christmasAlbumPlayer.toggle()}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-earth-gold hover:bg-amber-300 text-black font-semibold text-xs uppercase tracking-wider shadow-lg shadow-earth-gold/20 transition-all cursor-pointer"
            >
              {christmasPlayer.isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>Pauzeer achtergrondmuziek</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 ml-0.5" />
                  <span>Luister op de achtergrond</span>
                </>
              )}
            </button>
            <Link
              to="/music?album=Echoes%20of%20Christmas"
              onClick={() => christmasAlbumPlayer.stop()}
              className="inline-flex items-center gap-1.5 text-[11px] text-earth-gold/80 hover:text-earth-gold transition-colors"
            >
              <span>Of open in de muziekspeler</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}
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
