import { Link, useLocation } from 'react-router-dom';
import { Mail, Github, Linkedin, Instagram, BookOpen } from 'lucide-react';
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
          <BookOpen className="w-10 h-10 text-earth-gold mb-6" />
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
          <p className="text-xs text-earth-light opacity-60 mb-4 italic leading-relaxed">
            "De muren luisterden mee naar wat ik nooit durfde te zeggen."
          </p>
          <div className="text-xs text-earth-light opacity-50">
            <p>&copy; {new Date().getFullYear()}</p>
            <p>KvK: 12345678 (Placeholder)</p>
            <p className="mt-2"><Link to="/privacy" className="underline hover:text-white">Privacyverklaring</Link></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
