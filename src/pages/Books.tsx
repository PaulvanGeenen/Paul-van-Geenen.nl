import { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { BOOKS } from '../data/books';
import appConfig from '../data/appConfig.json';
import { BookCard } from '../components/ui/BookCard';
import { motion } from 'motion/react';
import { MRIScanCTA } from '../components/ui/MRIScanCTA';

export function Books() {
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.playbackRate = 0.5;
      bgVideoRef.current.play().catch(() => {
        // Handle potential autoplay block gracefully
      });
    }
  }, []);

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

      <div className="section-padding relative z-10">
        <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mb-16"
        >
          <span className="inline-block text-earth-gold uppercase tracking-[0.3em] text-xs font-bold mb-4">
            De Collectie
          </span>
          <h1 className="text-5xl md:text-7xl font-serif italic text-earth-dark leading-[1.1] mb-8">
            De Reeks: Koester het Leven
          </h1>
          <div className="space-y-4 text-lg text-earth-warm leading-relaxed">
            <p>
              Mijn boeken vormen samen één groot verhaal. 
              Het zijn geen losse herinneringen maar één rauw, kloppend levenswerk. 
              Wil je de pijn, de passie en de uiteindelijke oerkracht tot in je diepste vezels voelen? 
              Dompel je dan onder in de onderstaande leesvolgorde.
            </p>
            <p className="text-xs font-bold text-accent-orange uppercase tracking-[0.2em]">Aanbevolen leesvolgorde</p>
          </div>
        </motion.div>

        {/* 4-Column Grid View - Added per user request */}
        <section className="mb-32">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
            {BOOKS.map((book, idx) => {
              const [mainTitle, subTitlePart] = book.title.includes(':') 
                ? book.title.split(':').map(s => s.trim()) 
                : [book.title, ''];

              return (
                <motion.div 
                  key={`grid-${book.id}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.1 }}
                  className="flex flex-col group h-full"
                >
                  <Link to={`/boeken/${book.slug}`} className="block mb-8 overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-500">
                    <div className="aspect-[2/3] relative bg-earth-dark/5">
                      <img 
                        src={book.coverUrl} 
                        alt={book.title}
                        width={400}
                        height={600}
                        loading={idx < 4 ? "eager" : "lazy"}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500" />
                    </div>
                  </Link>
                  <div className="flex-grow flex flex-col">
                    <div className="mb-4 min-h-[48px] flex flex-col justify-start">
                      <h3 className="text-xl font-serif font-bold text-earth-dark leading-tight">
                        {mainTitle}
                      </h3>
                      {subTitlePart && (
                        <h4 className="text-xl font-serif font-bold text-earth-dark leading-tight">
                          {subTitlePart}
                        </h4>
                      )}
                    </div>
                    
                    <p className="text-earth-dark font-medium mb-2 min-h-[32px] flex items-center">
                      {book.subtitle}
                    </p>
                    
                    <div className="min-h-[80px] mb-4">
                      <p className="text-earth-warm/80 text-sm font-light leading-relaxed">
                        {book.teaser}
                      </p>
                    </div>
                  </div>
                  <Link 
                    to={`/boeken/${book.slug}`} 
                    className="inline-flex items-center gap-2 text-earth-clay font-bold text-[10px] uppercase tracking-[0.2em] hover:text-earth-dark transition-colors mt-auto"
                  >
                    Lees meer <span className="text-lg leading-none">→</span>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </section>

        {appConfig.features.showDetailedBookInfo && (
          <div className="space-y-24 pt-16 border-t border-earth-clay/10">
            <h2 className="text-3xl font-serif text-earth-dark mb-16 text-center italic">Uitgediept in detail</h2>
            {BOOKS.map((book, index) => (
              <motion.div 
                key={book.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-12 items-start`}
              >
                {/* Image Column */}
                <div className="w-full lg:w-1/3">
                  <BookCard book={book} />
                </div>

                {/* Text Column */}
                <div className="w-full lg:w-2/3 flex flex-col justify-center">
                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-full border border-earth-clay/30 text-earth-clay flex items-center justify-center font-serif text-xl">
                        {book.order}
                      </span>
                      <h2 className="text-3xl md:text-4xl font-serif text-earth-clay">{book.title}</h2>
                    </div>
                    <p className="text-earth-warm font-serif italic ml-14">{book.subtitle}</p>
                  </div>
                  
                  <div className="ml-0 lg:ml-14">
                    {/* === AANGEPASTE DESCRIPTION MET ALINEA'S === */}
                    <div className="prose prose-earth text-earth-warm/80 max-w-none mb-8 space-y-6">
                      {Array.isArray(book.description) ? (
                        book.description.map((paragraph, idx) => (
                          <div key={idx}>
                            <p className="text-lg leading-relaxed">
                              {paragraph}
                            </p>
                            {paragraph === "Dit boek is de loodzware, maar majestueuze proloog op mijn schrijverschap." && (
                              <MRIScanCTA className="my-16 -ml-0 lg:-ml-14" />
                            )}
                          </div>
                        ))
                      ) : (
                        <>
                          <p className="text-lg leading-relaxed">{book.description}</p>
                          {book.description === "Dit boek is de loodzware, maar majestueuze proloog op mijn schrijverschap." && (
                            <MRIScanCTA className="my-16 -ml-0 lg:-ml-14" />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);
}
