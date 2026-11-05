import { useParams, Link, useNavigate } from 'react-router-dom';
import { BOOKS } from '../data/books';
import appConfig from '../data/appConfig.json';
import { motion } from 'motion/react';
import { ArrowLeft, ShoppingCart, ChevronRight, ChevronLeft, ArrowRight } from 'lucide-react';
import { useEffect } from 'react';
import { MRIScanCTA } from '../components/ui/MRIScanCTA';

export function BookDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const book = BOOKS.find(b => b.slug === slug);

  useEffect(() => {
    if (!book) navigate('/boeken');
  }, [book, navigate]);

  if (!book) return null;

  const prevBook = BOOKS.find(b => b.order === book.order - 1);
  const nextBook = BOOKS.find(b => b.order === book.order + 1);

  return (
    <div className="bg-earth-soft min-h-screen pb-24">
      {/* Detail Header */}
      <div className="bg-white border-b border-border-subtle pt-12 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <Link to="/boeken" className="inline-flex items-center gap-2 text-earth-warm hover:text-earth-clay transition-colors mb-12">
            <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
            {/* Cover image sticky column */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-5 lg:sticky lg:top-28 z-10 bg-white lg:bg-transparent pb-8 lg:pb-0"
              style={{ perspective: '1500px' }}
            >
              <div className="relative group w-full max-w-md mx-auto lg:mx-0">
                {/* Book Pages (revealed when cover opens) */}
                <div 
                  className="absolute inset-0 bg-[#fefaf0] rounded-r-lg shadow-inner flex flex-col justify-between p-6 border-y border-r border-earth-clay/20 scale-[0.98] origin-left transition-all duration-700 group-hover:translate-x-3"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  <div className="space-y-4">
                    <div className="h-px bg-earth-warm/20 w-full" />
                    <div className="h-px bg-earth-warm/20 w-11/12" />
                    <div className="h-px bg-earth-warm/20 w-full" />
                    <div className="h-px bg-earth-warm/20 w-4/5" />
                    <div className="h-px bg-earth-warm/20 w-full" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-px bg-earth-warm/20 w-full" />
                    <div className="h-px bg-earth-warm/20 w-full" />
                    <div className="h-px bg-earth-warm/20 w-3/4" />
                  </div>
                  {/* Spine shadow on pages */}
                  <div className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                </div>

                {/* Hardcover */}
                <div 
                  className="relative z-10 transition-all duration-[800ms] origin-left shadow-2xl"
                  style={{ 
                    transformStyle: 'preserve-3d',
                    transform: 'rotateY(0deg)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'rotateY(-38deg) translateX(4px) scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'rotateY(0deg) translateX(0px) scale(1)';
                  }}
                >
                  <div className="rounded-2xl overflow-hidden ring-1 ring-black/5 relative" style={{ backfaceVisibility: 'hidden' }}>
                    <img 
                      src={book.coverUrl} 
                      alt={book.title} 
                      className="w-full h-auto"
                      referrerPolicy="no-referrer"
                    />
                    {/* Glossy Sheen Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-white/40 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none mix-blend-overlay" />
                    
                    {/* Moving Mirror Polish Light */}
                    <div className="absolute -inset-full bg-gradient-to-t from-transparent via-white/10 to-transparent rotate-45 translate-x-[-100%] translate-y-[-100%] group-hover:translate-x-[100%] group-hover:translate-y-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                    
                    {/* Spine definition */}
                    <div className="absolute inset-y-0 left-0 w-[12px] bg-gradient-to-r from-black/30 to-transparent pointer-events-none" />
                  </div>
                </div>
                
                {/* Book Shadow */}
                <div className="absolute -bottom-12 left-12 right-0 h-10 bg-black/10 blur-3xl rounded-full scale-90 group-hover:scale-105 group-hover:opacity-60 transition-all duration-700 opacity-40 pointer-events-none" />
              </div>
            </motion.div>

            {/* Content column */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-7"
            >
              <div className="mb-8">
                <span className="text-earth-clay font-bold tracking-widest uppercase text-sm">Deel {book.order} in de reeks</span>
                {book.title.includes(':') ? (
                  <div className="mt-2 mb-4">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-earth-dark">
                      {book.title.split(':')[0].trim()}
                    </h1>
                    <h2 className="text-3xl md:text-4xl font-serif font-bold text-earth-dark mt-1">
                      {book.title.split(':')[1].trim()}
                    </h2>
                  </div>
                ) : (
                  <h1 className="text-4xl md:text-5xl font-serif font-bold text-earth-dark mt-2 mb-4">{book.title}</h1>
                )}
                <p className="text-xl text-earth-warm italic">{book.subtitle}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-earth-clay/10 border border-earth-clay/20 text-xs text-earth-dark font-medium">
                    <img src="/images/lion-books-logo.jpg" alt="Lion Books" className="w-5 h-5 rounded object-cover" />
                    <span>Uitgeverij: <strong>Lion Books Publishing</strong></span>
                  </div>
                </div>
              </div>

              <div className="prose prose-lg prose-earth text-earth-warm max-w-none space-y-6">
                {Array.isArray(book.description) ? (
                  book.description.map((paragraph, index) => {
                    const isLast = index === book.description.length - 1;
                    
                    if (isLast) {
                      return (
                        <div key={index} className="pt-12 mt-12 border-t border-earth-clay/10 relative text-center">
                          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-earth-soft px-4 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-earth-clay/20" />
                            <div className="w-2 h-2 rounded-full bg-earth-clay/40" />
                            <div className="w-1.5 h-1.5 rounded-full bg-earth-clay/20" />
                          </div>
                          <motion.p 
                            initial={{ opacity: 0, y: 10 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            viewport={{ once: true }}
                            className="font-serif italic text-2xl text-earth-dark leading-relaxed max-w-2xl mx-auto"
                          >
                            "{paragraph}"
                          </motion.p>
                          
                          {book.hasMRI && paragraph.includes("proloog op mijn schrijverschap") && (
                            <MRIScanCTA className="mt-16 mb-8 text-left" />
                          )}
                        </div>
                      );
                    }

                    return (
                      <div key={index}>
                        <p>{paragraph}</p>
                        {/* Keep general CTA logic if needed, but for book 1 it's now handled in the isLast block */}
                        {paragraph === "Dit boek is de loodzware, maar majestueuze proloog op mijn schrijverschap." && !isLast && (
                          <MRIScanCTA className="my-12 text-left" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p>{book.description}</p>
                )}
              </div>

              {/* Navigation between books - Toggleable via config */}
              {appConfig.features.showReadFurtherSection && (
                <div className="mt-16 pt-12">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {prevBook ? (
                      <Link to={`/boeken/${prevBook.slug}`} className="group p-8 rounded-2xl border border-earth-clay/10 hover:border-earth-clay/30 hover:bg-earth-clay/[0.02] transition-all flex flex-col items-start text-left">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-earth-warm mb-4 flex items-center gap-2">
                          <ChevronLeft className="w-3 h-3" /> Vorige
                        </span>
                        <h4 className="font-serif font-bold text-earth-dark group-hover:text-earth-clay transition-colors">
                          {prevBook.title.includes(':') ? (
                            <>
                              <span className="block text-lg">{prevBook.title.split(':')[0].trim()}</span>
                              <span className="block text-base mt-1">{prevBook.title.split(':')[1].trim()}</span>
                            </>
                          ) : (
                            prevBook.title
                          )}
                        </h4>
                      </Link>
                    ) : (
                      <div />
                    )}
                    
                    {nextBook ? (
                      <Link to={`/boeken/${nextBook.slug}`} className="group p-8 rounded-2xl border border-earth-clay/10 hover:border-earth-clay/30 hover:bg-earth-clay/[0.02] transition-all flex flex-col items-end text-right">
                        <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-earth-warm mb-4 flex items-center gap-2">
                          Volgende <ChevronRight className="w-3 h-3" />
                        </span>
                        <h4 className="font-serif font-bold text-earth-dark group-hover:text-earth-clay transition-colors">
                          {nextBook.title.includes(':') ? (
                            <>
                              <span className="block text-lg">{nextBook.title.split(':')[0].trim()}</span>
                              <span className="block text-base mt-1">{nextBook.title.split(':')[1].trim()}</span>
                            </>
                          ) : (
                            nextBook.title
                          )}
                        </h4>
                      </Link>
                    ) : (
                      <div />
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
