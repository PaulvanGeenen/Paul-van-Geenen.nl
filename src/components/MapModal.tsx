import React, { useEffect, useRef, useState } from 'react';
import { X, MapPin, Compass, RotateCw, ChevronLeft, ChevronRight, Calendar, ThumbsUp, ThumbsDown, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Declarations to satisfy TypeScript
declare global {
  interface Window {
    L: any;
  }
}

export interface MapItem {
  id?: string;
  city: string;
  country?: string;
  lat?: number;
  lng?: number;
  redirectCode?: string;
  chapter?: string;
  song?: string;
  artist?: string;
  trackId?: string;
  trackTitle?: string;
  format?: string;
  rating?: 'up' | 'down' | string | null;
  timestamp?: string | number;
  deviceType?: string;
  referrer?: string;
  startedAt?: string;
  durationSeconds?: number;
}

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: MapItem[];
  type: 'scans' | 'visitors' | 'music';
}

const COMMON_CITY_COORDS: Record<string, [number, number]> = {
  'amsterdam': [52.3676, 4.9041],
  'rotterdam': [51.9244, 4.4777],
  'den haag': [52.0705, 4.3007],
  'the hague': [52.0705, 4.3007],
  'utrecht': [52.0907, 5.1214],
  'eindhoven': [51.4416, 5.4697],
  'tilburg': [51.5555, 5.0913],
  'groningen': [53.2194, 6.5665],
  'almere': [52.3702, 5.2224],
  'breda': [51.5719, 4.7683],
  'nijmegen': [51.8126, 5.8372],
  'apeldoorn': [52.2112, 5.9699],
  'haarlem': [52.3874, 4.6462],
  'arnhem': [51.9851, 5.8987],
  'enschede': [52.2215, 6.8937],
  'haarlemmermeer': [52.3021, 4.6936],
  'den bosch': [51.6978, 5.3037],
  "'s-hertogenbosch": [51.6978, 5.3037],
  'amersfoort': [52.1562, 5.3878],
  'zwolle': [52.5168, 6.0830],
  'zoetermeer': [52.0607, 4.4940],
  'leiden': [52.1601, 4.4970],
  'dordrecht': [51.8133, 4.6901],
  'maastricht': [50.8514, 5.6910],
  'alphen aan den rijn': [52.1293, 4.6617],
  'leeuwarden': [53.2012, 5.7999],
  'alkmaar': [52.6324, 4.7534],
  'emmen': [52.7858, 6.8975],
  'delft': [52.0116, 4.3571],
  'venlo': [51.3700, 6.1680],
  'deventer': [52.2561, 6.1602],
  'helmond': [51.4792, 5.6570],
  'pelt': [51.2292, 5.4211],
  'antwerpen': [51.2194, 4.4025],
  'gent': [51.0543, 3.7174],
  'brussel': [50.8503, 4.3517],
  'bruges': [51.2093, 3.2247],
  'brugge': [51.2093, 3.2247],
  'leuven': [50.8798, 4.7005],
  'liege': [50.6326, 5.5797],
  'luik': [50.6326, 5.5797],
  'hasselt': [50.9307, 5.3325],
  'kortrijk': [50.8280, 3.2649],
  'mechelen': [51.0259, 4.4771],
  'hilversum': [52.2292, 5.1669],
  'heerlen': [50.8882, 5.9795],
  'onbekend': [52.1326, 5.2913],
  'oss': [51.7656, 5.5186],
  'gouda': [52.0116, 4.7105],
  'zaandam': [52.4420, 4.8292],
  'lelystad': [52.5185, 5.4714],
  'assen': [52.9925, 6.5649],
  'middelburg': [51.4988, 3.6109],
  'vlissingen': [51.4425, 3.5736],
  'roermond': [51.1942, 5.9875],
  'sittard': [50.9983, 5.8694],
  'veenendaal': [52.0292, 5.5549],
  'hillegom': [52.2914, 4.5802],
  'katwijk': [52.1994, 4.4144],
  'noordwijk': [52.2344, 4.4442],
  'hardenberg': [52.5756, 6.6194],
  'kampen': [52.5550, 5.9114],
  'hoogeveen': [52.7289, 6.4764],
  'drachten': [53.1125, 6.0989],
  'heerenveen': [52.9567, 5.9333],
  'sneek': [53.0322, 5.6600],
  'woerden': [52.0864, 4.8833],
  'soest': [52.1736, 5.2917],
  'zeist': [52.0908, 5.2333],
  'houten': [52.0278, 5.1694],
  'nieuwegein': [52.0306, 5.0833],
  'maarssen': [52.1400, 5.0417],
  'culemborg': [51.9547, 5.2289],
  'tiel': [51.8864, 5.4322],
  'gorinchem': [51.8333, 4.9750],
  'spijkenisse': [51.8450, 4.3292],
  'schiedam': [51.9197, 4.3986],
  'vlaardingen': [51.9125, 4.3417],
  'rijswijk': [52.0458, 4.3250],
  'voorburg': [52.0750, 4.3611],
  'wassenaar': [52.1458, 4.4000],
  'leidschendam': [52.0833, 4.3944]
};

