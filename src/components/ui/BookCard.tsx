import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { Book } from '../../types';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

interface BookCardProps {
  book: Book;
  compact?: boolean;
  dark?: boolean;
}

export function BookCard({ book, compact = false, dark = false }: BookCardProps) {
  return (
    <motion.div 
      whileHover={{ y: -6 }}
      className={cn("group flex flex-col h-full", !dark && "book-card-themed")}
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-t-xl">
        <img 
          src={book.coverUrl} 
          alt={book.title} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4 bg-earth-clay text-white w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-lg">
          {book.order}
        </div>
      </div>

      <div className={cn("p-6 flex flex-col flex-grow", dark ? "bg-transparent px-0" : "bg-white rounded-b-xl")}>
        <h3 className={cn(
          "text-xl font-serif font-bold mb-1 transition-colors",
          dark ? "text-white" : "text-earth-dark group-hover:text-earth-clay"
        )}>
          {book.title}
        </h3>
        <p className={cn("text-sm italic mb-4", dark ? "text-earth-light opacity-60" : "text-earth-warm")}>
          {book.subtitle}
        </p>
        
        {!compact && (
          <p className={cn("text-sm line-clamp-3 mb-6", dark ? "text-white/80" : "text-earth-warm")}>
            {book.teaser}
          </p>
        )}

        <div className="mt-auto flex flex-col gap-3">
          <Link 
            to={`/boeken/${book.slug}`}
            className={cn(
              "flex items-center justify-between group/link text-sm font-bold border-b pb-1 transition-all w-fit",
              dark ? "text-white border-white/20 hover:border-white" : "text-earth-dark border-border-subtle hover:border-earth-clay"
            )}
          >
            Lees meer <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover/link:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
