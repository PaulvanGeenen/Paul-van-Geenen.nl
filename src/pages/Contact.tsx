import { motion } from 'motion/react';
import { Mail, MapPin, Send } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function Contact() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const bgVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.playbackRate = 0.5; // Slow down the video
      bgVideoRef.current.play().catch(() => {
        // Handle potential autoplay block gracefully
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    
    try {
      // PROBEER EERST PHP (voor live hosting zoals TransIP)
      // Als dit op je lokale machine (npm run dev) niet werkt is dat logisch, 
      // want je hebt daar waarschijnlijk geen PHP server draaien.
      let response = await fetch('/contact.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      // Als PHP niet gevonden wordt (zoals in de AI Studio preview of lokaal), probeer dan de Node.js API
      if (response.status === 404) {
        response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }

      if (!response.ok) {
        throw new Error('Verzenden mislukt');
      }

      setStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Contact error:', error);
      setStatus('error');
    }
  };

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
          
          {/* Header & Info Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-5"
          >
            <header className="mb-12 relative">
              <span className="inline-block text-earth-gold uppercase tracking-[0.3em] text-xs font-bold mb-4">
                Van zwijgen naar spreken.
              </span>
              <h1 className="text-5xl md:text-7xl font-serif italic text-earth-dark leading-[1.1] mb-6">
                Contact
              </h1>
              
              <div className="absolute -top-10 -left-10 text-[15rem] font-serif font-black text-earth-dark/[0.06] select-none pointer-events-none hidden xl:block">
                Brief
              </div>
            </header>

            <div className="space-y-6 text-earth-warm leading-relaxed text-base md:text-lg mb-12">
              <p>
                Heb je een vraag, wil je reageren op een van mijn boeken of me uitnodigen voor een lezing? 
                Ik hoor graag van je. Vul het formulier in en ik neem zo snel mogelijk contact met je op.
              </p>
            </div>

            <div className="space-y-8 relative z-10">
              <a 
                href="mailto:info@paulvangeenen.nl" 
                className="flex items-center gap-6 group/item w-fit"
              >
                <div className="p-4 bg-earth-dark text-earth-gold rounded-2xl group-hover/item:bg-earth-gold group-hover/item:text-white transition-colors duration-300">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-earth-warm mb-1">Stuur een e-mail</p>
                  <p className="text-lg font-serif font-bold text-earth-dark underline decoration-earth-gold/30 underline-offset-4 group-hover/item:decoration-earth-gold transition-all">
                    info@paulvangeenen.nl
                  </p>
                </div>
              </a>
            </div>
          </motion.div>

          {/* Form Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-7"
          >
            <motion.div
              className="bg-white p-8 md:p-12 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-black/5"
            >
              {status === 'success' ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
                  <div className="w-20 h-20 bg-earth-gold/10 text-earth-gold rounded-full flex items-center justify-center">
                    <Send className="w-10 h-10" />
                  </div>
                  <h3 className="text-3xl font-serif font-bold text-earth-dark">Bericht verzonden!</h3>
                  <p className="text-earth-warm">Bedankt voor je bericht. Ik neem zo snel mogelijk contact met je op.</p>
                  <button onClick={() => setStatus('idle')} className="text-earth-clay font-bold underline decoration-earth-gold underline-offset-4 mt-4 hover:text-earth-dark transition-colors">Stuur nog een bericht</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label htmlFor="form-name" className="text-[10px] uppercase tracking-widest font-black text-earth-dark">Jouw Naam</label>
                      <input 
                        required 
                        id="form-name"
                        name="name"
                        type="text" 
                        autoComplete="name"
                        className="w-full px-0 py-4 bg-transparent border-b-2 border-earth-clay/10 focus:border-earth-gold focus:outline-none transition-colors text-lg font-serif placeholder:text-earth-warm/30 italic" 
                        placeholder="Wie ben je?" 
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3">
                      <label htmlFor="form-email" className="text-[10px] uppercase tracking-widest font-black text-earth-dark">E-mailadres</label>
                      <input 
                        required 
                        id="form-email"
                        name="email"
                        type="email" 
                        autoComplete="email"
                        className="w-full px-0 py-4 bg-transparent border-b-2 border-earth-clay/10 focus:border-earth-gold focus:outline-none transition-colors text-lg font-serif placeholder:text-earth-warm/30 italic" 
                        placeholder="Hoe bereik ik je?" 
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="form-subject" className="text-[10px] uppercase tracking-widest font-black text-earth-dark">Onderwerp</label>
                    <input 
                      required 
                      id="form-subject"
                      name="subject"
                      type="text" 
                      className="w-full px-0 py-4 bg-transparent border-b-2 border-earth-clay/10 focus:border-earth-gold focus:outline-none transition-colors text-lg font-serif placeholder:text-earth-warm/30 italic" 
                      placeholder="Waar gaat het over?" 
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    />
                  </div>
                  <div className="space-y-3">
                    <label htmlFor="form-message" className="text-[10px] uppercase tracking-widest font-black text-earth-dark">Jouw Bericht</label>
                    <textarea 
                      required 
                      id="form-message"
                      name="message"
                      rows={6} 
                      className="w-full px-0 py-4 bg-transparent border-b-2 border-earth-clay/10 focus:border-earth-gold focus:outline-none transition-colors text-lg font-serif placeholder:text-earth-warm/30 italic resize-none" 
                      placeholder="Deel hier je verhaal of vraag..." 
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>
                  {status === 'error' && (
                    <p className="text-rose-500 text-sm font-bold bg-rose-50 p-4 rounded-xl">Oeps! Er ging iets mis bij het verzenden. Probeer het later opnieuw.</p>
                  )}
                  <button 
                    type="submit" 
                    disabled={status === 'loading'} 
                    className="w-full bg-earth-dark text-white py-6 rounded-2xl font-bold uppercase tracking-[0.3em] text-xs hover:bg-earth-gold transition-all duration-500 shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:translate-y-0"
                  >
                    {status === 'loading' ? 'Verzenden...' : (
                      <span className="flex items-center justify-center gap-3">
                        Verstuur Bericht <Send className="w-4 h-4" />
                      </span>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