// Helper to parse timestamps from MySQL (UTC) to Dutch local time accurately
const formatMapTimestamp = (raw?: string | number) => {
  if (!raw) return 'Onbekend';
  const rawStr = String(raw).trim();
  const d = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(rawStr)
    ? new Date(rawStr.replace(' ', 'T') + 'Z')
    : new Date(raw);
  if (isNaN(d.getTime())) return 'Onbekend';
  return d.toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const MapModal: React.FC<MapModalProps> = ({
  isOpen,
  onClose,
  title,
  items,
  type,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [coords, setCoords] = useState<Record<string, [number, number]>>({});
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState<number | null>(null);
  const [ratingFilter, setRatingFilter] = useState<'ALL' | 'UP' | 'DOWN'>('ALL');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'mp3' | 'audiobook' | 'reflection' | 'video'>('ALL');
  const [activeRegion, setActiveRegion] = useState<'NL' | 'EU' | 'WORLD'>('NL');
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  // Switch region view handler
  const setRegionView = (region: 'NL' | 'EU' | 'WORLD') => {
    setActiveRegion(region);
    if (!mapInstanceRef.current) return;

    if (region === 'NL') {
      mapInstanceRef.current.flyTo([52.1326, 5.2913], 7, { duration: 1.2 });
    } else if (region === 'EU') {
      mapInstanceRef.current.flyTo([51.1657, 10.4515], 4, { duration: 1.2 });
    } else if (region === 'WORLD') {
      mapInstanceRef.current.flyTo([20.0, 10.0], 2, { duration: 1.2 });
    }
  };

  // Reset week offset & filters when modal opens (default to All Time for full overview)
  useEffect(() => {
    if (isOpen) {
      setSelectedWeekOffset(null);
      setRatingFilter('ALL');
      setFormatFilter('ALL');
      setActiveRegion('NL');
    }
  }, [isOpen]);

  // Helper for Monday - Sunday date bounds
  const getWeekBounds = (offset: number) => {
    const now = new Date();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = (day === 0 ? -6 : 1 - day);

    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return { monday, sunday };
  };

  const filteredWeekItems = React.useMemo(() => {
    return items.filter((item) => {
      if (type === 'music' && selectedWeekOffset !== null) {
        if (!item.timestamp) return false;
        const itemDate = new Date(item.timestamp);
        const { monday, sunday } = getWeekBounds(selectedWeekOffset);
        const inWeek = itemDate >= monday && itemDate <= sunday;
        if (!inWeek) return false;
      }

      if (ratingFilter === 'UP' && item.rating !== 'up') return false;
      if (ratingFilter === 'DOWN' && item.rating !== 'down') return false;

      if (formatFilter !== 'ALL' && (item.format || 'mp3').toLowerCase() !== formatFilter.toLowerCase()) return false;

      return true;
    });
  }, [items, selectedWeekOffset, ratingFilter, formatFilter, type]);

  // Group items by city & country combo
  const groupedLocations = React.useMemo(() => {
    const grouped: Record<string, { city: string; country: string; list: MapItem[] }> = {};
    const itemsToGroup = filteredWeekItems;

    itemsToGroup.forEach((item) => {
      if (!item.city || item.city.toLowerCase() === 'onbekend') return;
      const key = `${item.city.toLowerCase().trim()}|${(item.country || '').toLowerCase().trim()}`;
      if (!grouped[key]) {
        grouped[key] = {
          city: item.city,
          country: item.country || 'Nederland',
          list: [],
        };
      }
      grouped[key].list.push(item);
    });

    // Sort entries within each location descending by date/time so newest entries are at top
    Object.values(grouped).forEach((group) => {
      group.list.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : (a.startedAt ? new Date(a.startedAt).getTime() : 0);
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : (b.startedAt ? new Date(b.startedAt).getTime() : 0);
        return timeB - timeA;
      });
    });

    return grouped;
  }, [filteredWeekItems]);

  // Load Leaflet resources dynamically
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const loadLeafletResources = () => {
      if (window.L) {
        if (isMounted) setLeafletLoaded(true);
        return;
      }

      // Append Leaflet Styles
      let link = document.querySelector('link[href*="leaflet.css"]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      // Append Leaflet JavaScript
      let script = document.querySelector('script[src*="leaflet.js"]') as HTMLScriptElement;
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) setLeafletLoaded(true);
        };
        document.body.appendChild(script);
      } else {
        const interval = setInterval(() => {
          if (window.L) {
            clearInterval(interval);
            if (isMounted) setLeafletLoaded(true);
          }
        }, 100);
      }
    };

    loadLeafletResources();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Build/Geocode coordinates
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    const geocodeAll = async () => {
      setLoadingCoords(true);
      const uniqueKeys = Object.keys(groupedLocations);
      const newCoords: Record<string, [number, number]> = {};
      const keysToFetch: string[] = [];

      // Step 1: Use direct item coordinates or popular built-in dictionary coords
      for (const key of uniqueKeys) {
        const { city, list } = groupedLocations[key];
        const itemWithCoords = list.find(it => typeof it.lat === 'number' && typeof it.lng === 'number' && it.lat !== 0 && it.lng !== 0 && !isNaN(it.lat) && !isNaN(it.lng));
        if (itemWithCoords) {
          newCoords[key] = [itemWithCoords.lat!, itemWithCoords.lng!];
          continue;
        }

        const normalizedCity = city.toLowerCase().trim();

        if (COMMON_CITY_COORDS[normalizedCity]) {
          newCoords[key] = COMMON_CITY_COORDS[normalizedCity];
        } else {
          keysToFetch.push(key);
        }
      }

      if (isMounted) {
        setCoords((prev) => ({ ...prev, ...newCoords }));
      }

      // Step 2: Query Nominatim OpenStreetMap API sequentially for others with respect to rate limiting
      if (keysToFetch.length > 0) {
        for (const key of keysToFetch) {
          if (!isMounted) break;
          const { city, country } = groupedLocations[key];
          try {
            const query = `${city}, ${country && country !== 'Onbekend' ? country : ''}`;
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
            const headerObj = {
              'Accept-Language': 'nl,en',
            };
            const response = await fetch(url, { headers: headerObj });
            if (response.ok) {
              const data = await response.json();
              if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                if (isMounted) {
                  setCoords((prev) => ({
                    ...prev,
                    [key]: [lat, lon],
                  }));
                }
              }
            }
            // Wait 1 second to respect OpenStreetMap Nominatim guidelines
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (err) {
            console.error(`Error geocoding ${city}:`, err);
          }
        }
      }

      if (isMounted) setLoadingCoords(false);
    };

    geocodeAll();

    return () => {
      isMounted = false;
    };
  }, [isOpen, groupedLocations]);

  // Initialize and update Leaflet map canvas
  useEffect(() => {
    if (!isOpen || !leafletLoaded || !mapContainerRef.current) return;

    const L = window.L;

    // Destroy existing map state if any to avoid DOM attachment conflicts
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Set map tiles style and zoom levels
    const map = L.map(mapContainerRef.current, {
      center: [52.1326, 5.2913],
      zoom: 7,
      zoomControl: true,
      minZoom: 3,
      closePopupOnClick: false, // Prevents popup from closing automatically when clicking/panning
    });

    mapInstanceRef.current = map;

    // Trigger map size recalculation so it smoothly occupies full screen canvas
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    window.addEventListener('resize', handleResize);

    // Support custom Carto API key if configured, or use 100% free watermark-free dark styled map tiles
    const cartoKey = localStorage.getItem('carto_api_key') || '';
    if (cartoKey) {
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?api_key=${encodeURIComponent(cartoKey)}`, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
    } else {
      // 100% free, no watermark, pristine dark luxury theme
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        className: 'map-tiles-dark-luxury',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(map);
    }

    // Create a LayerGroup for markers
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Inject specialized CSS for custom dark popup container over Leaflet's defaults
    const cssStyleId = 'leaflet-custom-dark-popups-styles';
    let styleTag = document.getElementById(cssStyleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = cssStyleId;
      styleTag.innerHTML = `
        .leaflet-container {
          background: #0f0f0f !important;
        }
        .leaflet-tile-pane .map-tiles-dark-luxury {
          filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(92%) !important;
          background: #0d0d0d !important;
        }
        .leaflet-popup-content-wrapper {
          background: #111111 !important;
          color: #ffffff !important;
          border: 1px solid rgba(212, 175, 55, 0.35) !important;
          border-radius: 16px !important;
          padding: 0 !important;
          box-shadow: 0 20px 50px rgba(0,0,0,0.95), 0 0 25px rgba(0,0,0,0.85) !important;
          overflow: hidden !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          max-width: 100% !important;
          line-height: 1.4 !important;
        }
        .leaflet-popup-tip {
          background: #111111 !important;
          border-left: 1px solid rgba(212, 175, 55, 0.35) !important;
          border-bottom: 1px solid rgba(212, 175, 55, 0.35) !important;
        }
        .leaflet-container a.leaflet-popup-close-button {
          color: rgba(255,255,255,0.7) !important;
          padding: 10px 12px 0 0 !important;
          font-size: 18px !important;
          z-index: 30 !important;
        }
        .leaflet-container a.leaflet-popup-close-button:hover {
          color: #d4af37 !important;
        }
        .custom-popup-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .custom-popup-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-popup-scroll::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.4);
          border-radius: 4px;
        }
        .custom-popup-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.75);
        }
      `;
      document.head.appendChild(styleTag);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen, leafletLoaded]);

  // Update markers when coordinates/locations state shifts
  useEffect(() => {
    if (!isOpen || !leafletLoaded || !mapInstanceRef.current || !markersGroupRef.current) return;

    const L = window.L;
    const markersGroup = markersGroupRef.current;
    markersGroup.clearLayers();

    const activeBounds: any[] = [];

    // Custom pulse gold divIcon for pins
    const createCustomMarkupIcon = () => {
      return L.divIcon({
        html: `
          <div class="relative flex items-center justify-center w-6 h-6">
            <span class="absolute inline-flex h-full w-full rounded-full bg-earth-gold/30 animate-ping"></span>
            <div class="relative rounded-full h-3.5 w-3.5 bg-earth-gold border border-black shadow-[0_0_8px_rgba(212,175,55,0.9)]"></div>
          </div>
        `,
        className: 'custom-leaflet-pulse-markup',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
    };

    // Pin markers with rich popup interactions
    Object.entries(groupedLocations).forEach(([key, value]) => {
      const cityCoords = coords[key];
      if (!cityCoords) return;

      const [lat, lon] = cityCoords;
      activeBounds.push([lat, lon]);

      let popupHtml = '';

      if (type === 'music') {
        popupHtml = `
          <div class="w-[320px] sm:w-[380px] max-w-[88vw] flex flex-col font-sans select-none">
            <!-- Sticky Header -->
            <div class="p-3.5 bg-[#181818] border-b border-white/10 flex items-center justify-between pr-9 sticky top-0 z-10 shadow-sm">
              <span class="text-sm sm:text-base font-serif text-earth-gold font-bold truncate">📍 ${value.city}</span>
              <span class="text-xs font-mono font-bold bg-earth-gold/15 text-earth-gold border border-earth-gold/30 px-2 py-0.5 rounded-full shrink-0">
                ${value.list.length} ${value.list.length === 1 ? 'luisterbeurt' : 'luisterbeurten'}
              </span>
            </div>

            <!-- Scrollable List of all listening sessions -->
            <div class="p-3.5 space-y-3 overflow-y-auto max-h-[320px] sm:max-h-[380px] custom-popup-scroll bg-[#111111]">
              ${value.list
                .map((item) => {
                  const dateStr = formatMapTimestamp(item.timestamp);
                  const songTitle = item.trackTitle || item.song || 'Muzieknummer';
                  const fmt = (item.format || 'mp3').toUpperCase();
                  const ratingBadge = item.rating === 'up'
                    ? '<span class="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded text-[11px] font-semibold">👍 Leuk</span>'
                    : item.rating === 'down'
                    ? '<span class="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 border border-rose-500/25 px-1.5 py-0.5 rounded text-[11px] font-semibold">👎 Niet leuk</span>'
                    : '';
                  return `
                    <div class="border-b border-white/10 pb-2.5 mb-2.5 last:border-0 last:pb-0 last:mb-0">
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="text-sm font-bold text-earth-gold tracking-tight leading-snug">${songTitle}</span>
                        <span class="text-xs text-white/50 font-mono shrink-0">${dateStr}</span>
                      </div>
                      <div class="text-xs text-white/80 mt-1.5 flex items-center flex-wrap gap-2 font-mono">
                        <span class="bg-white/10 px-2 py-0.5 rounded text-[11px] text-white">Vorm: <strong class="text-earth-gold">${fmt}</strong></span>
                        <span class="bg-white/10 px-2 py-0.5 rounded text-[11px] text-white">Apparaat: <strong>${item.deviceType || 'Mobiel'}</strong></span>
                        ${ratingBadge}
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      } else if (type === 'visitors') {
        popupHtml = `
          <div class="w-[320px] sm:w-[380px] max-w-[88vw] flex flex-col font-sans select-none">
            <!-- Sticky Header -->
            <div class="p-3.5 bg-[#181818] border-b border-white/10 flex items-center justify-between pr-9 sticky top-0 z-10 shadow-sm">
              <span class="text-sm sm:text-base font-serif text-earth-gold font-bold truncate">📍 ${value.city}</span>
              <span class="text-xs font-mono font-bold bg-earth-gold/15 text-earth-gold border border-earth-gold/30 px-2 py-0.5 rounded-full shrink-0">
                ${value.list.length} ${value.list.length === 1 ? 'bezoek' : 'bezoeken'}
              </span>
            </div>

            <!-- Scrollable List of all visits -->
            <div class="p-3.5 space-y-3 overflow-y-auto max-h-[320px] sm:max-h-[380px] custom-popup-scroll bg-[#111111]">
              ${value.list
                .map((item, index) => {
                  const dateStr = formatMapTimestamp(item.startedAt || item.timestamp);
                  const durStr = item.durationSeconds
                    ? `${Math.floor(item.durationSeconds / 60)}m ${item.durationSeconds % 60}s`
                    : 'Kort bezoek';
                  return `
                    <div class="border-b border-white/10 pb-2.5 mb-2.5 last:border-0 last:pb-0 last:mb-0">
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="text-sm font-bold text-earth-gold font-mono">Bezoek #${value.list.length - index}</span>
                        <span class="text-xs text-white/50 font-mono shrink-0">${dateStr}</span>
                      </div>
                      <div class="text-xs text-white/80 mt-1.5 flex items-center flex-wrap gap-2 font-mono">
                        <span class="bg-white/10 px-2 py-0.5 rounded text-[11px] text-white">Apparaat: <strong>${item.deviceType || 'Bureaublad'}</strong></span>
                        <span class="bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded text-[11px]">Duur: <strong>${durStr}</strong></span>
                      </div>
                      ${item.referrer && item.referrer !== 'Rechtstreeks' ? `<div class="text-[11px] text-white/60 mt-1 truncate">Herkomst: ${item.referrer}</div>` : ''}
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      } else {
        // Book QR Scans format
        popupHtml = `
          <div class="w-[320px] sm:w-[380px] max-w-[88vw] flex flex-col font-sans select-none">
            <!-- Sticky Header -->
            <div class="p-3.5 bg-[#181818] border-b border-white/10 flex items-center justify-between pr-9 sticky top-0 z-10 shadow-sm">
              <span class="text-sm sm:text-base font-serif text-earth-gold font-bold truncate">📍 ${value.city}</span>
              <span class="text-xs font-mono font-bold bg-earth-gold/15 text-earth-gold border border-earth-gold/30 px-2 py-0.5 rounded-full shrink-0">
                ${value.list.length} ${value.list.length === 1 ? 'scan' : 'scans'}
              </span>
            </div>

            <!-- Scrollable List of all QR scans -->
            <div class="p-3.5 space-y-3 overflow-y-auto max-h-[320px] sm:max-h-[380px] custom-popup-scroll bg-[#111111]">
              ${value.list
                .map((item) => {
                  const dateStr = formatMapTimestamp(item.timestamp);
                  return `
                    <div class="border-b border-white/10 pb-2.5 mb-2.5 last:border-0 last:pb-0 last:mb-0">
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="text-sm sm:text-base font-serif font-bold text-white leading-snug">${item.chapter || 'Boek QR-scan'}</span>
                        <span class="text-xs text-white/50 font-mono shrink-0">${dateStr}</span>
                      </div>
                      <div class="text-xs text-earth-gold font-medium mt-1">${item.song || 'Muziektrack'}${item.artist ? ` • ${item.artist}` : ''}</div>
                      <div class="text-xs text-white/70 mt-1.5 flex items-center gap-2 font-mono">
                        <span class="bg-white/10 px-2 py-0.5 rounded text-[11px]">Code: <strong class="text-earth-gold">${item.redirectCode || 'QR'}</strong></span>
                      </div>
                    </div>
                  `;
                })
                .join('')}
            </div>
          </div>
        `;
      }

      const markerIcon = createCustomMarkupIcon();
      L.marker([lat, lon], { icon: markerIcon })
        .bindPopup(popupHtml, {
          closeButton: true,
          autoClose: false,
          closeOnClick: false,
          maxWidth: 440,
          minWidth: 300,
          autoPan: true,
          autoPanPadding: [30, 30],
        })
        .addTo(markersGroup);
    });

    // Auto-fit bounds of the map or apply active region view
    if (activeRegion === 'NL') {
      if (activeBounds.length > 0) {
        if (activeBounds.length === 1) {
          mapInstanceRef.current.setView(activeBounds[0], 9);
        } else {
          mapInstanceRef.current.fitBounds(activeBounds, { padding: [40, 40] });
        }
      } else {
        mapInstanceRef.current.setView([52.1326, 5.2913], 7);
      }
    } else if (activeRegion === 'EU') {
      mapInstanceRef.current.setView([51.1657, 10.4515], 4);
    } else if (activeRegion === 'WORLD') {
      mapInstanceRef.current.setView([20.0, 10.0], 2);
    }
  }, [isOpen, leafletLoaded, coords, groupedLocations, type, activeRegion]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col w-screen h-screen overflow-hidden">
          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative bg-black w-full h-full flex flex-col overflow-hidden"
            id="map-modal-box"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-white/10 bg-[#111111] shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-earth-gold/10 p-2 rounded-xl border border-earth-gold/25 text-earth-gold shrink-0">
                  {type === 'visitors' ? <Compass className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-serif font-bold text-white leading-normal">{title}</h3>
                  <p className="text-earth-light/45 text-[10px] sm:text-[11px] font-mono">
                    Overzicht van {Object.keys(groupedLocations).length} steden ({type === 'music' ? filteredWeekItems.length : items.length} registraties)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                {loadingCoords && (
                  <span className="text-earth-gold/80 text-[10px] sm:text-[11px] font-mono flex items-center gap-1 bg-earth-gold/5 border border-earth-gold/15 px-2.5 py-1 rounded-full">
                    <RotateCw className="w-3 h-3 animate-spin" />
                    <span className="hidden xs:inline">Geocoding...</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-earth-gold/10 hover:bg-earth-gold/20 text-earth-gold hover:text-white p-2 rounded-full border border-earth-gold/30 transition-all cursor-pointer inline-flex items-center justify-center active:scale-95"
                  title="Sluiten"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Week Navigation & Period Toolbar for Music */}
            {type === 'music' && (() => {
              const isAllTime = selectedWeekOffset === null;
              const { monday, sunday } = !isAllTime ? getWeekBounds(selectedWeekOffset) : { monday: new Date(), sunday: new Date() };
              const formatDateShort = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
              const weekLabel = isAllTime
                ? 'Alle periodes (Totaal overzicht)'
                : selectedWeekOffset === 0
                ? `Huidige week (${formatDateShort(monday)} – ${formatDateShort(sunday)})`
                : `${formatDateShort(monday)} – ${formatDateShort(sunday)} ${monday.getFullYear()}`;

              return (
                <>
                  <div className="bg-[#141414] border-b border-white/10 px-6 py-2.5 flex flex-wrap items-center justify-between text-xs font-mono gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedWeekOffset(null)}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
                          isAllTime
                            ? 'bg-earth-gold text-black font-bold border-earth-gold shadow'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Totaal overzicht</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedWeekOffset(0)}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 ${
                          !isAllTime
                            ? 'bg-white/15 text-white font-bold border-white/30'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-earth-gold" />
                        <span>Per week</span>
                      </button>
                    </div>

                    {!isAllTime && (
                      <button
                        type="button"
                        onClick={() => setSelectedWeekOffset((prev) => (prev === null ? -1 : prev - 1))}
                        className="bg-white/5 hover:bg-white/10 text-white/80 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95"
                      >
                        <ChevronLeft className="w-4 h-4 text-earth-gold" />
                        <span>Vorige week</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2 text-earth-gold font-bold">
                      <Calendar className="w-4 h-4" />
                      <span>{weekLabel}</span>
                      <span className="text-white/50 text-[11px] font-normal font-sans bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                        {filteredWeekItems.length} {filteredWeekItems.length === 1 ? 'afspeling' : 'afspelingen'}
                      </span>
                    </div>

                    {!isAllTime && (
                      <button
                        type="button"
                        disabled={selectedWeekOffset !== null && selectedWeekOffset >= 0}
                        onClick={() => setSelectedWeekOffset((prev) => (prev === null ? 0 : Math.min(0, prev + 1)))}
                        className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors ${
                          selectedWeekOffset !== null && selectedWeekOffset >= 0
                            ? 'bg-white/5 text-white/20 border-white/5 cursor-not-allowed opacity-50'
                            : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10 cursor-pointer active:scale-95'
                        }`}
                      >
                        <span>Volgende week</span>
                        <ChevronRight className="w-4 h-4 text-earth-gold" />
                      </button>
                    )}
                  </div>

                  {/* Rating & Format Filters Toolbar */}
                  <div className="bg-[#181818] border-b border-white/10 px-6 py-2 flex flex-wrap items-center justify-between text-xs gap-3">
                    {/* Rating Filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white/40 font-mono text-[11px] uppercase mr-1">Beoordeling:</span>
                      <button
                        type="button"
                        onClick={() => setRatingFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          ratingFilter === 'ALL'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatingFilter('UP')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          ratingFilter === 'UP'
                            ? 'bg-emerald-500 text-black shadow'
                            : 'bg-white/5 text-emerald-400 hover:text-emerald-300 border border-white/10'
                        }`}
                      >
                        <ThumbsUp className="w-3 h-3" /> Vind ik leuk
                      </button>
                      <button
                        type="button"
                        onClick={() => setRatingFilter('DOWN')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          ratingFilter === 'DOWN'
                            ? 'bg-rose-500 text-white shadow'
                            : 'bg-white/5 text-rose-400 hover:text-rose-300 border border-white/10'
                        }`}
                      >
                        <ThumbsDown className="w-3 h-3" /> Vind ik niet leuk
                      </button>
                    </div>

                    {/* Format Filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-white/40 font-mono text-[11px] uppercase mr-1">Formaat:</span>
                      <button
                        type="button"
                        onClick={() => setFormatFilter('ALL')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          formatFilter === 'ALL'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatFilter('mp3')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          formatFilter === 'mp3'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        MP3
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatFilter('audiobook')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          formatFilter === 'audiobook'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Audioboek
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatFilter('reflection')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          formatFilter === 'reflection'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Reflectie
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormatFilter('video')}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          formatFilter === 'video'
                            ? 'bg-earth-gold text-black shadow'
                            : 'bg-white/5 text-white/60 hover:text-white border border-white/10'
                        }`}
                      >
                        Video
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Map Area */}
            <div className="flex-1 relative bg-[#0d0d0d]">
              {/* Region Switcher Toolbar Overlay */}
              <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-[400] flex items-center gap-1.5 bg-black/85 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl">
                <div className="px-2 py-1 text-earth-gold font-mono text-[10px] sm:text-[11px] uppercase font-bold flex items-center gap-1 border-r border-white/10 mr-0.5">
                  <Globe className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Kaart:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setRegionView('NL')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeRegion === 'NL'
                      ? 'bg-earth-gold text-black shadow-md shadow-earth-gold/20 scale-105'
                      : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>🇳🇱</span>
                  <span>Nederland</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegionView('EU')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeRegion === 'EU'
                      ? 'bg-earth-gold text-black shadow-md shadow-earth-gold/20 scale-105'
                      : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>🇪🇺</span>
                  <span>Europa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRegionView('WORLD')}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeRegion === 'WORLD'
                      ? 'bg-earth-gold text-black shadow-md shadow-earth-gold/20 scale-105'
                      : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10'
                  }`}
                >
                  <span>🌍</span>
                  <span>Wereld</span>
                </button>
              </div>

              {!leafletLoaded ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-earth-light/40 text-xs font-mono">
                  <div className="w-8 h-8 border-2 border-earth-gold border-t-transparent rounded-full animate-spin" />
                  Interactieve landkaart inladen...
                </div>
              ) : (
                <div className="w-full h-full" ref={mapContainerRef} />
              )}
            </div>

            {/* Footer summary metrics bar */}
            <div className="bg-[#121212] border-t border-white/10 px-6 py-3.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-earth-light/40 gap-3">
              <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-earth-gold shadow-[0_0_6px_#d4af37]" /> Logpins weergave
              </span>
              <span>
                Schuif, zoom of klik op de oplichtende spelden om de gedetailleerde bezoekgeschiedenis per stad te openen.
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
