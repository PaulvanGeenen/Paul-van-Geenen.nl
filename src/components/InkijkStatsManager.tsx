import { useEffect, useState, useMemo, useCallback } from 'react';
import { BookOpen, MapPin, Calendar, Clock, RefreshCw, Trash2, Smartphone, Monitor, Filter, ShieldCheck } from 'lucide-react';
import { transipGet, transipPost } from '../lib/transip';

export interface InkijkViewRecord {
  id: number;
  bookSlug: string;
  bookTitle: string;
  city: string;
  country: string;
  deviceType: string;
  viewedAt: string;
}

function formatDateDutch(isoOrSql: string): { date: string; time: string } {
  if (!isoOrSql) return { date: '-', time: '-' };
  // Handle MySQL "YYYY-MM-DD HH:MM:SS" cleanly as local time
  const normalized = isoOrSql.includes('T') ? isoOrSql : isoOrSql.replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) {
    const parts = isoOrSql.split(' ');
    return { date: parts[0] || isoOrSql, time: parts[1]?.slice(0, 5) || '-' };
  }
  const date = d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time };
}

export function InkijkStatsManager() {
  const [views, setViews] = useState<InkijkViewRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedBook, setSelectedBook] = useState<string>('ALL');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadViews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transipGet<{ success: boolean; views?: InkijkViewRecord[] }>('get_inkijk_views');
      if (res?.success && Array.isArray(res.views)) {
        setViews(res.views);
      } else {
        setViews([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const bookOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of views) {
      if (v.bookSlug && !map.has(v.bookSlug)) {
        map.set(v.bookSlug, v.bookTitle || v.bookSlug);
      }
    }
    return Array.from(map.entries());
  }, [views]);

  const filteredViews = useMemo(() => {
    if (selectedBook === 'ALL') return views;
    return views.filter((v) => v.bookSlug === selectedBook);
  }, [views, selectedBook]);

  const uniqueLocationsCount = useMemo(() => {
    const set = new Set<string>();
    for (const v of filteredViews) {
      const loc = `${(v.city || 'Onbekend').trim().toLowerCase()}|${(v.country || '').trim().toLowerCase()}`;
      set.add(loc);
    }
    return set.size;
  }, [filteredViews]);

  const latestView = filteredViews[0] ?? null;

  const handleDelete = async (id: number) => {
    if (!window.confirm('Weet je zeker dat je deze inkijkexemplaar-weergave wilt verwijderen?')) return;
    setDeletingId(id);
    try {
      const res = await transipPost<{ success: boolean }>('delete_inkijk_view', { id });
      if (res?.success) {
        setViews((prev) => prev.filter((v) => v.id !== id));
      }
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-earth-gold" />
            <h2 className="text-2xl font-serif font-bold text-white">Inkijkexemplaar Bezoeken</h2>
          </div>
          <p className="text-sm text-earth-light/60 mt-1">
            Overzicht van locatie, datum en tijd waarop bezoekers het inkijkexemplaar van een boek hebben geopend.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Bezoeken van de beheerder (dit apparaat &amp; bekende beheerder-IP&apos;s) worden niet opgeslagen.</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {bookOptions.length > 0 && (
            <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2">
              <Filter className="w-4 h-4 text-earth-gold/80" />
              <select
                value={selectedBook}
                onChange={(e) => setSelectedBook(e.target.value)}
                className="bg-transparent text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-stone-900">Alle boeken</option>
                {bookOptions.map(([slug, title]) => (
                  <option key={slug} value={slug} className="bg-stone-900">
                    {title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={loadViews}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-earth-gold/15 hover:bg-earth-gold/25 border border-earth-gold/30 text-earth-gold text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Verversen</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <span className="text-xs uppercase tracking-widest text-earth-light/50 font-mono">Totaal bekeken</span>
          <div className="text-3xl font-serif font-bold text-white mt-2">{filteredViews.length}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <span className="text-xs uppercase tracking-widest text-earth-light/50 font-mono">Unieke locaties</span>
          <div className="text-3xl font-serif font-bold text-earth-gold mt-2">{uniqueLocationsCount}</div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <span className="text-xs uppercase tracking-widest text-earth-light/50 font-mono">Laatst bekeken</span>
          <div className="text-lg font-serif font-semibold text-white mt-2">
            {latestView ? (
              <>
                {formatDateDutch(latestView.viewedAt).date}{' '}
                <span className="text-earth-gold">om {formatDateDutch(latestView.viewedAt).time}</span>
              </>
            ) : (
              <span className="text-earth-light/40">Nog geen bezoeken</span>
            )}
          </div>
          {latestView && (
            <div className="text-xs text-earth-light/60 mt-0.5 truncate">
              {latestView.city}, {latestView.country}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-earth-light/50 text-sm">
            Inkijkexemplaar-gegevens laden...
          </div>
        ) : filteredViews.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-8 h-8 text-earth-gold/40 mx-auto mb-3" />
            <p className="text-earth-light/70 font-medium">Nog geen bezoeken geregistreerd.</p>
            <p className="text-xs text-earth-light/45 mt-1">
              Zodra een bezoeker (niet de beheerder) het inkijkexemplaar opent, verschijnen locatie, datum en tijd hier automatisch.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/25 text-[11px] uppercase tracking-widest text-earth-light/50 font-mono">
                  <th className="py-3.5 px-5">Boek</th>
                  <th className="py-3.5 px-5">Locatie</th>
                  <th className="py-3.5 px-5">Datum</th>
                  <th className="py-3.5 px-5">Tijd</th>
                  <th className="py-3.5 px-5">Apparaat</th>
                  <th className="py-3.5 px-4 text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredViews.map((row) => {
                  const { date, time } = formatDateDutch(row.viewedAt);
                  const isMobile = /iphone|ipad|android|telefoon|tablet/i.test(row.deviceType || '');
                  return (
                    <tr key={row.id} className="hover:bg-white/[0.03] transition-colors">
                      <td className="py-3.5 px-5 font-medium text-white">
                        {row.bookTitle || row.bookSlug}
                      </td>
                      <td className="py-3.5 px-5 text-earth-light/90">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-earth-gold shrink-0" />
                          <span>
                            {row.city || 'Onbekend'}
                            {row.country ? `, ${row.country}` : ''}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-earth-light/80 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-earth-light/40" />
                          {date}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-earth-gold font-mono whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-earth-gold/70" />
                          {time}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-earth-light/70 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {isMobile ? (
                            <Smartphone className="w-3.5 h-3.5 text-earth-light/40" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5 text-earth-light/40" />
                          )}
                          {row.deviceType || 'Onbekend'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="p-1.5 rounded-lg text-earth-light/40 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                          title="Verwijder dit record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
