import { useState } from 'react';
import { Send, Loader2, CheckCircle } from 'lucide-react';
import { NewsletterService } from '../../lib/utils';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!agreed) {
      setStatus('error');
      setMessage('U dient akkoord te gaan met de privacyverklaring om u te kunnen aanmelden.');
      return;
    }

    if (!email) {
      setStatus('error');
      setMessage('E-mailadres is verplicht.');
      return;
    }

    setStatus('loading');
    try {
      await NewsletterService.subscribe(email, firstName);
      setStatus('success');
      setMessage('Bedankt voor je inschrijving!');
      setEmail('');
      setFirstName('');
    } catch (error: any) {
      setStatus('error');
      setMessage(error.message || 'Er is iets misgegaan. Probeer het later opnieuw.');
    }
  };

  return (
    <div className="bg-earth-gold p-6 md:p-8 rounded-3xl text-center max-w-3xl mx-auto shadow-xl">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-serif text-white mb-2">Blijf op de hoogte</h2>
        <p className="text-white/90 text-sm md:text-base mb-5 leading-relaxed italic">
          Meld je aan voor de nieuwsbrief en ontvang achtergronden, updates en persoonlijke verhalen direct in je mailbox.
        </p>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in zoom-in duration-500">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-white" />
            </div>
            <p className="text-xl font-serif text-white">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col items-center gap-3.5">
            <div className="flex flex-col sm:flex-row w-full gap-3">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="Voornaam" 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-5 py-3 bg-earth-dark text-white placeholder:text-white/30 rounded-full border-none focus:ring-2 focus:ring-white/20 transition-all outline-none text-sm md:text-base"
                />
              </div>
              <div className="flex-1">
                <input 
                  type="email" 
                  placeholder="E-mailadres" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-5 py-3 bg-earth-dark text-white placeholder:text-white/30 rounded-full border-none focus:ring-2 focus:ring-white/20 transition-all outline-none text-sm md:text-base"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={agreed}
                    onChange={(e) => {
                      setAgreed(e.target.checked);
                      if (e.target.checked && status === 'error' && message.includes('privacyverklaring')) {
                        setStatus('idle');
                        setMessage('');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-4 h-4 bg-earth-dark/40 rounded border border-white/20 peer-checked:bg-earth-dark peer-checked:border-white/40 transition-colors" />
                  <CheckCircle className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" />
                </div>
                <span className="text-white/85 text-xs md:text-sm hover:text-white transition-colors">Ik ga akkoord met de privacyverklaring.</span>
              </label>
            </div>

            <button 
              type="submit"
              disabled={status === 'loading'}
              className="mt-1 flex items-center gap-2.5 px-8 py-2.5 bg-earth-moss text-white rounded-full font-medium text-sm md:text-base hover:bg-earth-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 shadow-lg group"
            >
              {status === 'loading' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span>Meld me aan</span>
                </>
              )}
            </button>
            
            {status === 'error' && (
              <p className="text-red-100 text-sm mt-2 font-medium bg-red-500/20 px-4 py-2 rounded-full border border-red-500/30 animate-bounce">
                ⚠️ {message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
