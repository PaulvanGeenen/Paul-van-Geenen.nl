import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Plus, Trash2, ExternalLink, X, Music, BookOpen, User, Book, ClipboardList, Download, Mail, Database, Sparkles, Clock, CheckCircle, Compass, MapPin, Smartphone, Eye, ArrowUpRight, BarChart3, ChevronRight, MousePointerClick, RefreshCw, Globe, Headphones, Radio, Activity, ThumbsUp, ThumbsDown, Disc3, Calendar, Filter, Lock, LockOpen, RotateCcw, QrCode, Upload } from 'lucide-react';
import {
  BOOK_DEFAULT_QR_STYLE,
  buildRedirectQrUrl,
  downloadDataUrlAsPng,
  downloadStyledQr,
  generateRedirectQrDataUrl,
  optimizeCenterLogoForBook,
} from '../utils/qrGenerator';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '../lib/utils';
import { isOwnAnalyticsIgnored, setAdminCookie, markDeviceAsAdmin } from '../lib/analytics';
import {
  isLockSystemEnabled,
  setLockSystemEnabled,
  resetUnlockedTracks,
  playLockRattleSound,
  playLockUnlockSound,
  setIsAdminUser
} from '../lib/trackLocks';
import { 
  transipGet, 
  transipPost, 
  getTransipBoeken, 
  getTransipHoofdstukken, 
  getTransipQrCodes, 
  saveTransipBoek, 
  deleteTransipBoek, 
  saveTransipHoofdstuk, 
  deleteTransipHoofdstuk, 
  saveTransipQrCode, 
  deleteTransipQrCode 
} from '../lib/transip';
import jsQR from 'jsqr';
import { MapModal } from '../components/MapModal';
import { MusicDbManager } from '../components/MusicDbManager';
import { TrackLocksManager } from '../components/TrackLocksManager';

interface QRCodeData {
  id: string;
  boekId?: string;
  boekTitel?: string;
  hoofdstukId?: string;
  hoofdstuk: string;
  song: string;
  artist: string;
  spotifyLink: string;
  qrImage?: string;
  album?: string;
}

interface BookAdminData {
  id: string;
  volgnummer: number;
  boektitel: string;
  qrLogo?: string;
}

interface ChapterAdminData {
  id: string;
  boekId: string;
  volgnummer: number;
  omschrijving: string;
}

const DEFAULT_ALBUMS_FALLBACK = [
  {
    id: 2,
    title: 'De Echo',
    artist: 'Paul van Geenen',
    description: 'Soundtrack bij het boek De Echo met meeslepende thema’s en achtergrondverhalen.',
    order_num: 1,
    cover: '/@music/_albums/De%20Echo%20Album.jpg'
  },
  {
    id: 1,
    title: 'Muzikale Krabbels',
    artist: 'Paul van Geenen',
    description: 'Verzameling van unieke composities en muzikale reflecties.',
    order_num: 2,
    cover: '/@music/_albums/Muzikale%20Krabbels%20Album.jpg'
  },
  {
    id: 3,
    title: 'De Geboorte van de Leeuw',
    artist: 'Paul van Geenen',
    description: 'Muziek geïnspireerd op het werk De Geboorte van de Leeuw.',
    order_num: 3,
    cover: '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg'
  }
];

const DEFAULT_TRACK_SEEDS_FALLBACK = [
  // Album 2: De Echo (album_id: 2)
  { id: 6, album_id: 2, track_order: 1, title: 'de Echo', foldername: '005 de Echo', album: 'De Echo' },
  { id: 7, album_id: 2, track_order: 2, title: 'de Sleutel', foldername: 'de Sleutel', album: 'De Echo' },
  { id: 8, album_id: 2, track_order: 3, title: 'Rumbameisje', foldername: 'Rumbameisje', album: 'De Echo' },
  { id: 9, album_id: 2, track_order: 4, title: 'the Echo screams', foldername: '010 the Echo screams', album: 'De Echo' },
  { id: 10, album_id: 2, track_order: 5, title: 'the Silent Code', foldername: '011 the Silent Code', album: 'De Echo' },
  { id: 11, album_id: 2, track_order: 6, title: 'the Slain Lion', foldername: 'the Slain Lion', album: 'De Echo' },
  { id: 12, album_id: 2, track_order: 7, title: 'the Silent Gallery', foldername: 'the Silent Gallery', album: 'De Echo' },
  { id: 13, album_id: 2, track_order: 8, title: 'the Shattered Cocoon', foldername: 'the Shattered Cocoon', album: 'De Echo' },
  { id: 14, album_id: 2, track_order: 9, title: 'Rage in the Pipes', foldername: 'Rage in the Pipes', album: 'De Echo' },
  { id: 15, album_id: 2, track_order: 10, title: 'the Heat in the Dark', foldername: 'the Heat in the Dark', album: 'De Echo' },
  { id: 16, album_id: 2, track_order: 11, title: 'Silent Lips', foldername: 'Silent Lips', album: 'De Echo' },
  { id: 17, album_id: 2, track_order: 12, title: 'the Funeral and the Terror', foldername: 'the Funeral and the Terror', album: 'De Echo' },
  { id: 18, album_id: 2, track_order: 13, title: 'Cosmos in the Cathedral', foldername: 'Cosmos in the Cathedral', album: 'De Echo' },
  { id: 20, album_id: 2, track_order: 14, title: 'War at the Bordeaux Door', foldername: 'War at the Bordeaux Door', album: 'De Echo' },
  { id: 24, album_id: 2, track_order: 15, title: "the Sister's Voice", foldername: "the Sister's Voice", album: 'De Echo' },
  { id: 25, album_id: 2, track_order: 16, title: 'the Awakening', foldername: 'the Awakening', album: 'De Echo' },
  { id: 26, album_id: 2, track_order: 17, title: 'a Silver Chime', foldername: 'a Silver Chime', album: 'De Echo' },
  { id: 27, album_id: 2, track_order: 18, title: 'the Awakening in the Aisle', foldername: 'the Awakening in the Aisle', album: 'De Echo' },
  { id: 21, album_id: 2, track_order: 19, title: 'the Broken Shield', foldername: 'the Broken Shield', album: 'De Echo' },
  { id: 22, album_id: 2, track_order: 20, title: 'the Sentence of the Telephone', foldername: 'the Sentence of the Telephone', album: 'De Echo' },
  { id: 23, album_id: 2, track_order: 21, title: 'Under a Million Stars', foldername: 'Under a Million Stars', album: 'De Echo' },

  // Album 1: Muzikale Krabbels (album_id: 1)
  { id: 1, album_id: 1, track_order: 1, title: 'Leeuw', foldername: '001 Leeuw', album: 'Muzikale Krabbels' },
  { id: 2, album_id: 1, track_order: 2, title: 'de Passant', foldername: '002 de Passant', album: 'Muzikale Krabbels' },
  { id: 3, album_id: 1, track_order: 3, title: 'in de Leegte', foldername: '003 in de Leegte', album: 'Muzikale Krabbels' },
  { id: 4, album_id: 1, track_order: 4, title: 'niet meer mijn wereld', foldername: '004 niet meer mijn wereld', album: 'Muzikale Krabbels' },
  { id: 5, album_id: 1, track_order: 5, title: 'de Tumor', foldername: '006 de Tumor', album: 'Muzikale Krabbels' },

  // Album 3: De Geboorte van de Leeuw (album_id: 3)
  { id: 19, album_id: 3, track_order: 1, title: "Milonga's Nacht", foldername: 'Milongas Nacht', album: 'De Geboorte van de Leeuw' }
];

// Helper to safely parse UTC timestamps from MySQL/API into Date objects in Dutch local time
const parseUtcDate = (ts?: string | number | null): Date | null => {
  if (!ts) return null;
  const rawStr = String(ts).trim();
  const d = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(rawStr)
    ? new Date(rawStr.replace(' ', 'T') + 'Z')
    : new Date(ts);
  return isNaN(d.getTime()) ? null : d;
};

const formatDutchDateTime = (
  ts?: string | number | null,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }
): string => {
  const d = parseUtcDate(ts);
  if (!d) return 'Onbekend';
  return d.toLocaleString('nl-NL', options);
};

// Strict helpers for book & album matching to prevent cross-album contamination
const normAlbumOrSongName = (str?: string | null): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[’']/g, "'")
    .trim();
};

const areAlbumsOrBooksEqual = (nameA?: string | null, nameB?: string | null): boolean => {
  const a = normAlbumOrSongName(nameA);
  const b = normAlbumOrSongName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  const stripArticles = (s: string) => s.replace(/^(de|the|het|een)\s+/, '').trim();
  return stripArticles(a) === stripArticles(b);
};

const isTrackInAlbumOrBook = (track: any, album: any, qrcodes: QRCodeData[] = []): boolean => {
  const albId = String(album.id || '').trim();
  const albTitle = album.title || '';

  const tAlbId = String(track.albumId || track.album_id || '').trim();
  const tAlbTitle = track.album || track.album_title || '';

  // 1. Direct album ID match (numeric database IDs: 1: Muzikale Krabbels, 2: De Echo, 3: De Geboorte van de Leeuw, 4: Echo's of the World)
  if (tAlbId && albId && tAlbId === albId) return true;

  // 2. Direct album title match
  if (tAlbTitle && albTitle && areAlbumsOrBooksEqual(tAlbTitle, albTitle)) return true;

  // 3. If album is a book (from boeken table), check if book title matches the track's album title
  if (albTitle && tAlbTitle && areAlbumsOrBooksEqual(albTitle, tAlbTitle)) return true;
  if (track.book_id && String(track.book_id) === albId) return true;

  // 4. Strict exclusion: if track explicitly belongs to a known album, it CANNOT belong to another album!
  if (tAlbId || tAlbTitle) return false;

  // 5. Fallback for uncatalogued tracks without album tag: QR code lookup
  const cleanTrackTitle = normAlbumOrSongName(track.title).replace(/^\d+[\s_.:-]+/, '');
  const qrMatch = qrcodes.find(q => {
    const qSong = normAlbumOrSongName(q.song).replace(/^\d+[\s_.:-]+/, '');
    return qSong && cleanTrackTitle && (qSong === cleanTrackTitle || cleanTrackTitle.includes(qSong));
  });
  if (qrMatch) {
    if (qrMatch.boekId && String(qrMatch.boekId) === albId) return true;
    if (qrMatch.boekTitel && areAlbumsOrBooksEqual(qrMatch.boekTitel, albTitle)) return true;
    if (qrMatch.album && areAlbumsOrBooksEqual(qrMatch.album, albTitle)) return true;
  }

  return false;
};

const isListenInAlbumOrBook = (
  listen: any,
  album: any,
  catalogTracks: any[] = [],
  qrcodes: QRCodeData[] = []
): boolean => {
  const albTitle = album.title || '';
  const albId = String(album.id || '').trim();

  const lAlbum = listen.album || '';
  const lTrackTitle = (listen.trackTitle || listen.song || listen.track_title || '').trim();
  const lTrackId = String(listen.trackId || listen.track_id || '').trim();

  // 1. Direct album tag check
  if (lAlbum) {
    if (areAlbumsOrBooksEqual(lAlbum, albTitle)) return true;
    const allKnownAlbums = ['Muzikale Krabbels', 'De Echo', 'De Geboorte van de Leeuw', "Echo's of the World"];
    if (allKnownAlbums.some(k => areAlbumsOrBooksEqual(lAlbum, k))) return false;
  }

  // 2. Track catalog lookup by ID or Title
  const cleanLTitle = normAlbumOrSongName(lTrackTitle).replace(/^\d+[\s_.:-]+/, '');
  const matchedTrack = catalogTracks.find(t => {
    if (lTrackId && String(t.id) === lTrackId) return true;
    const cleanT = normAlbumOrSongName(t.title).replace(/^\d+[\s_.:-]+/, '');
    return cleanT && cleanLTitle && cleanT === cleanLTitle;
  });

  if (matchedTrack) {
    return isTrackInAlbumOrBook(matchedTrack, album, qrcodes);
  }

  // 3. QR code fallback
  if (cleanLTitle) {
    const qrMatch = qrcodes.find(q => {
      const qSong = normAlbumOrSongName(q.song).replace(/^\d+[\s_.:-]+/, '');
      return qSong && (qSong === cleanLTitle || cleanLTitle.includes(qSong));
    });
    if (qrMatch) {
      if (qrMatch.boekId && String(qrMatch.boekId) === albId) return true;
      if (qrMatch.boekTitel && areAlbumsOrBooksEqual(qrMatch.boekTitel, albTitle)) return true;
      if (qrMatch.album && areAlbumsOrBooksEqual(qrMatch.album, albTitle)) return true;
    }
  }

  return false;
};

export function Admin() {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState<'qrcodes' | 'boeken' | 'hoofdstukken' | 'subscribers' | 'analytics' | 'music' | 'music_db' | 'track_locks'>('qrcodes');
  
  // Data lists
  const [qrcodes, setQrcodes] = useState<QRCodeData[]>([]);
  const [boeken, setBoeken] = useState<BookAdminData[]>([]);
  const [hoofdstukken, setHoofdstukken] = useState<ChapterAdminData[]>([]);
  const [subscribers, setSubscribers] = useState<{ id: string; email: string; firstName?: string; subscribedAt?: string }[]>([]);
  const [scans, setScans] = useState<any[]>([]);
  const [visitorSessions, setVisitorSessions] = useState<any[]>([]);
  const [historicalStats, setHistoricalStats] = useState<any[]>([]);
  const [musicListens, setMusicListens] = useState<any[]>([]);
  const [allCatalogTracks, setAllCatalogTracks] = useState<any[]>(DEFAULT_TRACK_SEEDS_FALLBACK);
  const [allCatalogAlbums, setAllCatalogAlbums] = useState<any[]>(DEFAULT_ALBUMS_FALLBACK);
  const [selectedBookFilter, setSelectedBookFilter] = useState<string>('all');
  const [retentionDaysValue, setRetentionDaysValue] = useState<string>('14');
  const [purging, setPurging] = useState(false);
  const [purgeSuccess, setPurgeSuccess] = useState<string | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] = useState<any | null>(null);
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'scans' | 'web'>('scans');
  const [isVisitorMapOpen, setIsVisitorMapOpen] = useState(false);
  const [isScanMapOpen, setIsScanMapOpen] = useState(false);
  const [isMusicMapOpen, setIsMusicMapOpen] = useState(false);
  const [musicMapRegion, setMusicMapRegion] = useState<'NL' | 'EU' | 'WORLD'>('NL');
  const [isTransipModalOpen, setIsTransipModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  
  // Auto background refresh states
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(false);
  const [countdown, setCountdown] = useState(15);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ignoreOwnAnalytics, setIgnoreOwnAnalytics] = useState<boolean>(() => {
    return isOwnAnalyticsIgnored();
  });

  const toggleIgnoreOwnAnalytics = () => {
    const newValue = !ignoreOwnAnalytics;
    setIgnoreOwnAnalytics(newValue);
    localStorage.setItem('ignore_own_analytics', String(newValue));
    localStorage.setItem('pv_ignore_admin_analytics', String(newValue));
    setAdminCookie(newValue);
  };

  // Mark device as admin and auto-restore admin session if token saved
  useEffect(() => {
    markDeviceAsAdmin();
    setIsAdminUser(true);
    const token = localStorage.getItem('krabbels_admin_token');
    if (token === 'GONDA1984') {
      setPassword('GONDA1984');
      setIsAuthorized(true);
      const isIgnored = isOwnAnalyticsIgnored();
      setIgnoreOwnAnalytics(isIgnored);
      setAdminCookie(isIgnored);
    }
  }, []);
  const [selectedBookQRFilter, setSelectedBookQRFilter] = useState<string>('');
  const [selectedBookChapterFilter, setSelectedBookChapterFilter] = useState<string>('');
  const [selectedBookAnalyticsFilter, setSelectedBookAnalyticsFilter] = useState<string>('');
  const [initializingDb, setInitializingDb] = useState(false);
  const [showConfirmIdChange, setShowConfirmIdChange] = useState<boolean>(false);

  // Muziekspeler Sloten-systeem state (Admin toggle)
  const [adminLocksEnabled, setAdminLocksEnabled] = useState<boolean>(() => isLockSystemEnabled());
  useEffect(() => {
    const syncAdminLocks = () => setAdminLocksEnabled(isLockSystemEnabled());
    window.addEventListener('pvg-locks-changed', syncAdminLocks);
    window.addEventListener('storage', syncAdminLocks);
    return () => {
      window.removeEventListener('pvg-locks-changed', syncAdminLocks);
      window.removeEventListener('storage', syncAdminLocks);
    };
  }, []);

  //QRCode Add/Edit state
  const [isAdding, setIsAdding] = useState(false);
  const [editingQRCode, setEditingQRCode] = useState<QRCodeData | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [qrImageOrigin, setQrImageOrigin] = useState<'none' | 'auto' | 'manual' | 'existing'>('none');
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [newItem, setNewItem] = useState<QRCodeData>({
    id: '',
    boekId: '',
    boekTitel: '',
    hoofdstukId: '',
    hoofdstuk: '',
    song: '',
    artist: '',
    spotifyLink: '',
    qrImage: ''
  });

  // Book Add/Edit state
  const [isAddingBoek, setIsAddingBoek] = useState(false);
  const [editingBoek, setEditingBoek] = useState<BookAdminData | null>(null);
  const [newBoek, setNewBoek] = useState<{ volgnummer: number; boektitel: string; qrLogo?: string }>({
    volgnummer: 1,
    boektitel: '',
    qrLogo: ''
  });

  // Chapter Add/Edit state
  const [isAddingHoofdstuk, setIsAddingHoofdstuk] = useState(false);
  const [editingHoofdstuk, setEditingHoofdstuk] = useState<ChapterAdminData | null>(null);
  const [newHoofdstuk, setNewHoofdstuk] = useState<{ boekId: string; volgnummer: number; omschrijving: string }>({
    boekId: '',
    volgnummer: 1,
    omschrijving: ''
  });

  const filteredScans = useMemo(() => {
    return scans.filter(s => {
      if (!selectedBookAnalyticsFilter) return true;
      if (!s.bookId) return false;
      return String(s.bookId).trim() === String(selectedBookAnalyticsFilter).trim();
    });
  }, [scans, selectedBookAnalyticsFilter]);

  const aggregatedData = useMemo(() => {
    const isoCounts: { [iso: string]: { dateStr: string; count: number } } = {};
    
    filteredScans.forEach(scan => {
      if (!scan.timestamp) return;
      try {
        const dateObj = new Date(scan.timestamp);
        const isoStr = dateObj.toISOString().split('T')[0]; // YYYY-MM-DD
        const dateStr = dateObj.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' });
        
        if (!isoCounts[isoStr]) {
          isoCounts[isoStr] = { dateStr, count: 0 };
        }
        isoCounts[isoStr].count += 1;
      } catch (e) {
        console.error(e);
      }
    });

    const sortedDates = Object.keys(isoCounts).sort();
    return sortedDates.map(iso => ({
      date: isoCounts[iso].dateStr,
      Scans: isoCounts[iso].count
    }));
  }, [filteredScans]);

  const getAuthHeader = () => password || localStorage.getItem('krabbels_admin_token') || 'GONDA1984';

  // Helper to fetch data from Express API or direct TransIP MySQL
  const fetchDataOrFirestore = async (apiEndpoint: string, collectionName: string) => {
    // 1. Direct TransIP MySQL check for analytics collections
    if (collectionName === 'music_listens' || collectionName === 'qr_scans' || collectionName === 'subscribers' || collectionName === 'visitor_sessions') {
      try {
        const transipAction = collectionName === 'music_listens' 
          ? 'get_music_listens' 
          : collectionName === 'qr_scans' 
          ? 'get_qr_scans' 
          : collectionName === 'visitor_sessions'
          ? 'get_visitor_sessions'
          : 'get_subscribers';
        const transipData = await transipGet(transipAction);
        const listKey = collectionName === 'qr_scans' 
          ? 'scans' 
          : collectionName === 'music_listens' 
          ? 'listens' 
          : collectionName === 'visitor_sessions'
          ? 'sessions'
          : collectionName;
        if (transipData && Array.isArray(transipData[listKey])) {
          console.log(`[Admin Fetch] Loaded ${collectionName} directly from TransIP MySQL (${transipData[listKey].length} items)`);
          return transipData[listKey];
        }
      } catch (err) {
        console.warn(`[Admin Fetch] Direct TransIP MySQL fetch for ${collectionName} failed:`, err);
      }
    }

    // 2. Try Express API
    try {
      const res = await fetch(apiEndpoint, {
        headers: { 'Authorization': getAuthHeader() }
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          const data = await res.json();
          const listKey = collectionName === 'qr_scans' ? 'scans' : collectionName === 'music_listens' ? 'listens' : collectionName;
          if (data && data[listKey]) {
            console.log(`[Admin Fetch] Loaded ${collectionName} via API (source: ${data.source || 'api'})`);
            return data[listKey];
          }
        }
      }
    } catch (e) {
      console.warn(`[Admin Fetch] API fetch failed for ${collectionName}:`, e);
    }

    // 3. Fallback directly to TransIP MySQL
    console.log(`[Admin Fetch] Querying ${collectionName} directly from TransIP MySQL...`);
    if (collectionName === 'boeken') {
      const list = await getTransipBoeken();
      console.log(`[Admin Fetch] Loaded boeken directly from TransIP MySQL (${list.length} items)`);
      return list;
    }
    if (collectionName === 'hoofdstukken') {
      const list = await getTransipHoofdstukken();
      console.log(`[Admin Fetch] Loaded hoofdstukken directly from TransIP MySQL (${list.length} items)`);
      return list;
    }
    if (collectionName === 'qrcodes') {
      const list = await getTransipQrCodes();
      console.log(`[Admin Fetch] Loaded qrcodes directly from TransIP MySQL (${list.length} items)`);
      return list;
    }

    return [];
  };

  // Helper to save document to Express API or direct TransIP MySQL
  const saveDocOrFirestore = async (apiEndpoint: string, collectionName: string, id: string | undefined, payload: any) => {
    let apiSuccess = false;
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': getAuthHeader()
        },
        body: JSON.stringify({
          ...payload,
          id
        })
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) {
          apiSuccess = true;
          console.log(`[Admin Save] Saved ${collectionName} via API`);
        }
      }
    } catch (e) {
      console.warn(`[Admin Save] API save failed for ${collectionName}, falling back to TransIP MySQL:`, e);
    }

    if (!apiSuccess) {
      console.log(`[Admin Save] Saving ${collectionName} directly to TransIP MySQL...`);
      if (collectionName === 'boeken') {
        await saveTransipBoek({ id, ...payload });
      } else if (collectionName === 'hoofdstukken') {
        await saveTransipHoofdstuk({ id, ...payload });
      } else if (collectionName === 'qrcodes') {
        await saveTransipQrCode({ id, ...payload });
      }
      console.log(`[Admin Save] Saved ${collectionName} to TransIP MySQL`);
    }
  };

  // Helper to delete document from Express API or direct TransIP MySQL
  const deleteDocOrFirestore = async (apiEndpoint: string, collectionName: string, id: string) => {
    // 1. Direct TransIP MySQL deletion
    if (collectionName === 'music_listens') {
      await transipPost('delete_music_listen', { id }).catch(() => {});
    } else if (collectionName === 'qr_scans') {
      await transipPost('delete_qr_scan', { id }).catch(() => {});
    } else if (collectionName === 'subscribers') {
      await transipPost('delete_subscriber', { id }).catch(() => {});
    } else if (collectionName === 'visitor_sessions') {
      await transipPost('delete_visitor_session', { sessionId: id }).catch(() => {});
    } else if (collectionName === 'boeken') {
      await deleteTransipBoek(id).catch(() => {});
    } else if (collectionName === 'hoofdstukken') {
      await deleteTransipHoofdstuk(id).catch(() => {});
    } else if (collectionName === 'qrcodes') {
      await deleteTransipQrCode(id).catch(() => {});
    }

    try {
      await fetch(apiEndpoint, {
        method: 'DELETE',
        headers: {
          'Authorization': getAuthHeader()
        }
      });
      console.log(`[Admin Delete] Deleted ${collectionName} via API`);
    } catch (e) {
      console.warn(`[Admin Delete] API delete call warning for ${collectionName}:`, e);
    }
  };

  const clearAllScansOrFirestore = async (bookId?: string) => {
    // 1. Clear directly in TransIP MySQL database
    await transipPost('purge_qr_scans', { bookId }).catch(() => {});

    try {
      const endpoint = bookId ? `/api/scans?bookId=${encodeURIComponent(bookId)}` : '/api/scans';
      await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': getAuthHeader() }
      });
      console.log('[Admin Clear] Cleared scans via API (filtered)');
    } catch (e) {
      console.warn('[Admin Clear] API clear scans failed:', e);
    }
  };

  const fetchAllData = async (isBackground = false) => {
    setCountdown(15);
    if (!isBackground) {
      setLoading(true);
    } else {
      setIsAutoRefreshing(true);
    }
    setError(null);
    try {
      const [qlist, blist, hlist, sublist, scanlist, musiclist] = await Promise.all([
        fetchDataOrFirestore('/api/qrcodes', 'qrcodes'),
        fetchDataOrFirestore('/api/boeken', 'boeken'),
        fetchDataOrFirestore('/api/hoofdstukken', 'hoofdstukken'),
        fetchDataOrFirestore('/api/subscribers', 'subscribers'),
        fetchDataOrFirestore('/api/scans', 'qr_scans'),
        fetchDataOrFirestore('/api/analytics/music', 'music_listens')
      ]);

      qlist.sort((a: any, b: any) => (a.id || '').localeCompare(b.id || ''));
      
      blist.sort((a: any, b: any) => {
        const numA = parseInt(a.volgnummer) || 0;
        const numB = parseInt(b.volgnummer) || 0;
        return numA - numB;
      });

      hlist.sort((a: any, b: any) => {
        const numA = parseInt(a.volgnummer) || 0;
        const numB = parseInt(b.volgnummer) || 0;
        return numA - numB;
      });

      sublist.sort((a: any, b: any) => {
        const timeA = a.subscribedAt || '';
        const timeB = b.subscribedAt || '';
        return timeB.localeCompare(timeA);
      });

      scanlist.sort((a: any, b: any) => {
        const timeA = a.timestamp || '';
        const timeB = b.timestamp || '';
        return timeB.localeCompare(timeA);
      });

      // Fetch analytics sessions and daily stats
      let activeSessionsList: any[] = [];
      let historicalStatsList: any[] = [];
      try {
        // 1. Priority: Direct TransIP MySQL database bridge
        const transipSessions = await transipGet('get_visitor_sessions');
        if (transipSessions && Array.isArray(transipSessions.sessions)) {
          activeSessionsList = transipSessions.sessions;
        } else {
          // 2. Express API
          const res = await fetch('/api/analytics/overview', {
            headers: { 'Authorization': getAuthHeader() }
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json();
            activeSessionsList = data.activeSessions || [];
            historicalStatsList = data.historicalStats || [];
          }
        }
      } catch (analyticsErr) {
        console.warn('TransIP/API analytics overview fetch warning:', analyticsErr);
      }

      setQrcodes(qlist);
      setBoeken(blist);
      setHoofdstukken(hlist);
      setSubscribers(sublist);
      setScans(scanlist);
      setVisitorSessions(activeSessionsList);
      setHistoricalStats(historicalStatsList);
      setMusicListens(musiclist || []);

      // Fetch catalog tracks dynamically from database/table & TransIP bridge
      try {
        let loadedAlbums: any[] = [];
        let loadedTracks: any[] = [];

        // 1. Try direct TransIP bridge or custom configured URL
        try {
          const transipUrl = localStorage.getItem('transip_music_api_url') || 'https://paulvangeenen.nl/api/music_database.php';
          const transipKey = localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
          const bridgeRes = await fetch(`${transipUrl}?action=get_catalog&t=${Date.now()}`, {
            headers: { 'X-API-Key': transipKey }
          });
          if (bridgeRes.ok) {
            const bridgeData = await bridgeRes.json();
            if (bridgeData && Array.isArray(bridgeData.albums) && bridgeData.albums.length > 0) {
              loadedAlbums = bridgeData.albums;
            }
            if (bridgeData && Array.isArray(bridgeData.tracks) && bridgeData.tracks.length > 0) {
              loadedTracks = bridgeData.tracks;
            }
          }
        } catch (bridgeErr) {
          // Silent fallback
        }

        // 2. Fallback to /api/music/tracks
        if (loadedAlbums.length === 0 || loadedTracks.length === 0) {
          try {
            const catalogRes = await fetch(`/api/music/tracks?t=${Date.now()}`);
            const cType = catalogRes.headers.get('content-type') || '';
            if (catalogRes.ok && cType.includes('application/json')) {
              const catalogData = await catalogRes.json();
              if (catalogData) {
                if (Array.isArray(catalogData.albums) && catalogData.albums.length > 0) {
                  loadedAlbums = catalogData.albums;
                }
                if (Array.isArray(catalogData.tracks) && catalogData.tracks.length > 0) {
                  loadedTracks = catalogData.tracks;
                }
              }
            }
          } catch (trackErr) {
            console.warn('[Admin] Local catalog tracks fetch missed:', trackErr);
          }
        }

        if (loadedAlbums.length > 0) {
          setAllCatalogAlbums(loadedAlbums);
        }
        if (loadedTracks.length > 0) {
          setAllCatalogTracks(loadedTracks);
        }
      } catch (trackErr) {
        console.warn('[Admin] Catalog tracks fetch error:', trackErr);
      }

    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err?.message || 'Kon gegevens niet ophalen uit de database.');
    } finally {
      if (!isBackground) {
        setLoading(false);
      } else {
        setIsAutoRefreshing(false);
      }
    }
  };

  const handlePurgeAnalytics = async (days: number) => {
    if (!window.confirm(`Weet je zeker dat je alle gedetailleerde bezoekerssessies ouder dan ${days} dagen wilt opschonen?\n\nDe individuele logs worden gewist uit jouw TransIP MySQL database.`)) {
      return;
    }
    setPurging(true);
    setPurgeSuccess(null);
    try {
      // 1. Direct purge in TransIP MySQL database
      await transipPost('purge_visitor_sessions', { retentionDays: days }).catch(() => {});

      // 2. Also try API route if available
      try {
        await fetch('/api/analytics/purge', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': getAuthHeader()
          },
          body: JSON.stringify({ retentionDays: days })
        });
      } catch {}

      setPurgeSuccess('Bezoekerssessies succesvol opgeschoond in TransIP MySQL!');
      await fetchAllData();
      setTimeout(() => setPurgeSuccess(null), 10000);
    } catch (e: any) {
      console.error('Purge error:', e);
      alert(`Fout bij opschonen van logs: ${e?.message || e}`);
    } finally {
      setPurging(false);
    }
  };

  const handlePurgeMusicAnalytics = async () => {
    if (!window.confirm('Weet je zeker dat je ALLE luisterhistorie en muziekmetingen wilt wissen uit de TransIP MySQL database?')) {
      return;
    }
    setLoading(true);
    try {
      // 1. Clear directly in TransIP MySQL database
      await transipPost('purge_music_listens', {}).catch(() => {});

      // 2. Clear backend API if available
      try {
        await fetch('/api/analytics/music-purge-all', {
          method: 'DELETE',
          headers: { 'Authorization': getAuthHeader() }
        });
      } catch (e) {
        console.warn('API purge call warning:', e);
      }

      setMusicListens([]);
      alert('Alle luisterdata is succesvol gewist uit de TransIP MySQL database.');
    } catch (e: any) {
      console.error('Error purging music analytics:', e);
      alert('Fout bij het wissen van de luisterdata: ' + (e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeDatabase = async () => {
    if (!window.confirm('Weet je zeker dat je de database wilt vullen met de standaard boeken en hoofdstukken? Dit stelt de basismeldingen in.')) {
      return;
    }
    setInitializingDb(true);
    setError(null);
    try {
      const defaultBooks = [
        { id: '1', volgnummer: 1, boektitel: 'Koester het Leven: de weg ernaartoe' },
        { id: '2', volgnummer: 2, boektitel: 'Koester het Leven: mijn eerste 21 jaar' },
        { id: '3', volgnummer: 3, boektitel: 'De Echo' },
        { id: '4', volgnummer: 4, boektitel: 'De Bestemming' }
      ];

      const defaultChapters = [
        { boekId: '3', volgnummer: 1, omschrijving: 'De leeuw in de kerk' },
        { boekId: '3', volgnummer: 2, omschrijving: 'Luna als eigen personage' },
        { boekId: '3', volgnummer: 3, omschrijving: 'Hoofdstuk 10 – De Demon ontwaakt' }
      ];

      // POST books sequentially
      for (const b of defaultBooks) {
        await saveDocOrFirestore('/api/boeken', 'boeken', b.id, {
          volgnummer: b.volgnummer,
          boektitel: b.boektitel
        });
      }

      // POST chapters sequentially
      for (const c of defaultChapters) {
        await saveDocOrFirestore('/api/hoofdstukken', 'hoofdstukken', undefined, c);
      }

      // Refresh listings
      await fetchAllData();
      alert('De database is succesvol geïnitialiseerd met de standaard boeken en hoofdstukken!');
    } catch (err: any) {
      console.error('Initialiseer database fout:', err);
      setError(err?.message || 'Fout bij het initialiseren van de database.');
    } finally {
      setInitializingDb(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'GONDA1984') {
      markDeviceAsAdmin();
      setIsAdminUser(true);
      setIgnoreOwnAnalytics(true);
      setIsAuthorized(true);
    } else {
      setError('Onjuist wachtwoord.');
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchAllData();
    }
  }, [isAuthorized]);

  // Periodic background refresh timer (15 seconds)
  useEffect(() => {
    if (!isAuthorized || !isAutoRefresh) {
      return;
    }

    setCountdown(15);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchAllData(true);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAuthorized, isAutoRefresh]);

  useEffect(() => {
    if (boeken.length > 0) {
      if (!selectedBookQRFilter) {
        setSelectedBookQRFilter(boeken[0].id);
      }
      if (!selectedBookChapterFilter) {
        setSelectedBookChapterFilter(boeken[0].id);
      }
    }
  }, [boeken, selectedBookQRFilter, selectedBookChapterFilter]);

  const getBookQrLogo = (boekId?: string): string => {
    if (!boekId) return '';
    return boeken.find(b => b.id === boekId)?.qrLogo || '';
  };

  const runAutoGenerateQr = async (code: string, boekId?: string, silent = false) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (cleanCode.length < 2) return '';
    const bookLogo = getBookQrLogo(boekId);
    setIsGeneratingQr(true);
    try {
      const { dataUrl, targetUrl, verified } = await generateRedirectQrDataUrl(cleanCode, bookLogo, 200);
      setNewItem(prev => ({ ...prev, qrImage: dataUrl }));
      setQrImageOrigin('auto');
      setUploadError(null);
      if (!silent) {
        setUploadSuccess(
          `Automatisch QR-code (200x200) gegenereerd voor:\n"${targetUrl}"` +
          (bookLogo ? ' (inclusief midden-logo van het boek)' : ' (zonder midden-logo: boek heeft nog geen logo ingesteld)') +
          (verified ? ' ✓ Scanbaar' : '')
        );
      }
      return dataUrl;
    } catch (err) {
      console.error('Auto QR generation error:', err);
      if (!silent) {
        setUploadError('Automatisch genereren van QR-code is mislukt.');
      }
      return '';
    } finally {
      setIsGeneratingQr(false);
    }
  };

  // Automatische achtergrond-generatie zodra Redirect Code of Boek verandert (tenzij handmatig geüpload)
  useEffect(() => {
    if (!isAdding) return;
    if (qrImageOrigin === 'manual' || qrImageOrigin === 'existing') return;
    const cleanCode = newItem.id.trim().toUpperCase();
    if (cleanCode.length < 2) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      const bookLogo = boeken.find(b => b.id === newItem.boekId)?.qrLogo || '';
      setIsGeneratingQr(true);
      try {
        const { dataUrl, targetUrl, verified } = await generateRedirectQrDataUrl(cleanCode, bookLogo, 200);
        if (cancelled) return;
        setNewItem(prev => ({ ...prev, qrImage: dataUrl }));
        setQrImageOrigin('auto');
        setUploadError(null);
        setUploadSuccess(
          `Automatisch QR-code (200x200) gegenereerd voor:\n"${targetUrl}"` +
          (bookLogo ? ' (met boek-logo)' : ' (zonder boek-logo)') +
          (verified ? ' ✓ Scanbaar' : '')
        );
      } catch (err) {
        console.warn('Background QR generation failed:', err);
      } finally {
        if (!cancelled) setIsGeneratingQr(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isAdding, newItem.id, newItem.boekId, qrImageOrigin, boeken]);

  // QRCode Handlers
  const saveQRCode = async (idWasChanged: boolean) => {
    setLoading(true);
    try {
      let payloadToSave = { ...newItem };
      // Zorg dat er bij opslaan altijd automatisch een QR-afbeelding wordt gegenereerd indien nog leeg
      if (!payloadToSave.qrImage && payloadToSave.id.trim().length >= 2) {
        const bookLogo = getBookQrLogo(payloadToSave.boekId);
        const generated = await generateRedirectQrDataUrl(payloadToSave.id, bookLogo, 200);
        payloadToSave.qrImage = generated.dataUrl;
      }

      await saveDocOrFirestore('/api/qrcodes', 'qrcodes', payloadToSave.id, payloadToSave);
      
      if (idWasChanged && editingQRCode) {
        // Delete old record with original ID
        await deleteDocOrFirestore(`/api/qrcodes/${encodeURIComponent(editingQRCode.id)}`, 'qrcodes', editingQRCode.id);
      }
      
      setIsAdding(false);
      setEditingQRCode(null);
      setShowConfirmIdChange(false);
      setQrImageOrigin('none');
      setUploadError(null);
      setUploadSuccess(null);
      setNewItem({
        id: '',
        boekId: '',
        boekTitel: '',
        hoofdstukId: '',
        hoofdstuk: '',
        song: '',
        artist: '',
        spotifyLink: '',
        qrImage: ''
      });
      fetchAllData();
    } catch (err) {
      console.error('Add/Update error:', err);
      setError('Fout bij het opslaan.');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccess(null);

    const redirectCode = newItem.id.toUpperCase().trim();
    if (!redirectCode) {
      setUploadError("Vul eerst de 'Redirect Code' hierboven in voordat je de QR-code afbeelding uploadt.");
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        // We scannen eerst op de ORIGINELE schaal van de afbeelding voor maximale resolutie en precisie.
        // Verkleinen vóór het scannen kan er namelijk voor zorgen dat de QR-patronen wazig worden.
        const scanCanvas = document.createElement('canvas');
        scanCanvas.width = img.width;
        scanCanvas.height = img.height;
        const scanCtx = scanCanvas.getContext('2d');
        if (!scanCtx) {
          setUploadError("Fout bij het maken van een canvas om de QR-code op volledige resolutie te scannen.");
          return;
        }

        scanCtx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = scanCtx.getImageData(0, 0, img.width, img.height);

        try {
          // jsQR berekent de patronen op basis van de beeldgegevens
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            const decodedValue = code.data.trim();
            const targetId = redirectCode;

            // Flexibele validatie om te zien of de QR-inhoud overeenkomt met de redirectcode
            let isMatch = decodedValue.toUpperCase() === targetId;

            if (!isMatch) {
              const upperDecoded = decodedValue.toUpperCase();
              if (upperDecoded.endsWith('/' + targetId)) {
                isMatch = true;
              } else {
                try {
                  const url = new URL(decodedValue);
                  const pathSegment = url.pathname.substring(1).toUpperCase();
                  if (pathSegment === targetId) {
                    isMatch = true;
                  }
                } catch {
                  // Negeer URL parse fouten
                }
              }
            }

            if (isMatch) {
              // Pas nà het succesvol scannen verkleinen we de afbeelding naar max 300px voor efficiënte opslag
              const storageCanvas = document.createElement('canvas');
              const maxDim = 300;
              let width = img.width;
              let height = img.height;
              if (width > maxDim || height > maxDim) {
                if (width > height) {
                  height = Math.round((height * maxDim) / width);
                  width = maxDim;
                } else {
                  width = Math.round((width * maxDim) / height);
                  height = maxDim;
                }
              }
              storageCanvas.width = width;
              storageCanvas.height = height;
              const storageCtx = storageCanvas.getContext('2d');
              
              if (storageCtx) {
                storageCtx.drawImage(img, 0, 0, width, height);
                const optimizedBase64 = storageCanvas.toDataURL("image/jpeg", 0.75);
                setNewItem(prev => ({ ...prev, qrImage: optimizedBase64 }));
                setQrImageOrigin('manual');
                setUploadSuccess(`Afbeelding [${img.width}x${img.height}px] met succes gescand!\n\nDe QR-code bevat de waarde:\n"${decodedValue}"\n\nDit komt correct overeen met de ingestelde redirectcode: "${targetId}".`);
              } else {
                setNewItem(prev => ({ ...prev, qrImage: result }));
                setQrImageOrigin('manual');
                setUploadSuccess(`Afbeelding met succes gescand!\n\nWaarde: "${decodedValue}" komt overeen met "${targetId}".`);
              }
            } else {
              setUploadError(
                `Onjuiste QR-code gedetecteerd!\n\n` +
                `• De QR-code in de geüploade foto heeft de inhoud:\n  👉 "${decodedValue}"\n\n` +
                `• Maar dit record verwacht exact de redirectcode:\n  👉 "${targetId}"\n\n` +
                `Oplossingen:\n` +
                `1. Zorg ervoor dat je de juiste QR-afbeelding uploadt.\n` +
                `2. Of pas de 'Redirect Code' hierboven aan naar "${decodedValue}" om deze kloppend te maken.`
              );
            }
          } else {
            setUploadError(
              `Er kon geen geldige QR-code worden herkend in deze afbeelding (${img.width}x${img.height} pixels).\n\n` +
              `Waarom mislukt dit meestal?\n` +
              `• Te grote afstand / te kleine QR-code: Als de QR-code te klein in beeld is, vloeien de zwarte en witte blokjes samen. Probeer de afbeelding vooraf dichterbij bij te snijden.\n` +
              `• Te weinig contrast of onscherp: Zorg ervoor dat de QR-code goed belicht en scherp in focus is, zonder weerspiegelingen.\n` +
              `• Moiré-rasterpatronen: Bij screenshots of foto's gemaakt van een ander computerscherm/telefoon kunnen er interferentielijnen ontstaan. Upload bij voorkeur het originele digitale bestand (PNG of JPG).\n` +
              `• Geen 'Quiet Zone': Een QR-code heeft een witte marge rondom de code nodig om herkend te worden. Indien de afbeelding direct op de zwarte rand eindigt, mislukt de herkenning.`
            );
          }
        } catch (scanErr) {
          console.error("QR decoding error:", scanErr);
          setUploadError("Er is een interne fout opgetreden tijdens het analyseren van de QR-afbeelding.");
        }
      };

      img.onerror = () => {
        setUploadError("Het bestand kon niet als een geldige afbeelding worden ingeladen. Controleer of het bestand niet corrupt is.");
      };

      img.src = result;
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.id) return;

    if (editingQRCode) {
      const originalId = editingQRCode.id.toUpperCase().trim();
      const currentId = newItem.id.toUpperCase().trim();
      if (originalId !== currentId) {
        setShowConfirmIdChange(true);
        return; // Wait for confirmation in the custom modal
      }
    }

    await saveQRCode(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(`Weet je zeker dat je ${id} wilt verwijderen?`)) return;

    setLoading(true);
    try {
      await deleteDocOrFirestore(`/api/qrcodes/${encodeURIComponent(id)}`, 'qrcodes', id);
      fetchAllData();
    } catch (err) {
      console.error('Delete error:', err);
      setError('Fout bij het verwijderen.');
    } finally {
      setLoading(false);
    }
  };

  // Book Handlers
  const handleBookLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeCenterLogoForBook(file, 512);
      setNewBoek(prev => ({ ...prev, qrLogo: optimized }));
    } catch (err) {
      console.error('Book logo upload error:', err);
      setError('Logo-afbeelding kon niet worden verwerkt.');
    }
    e.target.value = '';
  };

  const handleSaveBoek = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoek.boektitel) return;

    setLoading(true);
    try {
      const targetId = editingBoek?.id || undefined;
      const bPayload = {
        volgnummer: newBoek.volgnummer,
        boektitel: newBoek.boektitel,
        qrLogo: newBoek.qrLogo || null
      };
      await saveDocOrFirestore('/api/boeken', 'boeken', targetId, bPayload);
      setIsAddingBoek(false);
      setEditingBoek(null);
      setNewBoek({ volgnummer: 1, boektitel: '', qrLogo: '' });
      fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Fout bij opslaan boek.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBoek = async (id: string, name: string) => {
    if (!window.confirm(`Weet je zeker dat je het boek "${name}" wilt verwijderen? Dit beïnvloedt reeds gekoppelde QR Codes.`)) return;
    setLoading(true);
    try {
      await deleteDocOrFirestore(`/api/boeken/${encodeURIComponent(id)}`, 'boeken', id);
      fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Fout bij verwijderen boek.');
    } finally {
      setLoading(false);
    }
  };

  // Chapter Handlers
  const handleSaveHoofdstuk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHoofdstuk.boekId || !newHoofdstuk.omschrijving) return;

    setLoading(true);
    try {
      const targetId = editingHoofdstuk?.id || undefined;
      const hPayload = {
        boekId: newHoofdstuk.boekId,
        volgnummer: newHoofdstuk.volgnummer,
        omschrijving: newHoofdstuk.omschrijving
      };
      await saveDocOrFirestore('/api/hoofdstukken', 'hoofdstukken', targetId, hPayload);
      setIsAddingHoofdstuk(false);
      setEditingHoofdstuk(null);
      setNewHoofdstuk({ boekId: '', volgnummer: 1, omschrijving: '' });
      fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Fout bij opslaan hoofdstuk.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHoofdstuk = async (id: string, name: string) => {
    if (!window.confirm(`Weet je zeker dat je hoofdstuk "${name}" wilt verwijderen?`)) return;
    setLoading(true);
    try {
      await deleteDocOrFirestore(`/api/hoofdstukken/${encodeURIComponent(id)}`, 'hoofdstukken', id);
      fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Fout bij verwijderen hoofdstuk.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubscriber = async (id: string, email: string) => {
    if (!window.confirm(`Weet je zeker dat je abonnee met e-mail "${email}" wilt verwijderen?`)) return;
    setLoading(true);
    try {
      await deleteDocOrFirestore(`/api/subscribers/${encodeURIComponent(id)}`, 'subscribers', id);
      fetchAllData();
    } catch (err) {
      console.error(err);
      setError('Fout bij verwijderen abonnee.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-earth-dark px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-earth-clay/10 p-8 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-earth-gold/20 rounded-full flex items-center justify-center text-earth-gold">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-serif text-white text-center mb-8">Beheer Login</h1>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-earth-light/60 text-sm mb-2">Wachtwoord</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold transition-colors"
                autoFocus
              />
            </div>
            {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
            <button 
              type="submit" 
              className="w-full bg-earth-gold text-black font-bold py-3 rounded-lg hover:bg-earth-gold/90 transition-colors"
            >
              Toegang verkrijgen
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const activeChapters = newItem.boekId 
    ? hoofdstukken.filter(h => h.boekId === newItem.boekId)
    : [];

  return (
    <div className="min-h-screen bg-earth-dark py-12 px-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-serif text-white">Beheerderspaneel</h1>
              
              {/* LIVE INDICATOR PILL */}
              <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-medium">
                <div className="relative flex h-2 w-2">
                  {isAutoRefresh && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  )}
                  <span className={cn("relative inline-flex rounded-full h-2 w-2", isAutoRefresh ? "bg-green-500" : "bg-earth-light/30")}></span>
                </div>
                <span className="text-white/80 select-none">
                  {isAutoRefresh ? (
                    <>Live updates <span className="text-earth-gold font-mono text-[10px]/none underline decoration-dotted">over {countdown}s</span></>
                  ) : (
                    'Live updates uit'
                  )}
                </span>
                
                {/* AUTO REFRESH TOGGLE ACTION */}
                <button
                  type="button"
                  onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  className={cn(
                    "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md transition-all cursor-pointer",
                    isAutoRefresh 
                      ? "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20" 
                      : "bg-white/5 text-earth-light/60 border border-white/10 hover:bg-white/10 hover:text-white"
                  )}
                >
                  {isAutoRefresh ? 'AAN' : 'UIT'}
                </button>

                <div className="w-[1px] h-3 bg-white/10" />

                {/* MANUAL REFRESH ACTION */}
                <button
                  type="button"
                  onClick={() => fetchAllData(isAutoRefresh || isAutoRefreshing)}
                  disabled={loading || isAutoRefreshing}
                  className="p-1 hover:text-earth-gold disabled:opacity-30 flex items-center gap-1 text-earth-light/60 hover:text-white transition-colors cursor-pointer"
                  title="Nu handmatig vernieuwen"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", (loading || isAutoRefreshing) && "animate-spin text-earth-gold")} />
                </button>
              </div>

              {/* MUZIEKSPELER SLOTEN-SYSTEEM SHORTCUT PILL */}
              <button
                type="button"
                onClick={() => setActiveTab('track_locks')}
                className={cn(
                  "flex items-center gap-2 border px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer",
                  activeTab === 'track_locks'
                    ? "bg-earth-gold text-black border-earth-gold font-bold shadow-lg shadow-earth-gold/20"
                    : "bg-white/5 border-earth-gold/30 text-white/90 hover:border-earth-gold hover:bg-earth-gold/10"
                )}
                title="Open het aparte Sloten & SoundTracks beheerscherm"
              >
                <Lock className={cn("w-3.5 h-3.5", activeTab === 'track_locks' ? "text-black" : "text-earth-gold")} />
                <span>Sloten & SoundTracks Beheer</span>
              </button>

              {/* QR-CODE STUDIO SHORTCUT PILL (OPENT NIEUW VENSTER/TABBLAD) */}
              <button
                type="button"
                onClick={() => {
                  const targetBookId = selectedBookQRFilter || boeken[0]?.id || '';
                  const url = targetBookId
                    ? `/beheer/qr-studio?boekId=${encodeURIComponent(targetBookId)}`
                    : '/beheer/qr-studio';
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="flex items-center gap-2 border px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer bg-white/5 border-earth-gold/30 text-white/90 hover:border-earth-gold hover:bg-earth-gold/15"
                title="Open de QR-code Studio in een nieuw venster om drukklare QR-codes te maken en te downloaden"
              >
                <QrCode className="w-3.5 h-3.5 text-earth-gold" />
                <span>QR-code Studio</span>
                <ExternalLink className="w-3 h-3 text-earth-gold/70" />
              </button>
            </div>
            <p className="text-earth-light/60 italic">Onderhoud de boeken, hoofdstukken en redirects.</p>
          </div>
          <div className="flex gap-3">
            {activeTab === 'qrcodes' && (
              <button 
                onClick={() => {
                  const preselectedBookId = selectedBookQRFilter || boeken[0]?.id || '';
                  const preselectedBook = boeken.find(b => b.id === preselectedBookId);
                  const firstChapter = hoofdstukken.find(h => h.boekId === preselectedBookId);
                  setEditingQRCode(null);
                  setQrImageOrigin('none');
                  setNewItem({
                    id: '',
                    boekId: preselectedBookId,
                    boekTitel: preselectedBook?.boektitel || '',
                    hoofdstukId: firstChapter?.id || '',
                    hoofdstuk: firstChapter?.omschrijving || '',
                    song: '',
                    artist: '',
                    spotifyLink: '',
                    qrImage: ''
                  });
                  setUploadError(null);
                  setUploadSuccess(null);
                  setIsAdding(true);
                }}
                className="flex items-center gap-2 bg-earth-gold text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform"
              >
                <Plus className="w-5 h-5" />
                Nieuwe Redirect
              </button>
            )}
            {activeTab === 'boeken' && (
              <button 
                onClick={() => {
                  setEditingBoek(null);
                  setNewBoek({ volgnummer: boeken.length + 1, boektitel: '', qrLogo: '' });
                  setIsAddingBoek(true);
                }}
                className="flex items-center gap-2 bg-earth-gold text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform"
              >
                <Plus className="w-5 h-5" />
                Nieuw Boek
              </button>
            )}
            {activeTab === 'hoofdstukken' && (
              <button 
                onClick={() => {
                  const preselectedBookId = selectedBookChapterFilter || boeken[0]?.id || '';
                  setEditingHoofdstuk(null);
                  setNewHoofdstuk({ 
                    boekId: preselectedBookId, 
                    volgnummer: hoofdstukken.filter(h => h.boekId === preselectedBookId).length + 1, 
                    omschrijving: '' 
                  });
                  setIsAddingHoofdstuk(true);
                }}
                className="flex items-center gap-2 bg-earth-gold text-black px-6 py-3 rounded-full font-bold hover:scale-105 transition-transform"
              >
                <Plus className="w-5 h-5" />
                Nieuw Hoofdstuk
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-earth-gold/20 mb-8 overflow-x-auto gap-2 no-scrollbar scrollbar-none pb-0.5">
          <button
            onClick={() => setActiveTab('qrcodes')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'qrcodes' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <ExternalLink className="w-4 h-4" />
            Redirect Mappings
          </button>
          
          <button
            onClick={() => setActiveTab('boeken')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'boeken' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Book className="w-4 h-4" />
            Boeken ({boeken.length})
          </button>

          <button
            onClick={() => setActiveTab('hoofdstukken')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'hoofdstukken' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <ClipboardList className="w-4 h-4" />
            Hoofdstukken ({hoofdstukken.length})
          </button>

          <button
            onClick={() => setActiveTab('subscribers')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'subscribers' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Mail className="w-4 h-4" />
            Abonnees ({subscribers.length})
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'analytics' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Shield className="w-4 h-4" />
            Scan Analytics ({scans.length})
          </button>

          <button
            onClick={() => setActiveTab('music')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'music' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Music className="w-4 h-4 text-earth-gold" />
            Muziek Analytics ({musicListens.length})
          </button>

          <button
            onClick={() => setActiveTab('music_db')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'music_db' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            Muziek Database (TransIP)
          </button>

          <button
            onClick={() => setActiveTab('track_locks')}
            className={cn(
              "pb-4 px-4 font-serif text-lg font-medium border-b-2 transition-colors duration-300 flex items-center gap-2 whitespace-nowrap",
              activeTab === 'track_locks' 
                ? "border-earth-gold text-white" 
                : "border-transparent text-earth-light/40 hover:text-earth-light/80"
            )}
          >
            <Lock className="w-4 h-4 text-earth-gold" />
            Sloten & SoundTracks
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-8 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)}><X className="w-5 h-5" /></button>
          </div>
        )}

        {isAuthorized && boeken.length === 0 && !loading && (
          <div className="bg-earth-gold/5 border border-earth-gold/25 p-6 rounded-2xl mb-8 space-y-4">
            <div className="flex items-start gap-3">
              <Sparkles className="text-earth-gold w-6 h-6 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h4 className="text-white font-serif font-bold text-base">Nieuwe, lege database gedetecteerd!</h4>
                <p className="text-earth-light/60 text-xs mt-1 leading-relaxed">
                  Uw TransIP MySQL database is met succes verbonden, maar bevat momenteel nog geen boeken of hoofdstukken. Klik op de knop hieronder om direct de 4 standaard boeken en de 3 hoofdstukken voor "De Echo" te initialiseren. Daarna kunt u direct beginnen met het beheren en bekijken van QR-codes en scans!
                </p>
              </div>
            </div>
            <div className="pl-9">
              <button
                disabled={initializingDb}
                onClick={handleInitializeDatabase}
                className="bg-earth-gold hover:scale-105 active:scale-98 transition-all text-black font-bold text-xs px-4 py-2.5 rounded-full flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-lg"
              >
                {initializingDb ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    Database vullen...
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5" />
                    Initialiseer Standaard Boeken &amp; Hoofdstukken
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* LOADING STATE INDICATOR */}
        {loading && (
          <div className="flex justify-center items-center py-8">
            <div className="w-8 h-8 border-4 border-earth-gold/20 border-t-earth-gold rounded-full animate-spin" />
            <span className="ml-3 text-earth-light/60 text-sm font-medium">Laden van gegevens...</span>
          </div>
        )}

        {/* TAB 1: QR CODE redirects */}
        {activeTab === 'qrcodes' && !loading && (() => {
          // Sort and filter QR codes by the selected book filter, and by chapter volgnummer (HoofdstukID)
          const sortedAndFilteredQRCodes = [...qrcodes]
            .filter((code) => !selectedBookQRFilter || code.boekId === selectedBookQRFilter)
            .sort((a, b) => {
              const chapA = hoofdstukken.find(h => h.id === a.hoofdstukId);
              const chapB = hoofdstukken.find(h => h.id === b.hoofdstukId);
              if (chapA && chapB) {
                return (chapA.volgnummer || 0) - (chapB.volgnummer || 0);
              }
              const idA = a.hoofdstukId || '';
              const idB = b.hoofdstukId || '';
              return idA.localeCompare(idB);
            });

          return (
            <div className="space-y-6">
              {/* Filter section styled beautifully */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-earth-clay/5 border border-white/10 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-earth-gold w-6 h-6 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-serif text-white font-medium">Kies een boek om te filteren</h3>
                    <p className="text-earth-light/40 text-xs font-mono">Toont alleen de QR Code Redirects van het geselecteerde boek.</p>
                  </div>
                </div>
                <div className="w-full md:w-96">
                  <select
                    value={selectedBookQRFilter}
                    onChange={(e) => setSelectedBookQRFilter(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold cursor-pointer font-serif text-base"
                  >
                    <option value="" className="bg-[#141414]">-- Toon alle boeken --</option>
                    {boeken.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#141414]">
                        {b.boektitel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/5 text-earth-light/40 text-xs uppercase tracking-widest font-bold">
                        <th className="px-6 py-4">Boek</th>
                        <th className="px-6 py-4">QRCode</th>
                        <th className="px-6 py-4">Hoofdstuk</th>
                        <th className="px-6 py-4">Song / Artist</th>
                        <th className="px-6 py-4 text-center">Afbeelding</th>
                        <th className="px-6 py-4 text-center">Spotify</th>
                        <th className="px-6 py-4 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 mx-auto">
                      {sortedAndFilteredQRCodes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-earth-light/30">
                            Geen QR Code Redirects gevonden voor dit filter.
                          </td>
                        </tr>
                      ) : (
                        sortedAndFilteredQRCodes.map((code) => (
                          <tr key={code.id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-6 py-4 text-earth-light/80 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-earth-gold/70 opacity-60 shrink-0" />
                                <span>{code.boekTitel || '-'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="font-mono text-earth-gold font-bold">{code.id}</span>
                            </td>
                            <td className="px-6 py-4 text-earth-light/80 font-medium">
                              <span>{code.hoofdstuk}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-white font-medium flex items-center gap-2 flex-wrap">
                                  <Music className="w-4 h-4 opacity-40 shrink-0" />
                                  {code.song}
                                </span>
                                <span className="text-earth-light/40 text-xs flex items-center gap-2 pl-6">
                                  <User className="w-3 h-3 text-earth-gold/40" />
                                  {code.artist}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center items-center gap-2">
                                {code.qrImage ? (
                                  <>
                                    <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full font-semibold" title="Afbeelding aanwezig">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                      Ja
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!code.qrImage) return;
                                        const fileName = code.song?.trim() || code.id || 'qrcode';
                                        downloadDataUrlAsPng(code.qrImage, fileName);
                                      }}
                                      className="p-1.5 text-earth-light/50 hover:text-earth-gold border border-transparent hover:border-white/10 hover:bg-white/5 rounded-lg transition-all cursor-pointer"
                                      title={`Downloaden als "${(code.song?.trim() || code.id || 'qrcode')}.png"`}
                                    >
                                      <Download className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <span className="text-earth-light/20 text-xs font-mono">-</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center items-center">
                                <a 
                                  href={code.spotifyLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-10 h-10 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 border border-[#1DB954]/30 hover:border-[#1DB954] text-[#1DB954] rounded-full flex items-center justify-center transition-all duration-200 shadow-md hover:scale-110"
                                  title="Open Spotify Link"
                                >
                                  <Music className="w-5 h-5" />
                                </a>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  const qs = new URLSearchParams();
                                  if (code.id) qs.set('code', code.id);
                                  if (code.boekId) qs.set('boekId', code.boekId);
                                  window.open(`/beheer/qr-studio?${qs.toString()}`, '_blank', 'noopener,noreferrer');
                                }}
                                className="p-2 text-earth-light/50 hover:text-earth-gold inline-block align-middle transition-colors"
                                title="Open in QR-code Studio (hoge resolutie PNG/SVG/PDF)"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingQRCode(code);
                                  setQrImageOrigin(code.qrImage ? 'existing' : 'none');
                                  setNewItem({
                                    ...code,
                                    qrImage: code.qrImage || ''
                                  });
                                  setUploadError(null);
                                  setUploadSuccess(null);
                                  setIsAdding(true);
                                }}
                                className="bg-white/5 border border-white/10 hover:border-earth-gold hover:bg-earth-gold hover:text-black hover:scale-105 transition-all text-white text-xs px-3 py-1.5 rounded-full font-bold inline-block align-middle"
                              >
                                Bewerken
                              </button>
                              <button 
                                onClick={() => handleDelete(code.id)}
                                className="p-2 text-earth-light/20 hover:text-red-400 inline-block align-middle transition-colors"
                                title="Verwijderen"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 2: Boeken */}
        {activeTab === 'boeken' && !loading && (
          <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-white/5 text-earth-light/40 text-xs uppercase tracking-widest font-bold">
                    <th className="px-6 py-4 w-28">Volgnummer</th>
                    <th className="px-6 py-4">Boektitel</th>
                    <th className="px-6 py-4">QR Midden-Logo</th>
                    <th className="px-6 py-4 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {boeken.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-earth-light/30">
                        Geen boeken gevonden. Klik op "Nieuw Boek" om er een aan te maken.
                      </td>
                    </tr>
                  ) : (
                    boeken.map((b) => (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-mono text-earth-gold font-bold">
                          {b.volgnummer}
                        </td>
                        <td className="px-6 py-4 text-white font-medium">
                          {b.boektitel}
                        </td>
                        <td className="px-6 py-4">
                          {b.qrLogo ? (
                            <div className="flex items-center gap-2.5">
                              <img
                                src={b.qrLogo}
                                alt={`QR logo ${b.boektitel}`}
                                className="w-9 h-9 object-contain bg-white rounded-md p-0.5 border border-white/20"
                              />
                              <span className="text-xs text-emerald-400 font-medium">Ingesteld</span>
                            </div>
                          ) : (
                            <span className="text-xs text-earth-light/35 italic">Geen logo</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setEditingBoek(b);
                              setNewBoek({ volgnummer: b.volgnummer, boektitel: b.boektitel, qrLogo: b.qrLogo || '' });
                              setIsAddingBoek(true);
                            }}
                            className="bg-white/5 border border-white/10 hover:border-earth-gold hover:bg-earth-gold hover:text-black hover:scale-105 transition-all text-white text-xs px-3 py-1.5 rounded-full font-bold"
                          >
                            Bewerken
                          </button>
                          <button
                            onClick={() => handleDeleteBoek(b.id, b.boektitel)}
                            className="p-2 text-earth-light/20 hover:text-red-400 transition-colors"
                            title="Verwijderen"
                          >
                            <Trash2 className="w-5 h-5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Hoofdstukken */}
        {activeTab === 'hoofdstukken' && !loading && (() => {
          // Sort and filter chapters by the selected book filter, and by volgnummer
          const sortedAndFilteredChapters = [...hoofdstukken]
            .filter((h) => !selectedBookChapterFilter || h.boekId === selectedBookChapterFilter)
            .sort((a, b) => (a.volgnummer || 0) - (b.volgnummer || 0));

          return (
            <div className="space-y-6">
              {/* Filter section styled beautifully */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-earth-clay/5 border border-white/10 p-6 rounded-2xl shadow-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-earth-gold w-6 h-6 animate-pulse" />
                  <div>
                    <h3 className="text-lg font-serif text-white font-medium">Kies een boek om te filteren</h3>
                    <p className="text-earth-light/40 text-xs font-mono">Toont alleen de hoofdstukken van het geselecteerde boek.</p>
                  </div>
                </div>
                <div className="w-full md:w-96">
                  <select
                    value={selectedBookChapterFilter}
                    onChange={(e) => setSelectedBookChapterFilter(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold cursor-pointer font-serif text-base"
                  >
                    <option value="" className="bg-[#141414]">-- Toon alle boeken --</option>
                    {boeken.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#141414]">
                        {b.boektitel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/5 text-earth-light/40 text-xs uppercase tracking-widest font-bold">
                        <th className="px-6 py-4">Boek</th>
                        <th className="px-6 py-4 w-28">Volgnummer</th>
                        <th className="px-6 py-4">Hoofdstuk Omschrijving</th>
                        <th className="px-6 py-4 text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {sortedAndFilteredChapters.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-earth-light/30">
                            Geen hoofdstukken gevonden voor dit filter.
                          </td>
                        </tr>
                      ) : (
                        sortedAndFilteredChapters.map((h) => {
                          const associatedBook = boeken.find(b => b.id === h.boekId);
                          return (
                            <tr key={h.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-6 py-4 text-earth-light/60 font-medium">
                                {associatedBook ? associatedBook.boektitel : 'Onbekend Boek'}
                              </td>
                              <td className="px-6 py-4 font-mono text-earth-gold font-bold">
                                {h.volgnummer}
                              </td>
                              <td className="px-6 py-4 text-white font-medium">
                                {h.omschrijving}
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingHoofdstuk(h);
                                    setNewHoofdstuk({ boekId: h.boekId, volgnummer: h.volgnummer, omschrijving: h.omschrijving });
                                    setIsAddingHoofdstuk(true);
                                  }}
                                  className="bg-white/5 border border-white/10 hover:border-earth-gold hover:bg-earth-gold hover:text-black hover:scale-105 transition-all text-white text-xs px-3 py-1.5 rounded-full font-bold"
                                >
                                  Bewerken
                                </button>
                                <button
                                  onClick={() => handleDeleteHoofdstuk(h.id, h.omschrijving)}
                                  className="p-2 text-earth-light/20 hover:text-red-400 transition-colors"
                                  title="Verwijderen"
                                >
                                  <Trash2 className="w-5 h-5 inline" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* TAB 4: Subscribers */}
        {activeTab === 'subscribers' && !loading && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-earth-clay/5 border border-white/10 p-6 rounded-2xl shadow-lg">
              <div className="flex items-center gap-3">
                <Mail className="text-earth-gold w-6 h-6 animate-pulse" />
                <div>
                  <h3 className="text-lg font-serif text-white font-medium">Nieuwsbrief Abonnees</h3>
                  <p className="text-earth-light/40 text-xs font-mono">
                    Een overzicht van alle bezoekers die zich hebben ingeschreven voor de nieuwsbrief.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-white/5 text-earth-light/40 text-xs uppercase tracking-widest font-bold">
                      <th className="px-6 py-4">Voornaam</th>
                      <th className="px-6 py-4">E-mailadres</th>
                      <th className="px-6 py-4">Aangemeld op</th>
                      <th className="px-6 py-4 text-right">Acties</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {subscribers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-earth-light/30">
                          Er zijn nog geen nieuwsbrief abonnees geregistreerd.
                        </td>
                      </tr>
                    ) : (
                      subscribers.map((sub) => (
                        <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 text-white font-medium">
                            {sub.firstName || <span className="text-earth-light/20 italic">Niet opgegeven</span>}
                          </td>
                          <td className="px-6 py-4 font-mono text-earth-gold font-bold">
                            {sub.email}
                          </td>
                          <td className="px-6 py-4 text-earth-light/60">
                            {sub.subscribedAt ? formatDutchDateTime(sub.subscribedAt, {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : <span className="text-earth-light/20 italic">Onbekend</span>}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteSubscriber(sub.id, sub.email)}
                              className="p-2 text-earth-light/40 hover:text-red-400 transition-colors"
                              title="Verwijderen"
                            >
                              <Trash2 className="w-5 h-5 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && !loading && (() => {
          // Calculate cumulative metrics (historic + active live sessions)
          const mergedDailyStats = [...historicalStats].map(h => ({
            date: h.date || h.id,
            Sessions: h.totalSessions || 0,
            PageViews: h.totalPageViews || 0
          }));

          // Merge live sessions into daily trends
          const liveGrouped: Record<string, { sessions: number; views: number }> = {};
          visitorSessions.forEach(s => {
            const dateStr = (s.startedAt || '').split('T')[0];
            if (dateStr) {
               if (!liveGrouped[dateStr]) liveGrouped[dateStr] = { sessions: 0, views: 0 };
               liveGrouped[dateStr].sessions += 1;
               liveGrouped[dateStr].views += (s.pages || []).length;
            }
          });

          Object.entries(liveGrouped).forEach(([date, counts]) => {
            const existing = mergedDailyStats.find(m => m.date === date);
            if (existing) {
              existing.Sessions += counts.sessions;
              existing.PageViews += counts.views;
            } else {
              mergedDailyStats.push({ date, Sessions: counts.sessions, PageViews: counts.views });
            }
          });
          mergedDailyStats.sort((a, b) => a.date.localeCompare(b.date));

          // 1. Total Session Count (archived + live)
          const totalSessionsCount = visitorSessions.length + historicalStats.reduce((sum, h) => sum + (h.totalSessions || 0), 0);
          
          // 2. Total Page Views Count (archived + live)
          const totalPageViewsCount = visitorSessions.reduce((sum, s) => sum + (s.pages || []).length, 0) + historicalStats.reduce((sum, h) => sum + (h.totalPageViews || 0), 0);
          
          // 3. Average session stay duration in seconds (archived + live)
          const totalLoggedDuration = visitorSessions.reduce((sum, s) => sum + (s.durationSeconds || 0), 0) + historicalStats.reduce((sum, h) => sum + ((h.avgSessionDuration || 0) * (h.totalSessions || 0)), 0);
          const calculatedAvgDuration = totalSessionsCount > 0 ? Math.round(totalLoggedDuration / totalSessionsCount) : 0;

          // Helper format stay duration
          const formatDurationText = (sec: number) => {
            if (sec < 60) return `${sec}s`;
            const m = Math.floor(sec / 60);
            const s = sec % 60;
            return `${m}m ${s}s`;
          };

          // 4. Grouped Locations (City)
          const cityCountsMap: Record<string, number> = {};
          visitorSessions.forEach(s => { cityCountsMap[s.city || 'Onbekend'] = (cityCountsMap[s.city || 'Onbekend'] || 0) + 1; });
          historicalStats.forEach(h => {
            if (h.cityCounts) {
              Object.entries(h.cityCounts).forEach(([city, val]) => {
                const cleanC = city.replace(/_/g, '.');
                cityCountsMap[cleanC] = (cityCountsMap[cleanC] || 0) + (val as number);
              });
            }
          });
          const sortedCities = Object.entries(cityCountsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 8);

          // 5. Grouped Device Types
          const deviceCountsMap: Record<string, number> = {};
          visitorSessions.forEach(s => { deviceCountsMap[s.deviceType || 'Onbekend'] = (deviceCountsMap[s.deviceType || 'Onbekend'] || 0) + 1; });
          historicalStats.forEach(h => {
             if (h.deviceTypeCounts) {
               Object.entries(h.deviceTypeCounts).forEach(([dev, val]) => {
                 deviceCountsMap[dev] = (deviceCountsMap[dev] || 0) + (val as number);
               });
             }
          });
          const sortedDevices = Object.entries(deviceCountsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

          // 6. Grouped Referrers
          const referrerCountsMap: Record<string, number> = {};
          visitorSessions.forEach(s => { referrerCountsMap[s.referrer || 'Direct / Bladwijzer'] = (referrerCountsMap[s.referrer || 'Direct / Bladwijzer'] || 0) + 1; });
          historicalStats.forEach(h => {
             if (h.referrerCounts) {
               Object.entries(h.referrerCounts).forEach(([ref, val]) => {
                 const cleanR = ref.replace(/_/g, '.');
                 referrerCountsMap[cleanR] = (referrerCountsMap[cleanR] || 0) + (val as number);
               });
             }
          });
          const sortedReferrers = Object.entries(referrerCountsMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 8);

          // 7. Pages stay stats
          const pathCountsMap: Record<string, { views: number; totalDuration: number }> = {};
          visitorSessions.forEach(s => {
             const pages = s.pages || [];
             pages.forEach((p: any) => {
               const path = p.path || '/';
               if (!pathCountsMap[path]) pathCountsMap[path] = { views: 0, totalDuration: 0 };
               pathCountsMap[path].views += 1;
               pathCountsMap[path].totalDuration += (p.durationSeconds || 0);
             });
          });
          historicalStats.forEach(h => {
             if (h.pageviewCounts) {
               Object.entries(h.pageviewCounts).forEach(([path, val]) => {
                 const cleanP = path.replace(/_/g, '.');
                 if (!pathCountsMap[cleanP]) pathCountsMap[cleanP] = { views: 0, totalDuration: 0 };
                 pathCountsMap[cleanP].views += (val as number);
               });
             }
          });
          const sortedPages = Object.entries(pathCountsMap)
            .map(([path, info]) => ({
              path,
              views: info.views,
              avgStay: info.views > 0 ? Math.round(info.totalDuration / info.views) : 0
            }))
            .sort((a, b) => b.views - a.views)
            .slice(0, 8);

          // 8. Element/Button Clicks List
          const clickCountsMap: Record<string, number> = {};
          visitorSessions.forEach(s => {
             const clicks = s.clicks || [];
             clicks.forEach((c: any) => {
               const label = c.elementText || c.elementId || 'Klik';
               clickCountsMap[label] = (clickCountsMap[label] || 0) + 1;
             });
          });
          historicalStats.forEach(h => {
             if (h.clicksCount) {
                Object.entries(h.clicksCount).forEach(([label, val]) => {
                  const cleanL = label.replace(/_/g, '.');
                  clickCountsMap[cleanL] = (clickCountsMap[cleanL] || 0) + (val as number);
                });
             }
          });
          const sortedClicks = Object.entries(clickCountsMap)
            .map(([label, count]) => ({ label, count }))
            .sort((a,b) => b.count - a.count)
            .slice(0, 10);

          // Computed variables for maximum lengths inside graphical percentage structures
          const maxCity = sortedCities.length > 0 ? sortedCities[0].count : 1;
          const maxReferrer = sortedReferrers.length > 0 ? sortedReferrers[0].count : 1;
          const maxPage = sortedPages.length > 0 ? sortedPages[0].views : 1;
          const maxClick = sortedClicks.length > 0 ? sortedClicks[0].count : 1;

          // Compute scans metrics
          const scansUniqueCities = new Set(filteredScans.map(s => s.city).filter(c => c && c !== 'Onbekend')).size;

          const topScannedQR = [...filteredScans].reduce((acc, curr) => {
            if (!curr.redirectCode) return acc;
            acc[curr.redirectCode] = (acc[curr.redirectCode] || 0) + 1;
            return acc;
          }, {} as { [code: string]: number });
          
          let topQrText = '-';
          let maxScans = 0;
          Object.entries(topScannedQR).forEach(([code, count]) => {
            const countNum = count as number;
            if (countNum > maxScans) {
              maxScans = countNum;
              topQrText = `${code} (${countNum}x)`;
            }
          });

          return (
            <div className="space-y-8 animate-pulse-once">
              
              {/* Analytics Sub-tabs Toggle */}
              <div className="flex border-b border-white/5 pb-4 gap-2 overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setAnalyticsSubTab('scans')}
                  className={cn(
                    "pb-2 px-4 text-sm font-medium border-b-2 transition-colors duration-250 flex items-center gap-2 whitespace-nowrap cursor-pointer",
                    analyticsSubTab === 'scans'
                      ? "border-earth-gold text-white font-semibold"
                      : "border-transparent text-earth-light/40 hover:text-earth-light/80"
                  )}
                >
                  <Compass className="w-4 h-4" />
                  Boek QR Scans &amp; Clicks ({scans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAnalyticsSubTab('web')}
                  className={cn(
                    "pb-2 px-4 text-sm font-medium border-b-2 transition-colors duration-250 flex items-center gap-2 whitespace-nowrap cursor-pointer",
                    analyticsSubTab === 'web'
                      ? "border-earth-gold text-white font-semibold"
                      : "border-transparent text-earth-light/40 hover:text-earth-light/80"
                  )}
                >
                  <BarChart3 className="w-4 h-4" />
                  Website Bezoekers &amp; Activiteit
                </button>
              </div>

              {analyticsSubTab === 'scans' ? (
                <div className="space-y-6">
                  {/* Header block with filter controls and deletion capabilities */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-earth-clay/5 border border-white/10 p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3">
                      <Compass className="text-earth-gold w-6 h-6 animate-pulse shrink-0" />
                      <div>
                        <h3 className="text-lg font-serif text-white font-medium">QR Code Boekscans</h3>
                        <p className="text-earth-light/40 text-xs font-mono">
                          Direct inzicht in de QRCodes die gelezen zijn uit de fysieke boeken.
                        </p>
                      </div>
                    </div>
                    
                    {/* Book selection filters & actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-full px-4.5 py-1.5">
                        <span className="text-earth-light/40 text-xs font-bold uppercase tracking-wider font-mono">Boek:</span>
                        <select
                          value={selectedBookAnalyticsFilter}
                          onChange={(e) => setSelectedBookAnalyticsFilter(e.target.value)}
                          className="bg-transparent border-none text-white focus:outline-none text-xs font-semibold cursor-pointer py-0.5"
                        >
                          <option value="" className="bg-[#121212] text-white">-- Alle boeken --</option>
                          {boeken.map((b) => (
                            <option key={b.id} value={b.id} className="bg-[#121212] text-white">{b.boektitel}</option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsScanMapOpen(true)}
                        className="bg-earth-gold hover:bg-yellow-600 text-black border border-earth-gold/20 hover:border-earth-gold transition-all text-xs font-bold px-4.5 py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-earth-gold/10 hover:shadow-earth-gold/20"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Toon op Kaart
                      </button>
                      
                      <button
                        type="button"
                        disabled={filteredScans.length === 0 || loading}
                        onClick={async () => {
                          const bookTitle = selectedBookAnalyticsFilter 
                            ? boeken.find((b) => String(b.id) === String(selectedBookAnalyticsFilter))?.boektitel || 'het geselecteerde boek'
                            : 'alle boeken';
                          
                          const confirmMsg = selectedBookAnalyticsFilter
                            ? `Weet je zeker dat je alle ${filteredScans.length} scan logs van het boek "${bookTitle}" wilt opschonen? Dit kan niet ongedaan gemaakt worden.`
                            : `Weet je zeker dat je alle ${scans.length} scan logs van ALLE boeken wilt opschonen? Dit kan niet ongedaan gemaakt worden.`;

                          if (window.confirm(confirmMsg)) {
                            try {
                              setLoading(true);
                              await clearAllScansOrFirestore(selectedBookAnalyticsFilter || undefined);
                              await fetchAllData();
                              alert(`Succesvol alle scan logs van ${selectedBookAnalyticsFilter ? `boek "${bookTitle}"` : 'alle boeken'} verwijderd!`);
                            } catch (err) {
                              setError('Interne fout bij opschonen.');
                            } finally {
                              setLoading(false);
                            }
                          }
                        }}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-all text-xs font-bold px-4.5 py-2.5 rounded-full inline-flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Wis Historie
                      </button>
                    </div>
                  </div>

                  {/* Statistics metric overview cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Compass className="w-16 h-16 text-white" />
                      </div>
                      <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Totaal Aantal Scans</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif text-earth-gold font-bold">{filteredScans.length}</span>
                        <span className="text-white/30 text-xs font-mono">scans</span>
                      </div>
                      <p className="text-[10px] text-earth-light/35">Binnen geselecteerde filterbereik</p>
                    </div>

                    <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <MapPin className="w-16 h-16 text-white" />
                      </div>
                      <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Unieke Scanlocaties</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-serif text-white font-bold">{scansUniqueCities}</span>
                        <span className="text-white/30 text-xs font-mono">steden</span>
                      </div>
                      <p className="text-[10px] text-earth-light/35">Gedetecteerd via geo-IP lookup</p>
                    </div>

                    <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                      <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Sparkles className="w-16 h-16 text-white" />
                      </div>
                      <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Meest Gescannd</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-serif text-earth-gold font-bold truncate block max-w-full">{topQrText}</span>
                      </div>
                      <p className="text-[10px] text-earth-light/35">Meest active QR-code redirect</p>
                    </div>
                  </div>

                  {/* Interactive Trend Line Chart using Recharts */}
                  <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-xl space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-earth-light/60 uppercase tracking-widest font-mono">Scan trend over de tijd</h4>
                      <p className="text-earth-light/40 text-[11px] mt-0.5">Chronologische scanfrequentie per kalenderdag</p>
                    </div>

                    {aggregatedData.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl text-earth-light/20 text-xs font-mono">
                        Geen statistieken beschikbaar voor deze selectie.
                      </div>
                    ) : (
                      <div className="h-56 sm:h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={aggregatedData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#d4af37" stopOpacity={0.35}/>
                                <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis 
                              dataKey="date" 
                              stroke="rgba(255,255,255,0.3)" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              dy={10}
                            />
                            <YAxis 
                              stroke="rgba(255,255,255,0.3)" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#161616', 
                                borderColor: 'rgba(255,255,255,0.1)', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)' 
                              }} 
                              labelStyle={{ color: '#d4af37', fontWeight: 'bold', fontFamily: 'serif', fontSize: '12px' }}
                              itemStyle={{ color: '#ffffff', fontSize: '11px', fontFamily: 'monospace' }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="Scans" 
                              name="Scans"
                              stroke="#d4af37" 
                              strokeWidth={2} 
                              fillOpacity={1} 
                              fill="url(#colorScans)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Grid with list details */}
                  <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left">
                        <thead>
                          <tr className="bg-white/5 text-earth-light/40 text-[10px] uppercase tracking-widest font-bold">
                            <th className="px-6 py-4">QR Code</th>
                            <th className="px-6 py-4">Gekoppeld Fragment</th>
                            <th className="px-6 py-4">Locatie (Stad)</th>
                            <th className="px-6 py-4">Apparaat / Telefoon</th>
                            <th className="px-6 py-4">Tijdstip</th>
                            <th className="px-6 py-4 text-center">Actie</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-xs">
                          {filteredScans.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-earth-light/30 text-xs italic font-mono">
                                Geen scan logs gevonden voor dit filter. Deel uw QR-codes om scans uit te lokken!
                              </td>
                            </tr>
                          ) : (
                            filteredScans.map((scan) => (
                              <tr key={scan.id} className="hover:bg-white/[0.02] transition-colors">
                                <td className="px-6 py-4">
                                  <span className="font-mono text-earth-gold font-bold bg-earth-gold/10 px-2.5 py-1 rounded text-[11px] border border-earth-gold/25 block w-max">
                                    {scan.redirectCode}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div>
                                    <div className="text-white text-xs font-serif font-bold leading-normal">
                                      {scan.chapter || 'Onbekend Hoofdstuk'}
                                    </div>
                                    <div className="text-earth-light/45 text-[10px] leading-snug">
                                      {scan.bookTitle ? `${scan.bookTitle} | ` : ''}{scan.song} ({scan.artist})
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-white">
                                  📍 {scan.city || 'Onbekend'}{scan.country && scan.country !== 'Onbekend' ? `, ${scan.country}` : ''}
                                </td>
                                <td className="px-6 py-4 text-xs text-earth-light/60 font-mono font-medium">
                                  📳 {scan.deviceType || 'Onbekend'}
                                </td>
                                <td className="px-6 py-4 text-xs text-earth-light/60 font-mono">
                                  🕒 {scan.timestamp ? formatDutchDateTime(scan.timestamp, {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit'
                                  }) : 'Onbekend'}
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={async () => {
                                      const confirmMsg = `Weet je zeker dat je deze scan registratie wilt verwijderen?\n\nCode: ${scan.redirectCode}\nHoofdstuk: ${scan.chapter || 'Onbekend'}\nLied: ${scan.song || 'Onbekend'} (${scan.artist || 'Onbekend'})`;
                                      if (window.confirm(confirmMsg)) {
                                        try {
                                          setLoading(true);
                                          await deleteDocOrFirestore(`/api/scans/${encodeURIComponent(scan.id)}`, 'qr_scans', scan.id);
                                          await fetchAllData();
                                        } catch (err) {
                                          setError('Fout bij het verwijderen van de scan.');
                                        } finally {
                                          setLoading(false);
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-red-400/60 hover:text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-500/10 hover:border-red-500/20 rounded-full transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Verwijder deze scan registratie"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* SECTION A: Dashboard Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <User className="w-16 h-16 text-white" />
                  </div>
                  <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Unieke Sessies</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-earth-gold font-bold">{totalSessionsCount}</span>
                    <span className="text-white/30 text-xs font-mono">bezoeken</span>
                  </div>
                  <p className="text-[10px] text-earth-light/35 flex items-center gap-1">
                    <span className="inline-block w-2-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {visitorSessions.length} Actieve Live logs gereserveerd
                  </p>
                </div>

                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Eye className="w-16 h-16 text-white" />
                  </div>
                  <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Totaal Paginaweergaven</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-white font-bold">{totalPageViewsCount}</span>
                    <span className="text-white/30 text-xs font-mono">views</span>
                  </div>
                  <p className="text-[10px] text-earth-light/35">Zowel historische als actuele paginajournals</p>
                </div>

                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Clock className="w-16 h-16 text-white" />
                  </div>
                  <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Gem. Bezoekduur</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-earth-gold font-bold">{formatDurationText(calculatedAvgDuration)}</span>
                  </div>
                  <p className="text-[10px] text-earth-light/35">Gemiddelde leestijd per unieke sessie</p>
                </div>

                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl flex flex-col justify-between space-y-2 relative overflow-hidden group">
                  <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Compass className="w-16 h-16 text-white" />
                  </div>
                  <span className="text-earth-light/40 text-[10px] uppercase font-bold tracking-widest font-mono">Geregistreerde QR Scans</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-serif text-white font-bold">{scans.length}</span>
                    <span className="text-white/30 text-xs font-mono">scans</span>
                  </div>
                  <p className="text-[10px] text-earth-light/35">Directe redirects naar Spotify-app</p>
                </div>
              </div>

              {/* SECTION B: Combined Trends Chart */}
              <div className="bg-earth-clay/5 border border-white/10 p-6 rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-earth-light/60 uppercase tracking-widest font-mono">Bezoekers &amp; Interactie Trends</h4>
                    <p className="text-earth-light/40 text-[11px] mt-0.5">Sessies en navigatietrajecten over de tijd heen</p>
                  </div>
                  
                  {/* Legend indicator */}
                  <div className="flex items-center gap-4 text-[10px] font-mono font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5 text-earth-gold">
                      <span className="w-3 h-3 bg-earth-gold/25 border border-earth-gold rounded" />
                      Bezoeken (Sessies)
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-3 h-3 bg-blue-400/25 border border-blue-400 rounded" />
                      Paginaweergaven
                    </div>
                  </div>
                </div>

                {mergedDailyStats.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center border border-dashed border-white/5 rounded-xl text-earth-light/20 text-xs font-mono">
                    <BarChart3 className="w-5 h-5 opacity-40 mb-2 animate-bounce" />
                    Nog geen trendgegevens beschikbaar. Bezoek de website om de eerste trendlijn te tekenen!
                  </div>
                ) : (
                  <div className="h-60 sm:h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedDailyStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#d4af37" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#d4af37" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis 
                          dataKey="date" 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          stroke="rgba(255,255,255,0.3)" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          allowDecimals={false}
                          dx={-5}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#161616', 
                            borderColor: 'rgba(255,255,255,0.1)', 
                            borderRadius: '12px', 
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)' 
                          }} 
                          labelStyle={{ color: '#d4af37', fontWeight: 'bold', fontFamily: 'serif', fontSize: '11px' }}
                          itemStyle={{ color: '#ffffff', fontSize: '11px', fontFamily: 'monospace' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="Sessions" 
                          name="Sessies (Bezoeken)"
                          stroke="#d4af37" 
                          strokeWidth={2} 
                          fillOpacity={1} 
                          fill="url(#colorSessions)" 
                        />
                        <Area 
                          type="monotone" 
                          dataKey="PageViews" 
                          name="Paginaweergaven"
                          stroke="#60a5fa" 
                          strokeWidth={1.5} 
                          fillOpacity={1} 
                          fill="url(#colorPageviews)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* SECTION C: Referrers, Geolocation, Devices Splits */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Referrer Traffic sources */}
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <Compass className="w-4 h-4 text-earth-gold" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Herkomst (Referrers)</h5>
                  </div>
                  {sortedReferrers.length === 0 ? (
                    <div className="text-center py-12 text-xs text-earth-light/20 italic">Geen bronnen gedetecteerd.</div>
                  ) : (
                    <div className="space-y-3.5">
                      {sortedReferrers.map(ref => (
                        <div key={ref.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium truncate max-w-[200px]" title={ref.name}>{ref.name}</span>
                            <span className="text-earth-light/50 font-mono text-[11px]">{ref.count} bezoeken</span>
                          </div>
                          <div className="w-full bg-white/[0.03] rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-earth-gold h-full rounded-full transition-all duration-700" 
                              style={{ width: `${(ref.count / maxReferrer) * 100}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Geolocation (Cities) */}
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-earth-gold" />
                      <h5 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Bezoekerslocaties (Stad)</h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsVisitorMapOpen(true)}
                      className="bg-earth-gold/15 hover:bg-earth-gold hover:text-black text-earth-gold border border-earth-gold/25 transition-all text-[10px] font-bold px-3 py-1.5 rounded-full inline-flex items-center justify-center gap-1 cursor-pointer transition-all duration-200"
                      title="Bekijk de actieve bezoekerslocaties op een interactieve landkaart"
                    >
                      <MapPin className="w-3 h-3" />
                      Kaart
                    </button>
                  </div>
                  {sortedCities.length === 0 ? (
                    <div className="text-center py-12 text-xs text-earth-light/20 italic">Geen locaties gevonden.</div>
                  ) : (
                    <div className="space-y-3.5">
                      {sortedCities.map(city => (
                        <div key={city.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium">📍 {city.name}</span>
                            <span className="text-earth-light/50 font-mono text-[11px]">{city.count} keer</span>
                          </div>
                          <div className="w-full bg-white/[0.03] rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-earth-clay/60 h-full rounded-full transition-all duration-700" 
                              style={{ width: `${(city.count / maxCity) * 100}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. Devices Breakdown */}
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <Smartphone className="w-4 h-4 text-earth-gold" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Apparaten &amp; OS</h5>
                  </div>
                  {sortedDevices.length === 0 ? (
                    <div className="text-center py-12 text-xs text-earth-light/20 italic">Geen toestellen gelogd.</div>
                  ) : (
                    <div className="space-y-3.5">
                      {sortedDevices.map(device => (
                        <div key={device.name} className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium">📱 {device.name}</span>
                            <span className="text-earth-gold font-mono text-[11px]">{device.count}</span>
                          </div>
                          <div className="w-full bg-white/[0.03] border border-white/5 rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-earth-gold to-yellow-600 h-full rounded-full transition-all duration-700" 
                              style={{ width: `${(device.count / totalSessionsCount) * 100}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION D: Pages stays and Click triggers */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Page Stays views & average reading duration */}
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <BookOpen className="w-4 h-4 text-earth-gold" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Meest Bezochte Pagina's</h5>
                  </div>
                  {sortedPages.length === 0 ? (
                    <div className="text-center py-12 text-xs text-earth-light/20 italic">Geen pagina navigaties gearchiveerd.</div>
                  ) : (
                    <div className="space-y-3">
                      {sortedPages.map(p => (
                        <div key={p.path} className="flex items-center justify-between hover:bg-white/[0.01] p-1.5 rounded transition-all">
                          <div className="flex flex-col">
                            <span className="text-white font-mono text-xs leading-normal font-medium">{p.path}</span>
                            <span className="text-[10px] text-earth-light/40 font-bold uppercase tracking-wider font-mono">
                              Leestijd: {formatDurationText(p.avgStay)}
                            </span>
                          </div>
                          <div className="flex items-baseline gap-2 shrink-0">
                            <span className="text-sm font-serif text-earth-gold font-bold">{p.views}</span>
                            <span className="text-[10px] text-earth-light/35 font-mono">keer</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Button & Control Clicks tracker */}
                <div className="bg-earth-clay/5 border border-white/10 p-5 rounded-2xl shadow-lg space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                    <MousePointerClick className="w-4 h-4 text-earth-gold" />
                    <h5 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Populaire Knopklikken</h5>
                  </div>
                  {sortedClicks.length === 0 ? (
                    <div className="text-center py-12 text-xs text-earth-light/20 italic">Wacht op live interacties.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {sortedClicks.map(click => (
                        <div key={click.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white font-medium truncate max-w-[280px]" title={click.label}>
                              🖱️ <span className="italic">"{click.label}"</span>
                            </span>
                            <span className="text-earth-light/50 font-mono text-[11px] shrink-0">{click.count}x</span>
                          </div>
                          <div className="w-full bg-white/[0.02] rounded-full h-1 overflow-hidden">
                            <div 
                              className="bg-emerald-400 h-full rounded-full transition-all duration-700 shadow-[0_0_4px_rgba(52,211,153,0.5)]" 
                              style={{ width: `${(click.count / maxClick) * 100}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

              {/* SECTION E: Detailed active live sessions table log */}
              <div className="bg-earth-clay/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest font-mono">Actuele Bezoekerssessies</h4>
                    <p className="text-earth-light/40 text-[11px] mt-0.5">Lijst van recente website bezoeken en actieve parcoursen</p>
                  </div>
                  
                  <div className="text-xs text-earth-light/50 font-mono flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {visitorSessions.length} sessies gelogd
                  </div>
                </div>

                <div className="overflow-x-auto border border-white/5 rounded-xl">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="bg-white/5 text-earth-light/40 text-[10px] uppercase tracking-widest font-bold">
                        <th className="px-5 py-3.5">Bezoeker &amp; Land</th>
                        <th className="px-5 py-3.5">Herkomst</th>
                        <th className="px-5 py-3.5">Toestel</th>
                        <th className="px-5 py-3.5">Pagina's Bezocht</th>
                        <th className="px-5 py-3.5">Duur</th>
                        <th className="px-5 py-3.5">Tijdstip</th>
                        <th className="px-5 py-3.5 text-center">Interactie</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-xs">
                      {visitorSessions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-earth-light/20 font-mono italic">
                            Er zijn op dit moment geen gedetailleerde actieve sessielogs in de database.
                          </td>
                        </tr>
                      ) : (
                        visitorSessions.map((session) => {
                          const traversed = session.pages || [];
                          const clicksCount = (session.clicks || []).length;
                          return (
                            <tr key={session.id} className="hover:bg-white/[0.01] transition-colors">
                              <td className="px-5 py-3.5">
                                <div>
                                  <div className="text-white font-medium">📍 {session.city || 'Onbekend'}</div>
                                  <div className="text-[10px] text-earth-light/35 font-mono">{session.country || 'Onbekend'}</div>
                                </div>
                              </td>
                              <td className="px-5 py-3.5 text-earth-light/80">
                                <span className="truncate block max-w-[120px]" title={session.referrer}>
                                  🔗 {session.referrer || 'Direct'}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 font-mono text-earth-light/60 text-[10px]">
                                📳 {session.deviceType || 'Bureaublad'}
                              </td>
                              <td className="px-5 py-3.5">
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {traversed.slice(0, 3).map((p: any, idx: number) => (
                                    <span key={idx} className="bg-white/5 text-earth-light/60 border border-white/5 px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap">
                                      {p.path}
                                    </span>
                                  ))}
                                  {traversed.length > 3 && (
                                    <span className="bg-white/5 text-earth-gold border border-white/5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
                                      +{traversed.length - 3} meer
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-3.5 font-mono font-semibold text-earth-gold">
                                ⏱️ {formatDurationText(session.durationSeconds || 0)}
                              </td>
                              <td className="px-5 py-3.5 text-earth-light/50 font-mono text-[10px]">
                                {session.startedAt ? formatDutchDateTime(session.startedAt, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Onbekend'}
                              </td>
                              <td className="px-5 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSessionDetail(session)}
                                    className="bg-earth-gold/10 hover:bg-earth-gold text-earth-gold hover:text-black border border-earth-gold/20 hover:border-earth-gold text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Pad ({clicksCount} klik)
                                  </button>
                                  <button
                                    type="button"
                                    disabled={loading}
                                    onClick={async () => {
                                      const confirmMsg = `Weet je zeker dat je deze actieve bezoekerssessie wilt verwijderen?\n\nStad: ${session.city || 'Onbekend'} (${session.country || 'Onbekend'})\nDuur: ${formatDurationText(session.durationSeconds || 0)}`;
                                      if (window.confirm(confirmMsg)) {
                                        try {
                                          setLoading(true);
                                          await deleteDocOrFirestore(`/api/analytics/session/${encodeURIComponent(session.id)}`, 'visitor_sessions', session.id);
                                          await fetchAllData();
                                        } catch (err) {
                                          setError('Fout bij het verwijderen van de sessie.');
                                        } finally {
                                          setLoading(false);
                                        }
                                      }
                                    }}
                                    className="p-1.5 text-red-400/60 hover:text-red-400 bg-red-400/5 hover:bg-red-400/10 border border-red-500/10 hover:border-red-500/20 rounded-full transition-all cursor-pointer inline-flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Verwijder deze actieve sessie"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION F: Database Purging / Retentions Cleanup Panel */}
              <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Database className="w-32 h-32 text-red-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Database className="text-red-400 w-5 h-5 animate-pulse shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-white">Database Opschonen &amp; Archivering</h4>
                      <p className="text-earth-light/40 text-xs leading-relaxed max-w-2xl">
                        Voorkom onnodige database-groei. Converteer en consolideer oudere gedetailleerde bezoekerslogs automatische in handige dagelijkse summaries en ruim individuele journals duurzaam op.
                      </p>
                    </div>
                  </div>

                  {purgeSuccess && (
                     <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-lg text-xs leading-normal font-semibold">
                       ✨ {purgeSuccess}
                     </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-4 py-2 text-xs text-white">
                      <span className="text-white/40 font-mono font-bold uppercase tracking-wider text-[10px]">Bewaartermijn:</span>
                      <select
                        value={retentionDaysValue}
                        onChange={(e) => setRetentionDaysValue(e.target.value)}
                        className="bg-transparent border-none focus:outline-none font-semibold text-white pr-2 cursor-pointer"
                      >
                        <option value="7" className="bg-[#121212] text-white">Ouder dan 7 dagen</option>
                        <option value="14" className="bg-[#121212] text-white">Ouder dan 14 dagen</option>
                        <option value="30" className="bg-[#121212] text-white">Ouder dan 30 dagen</option>
                        <option value="0" className="bg-[#121212] text-white">Consolideer alle actieve logs</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={purging || visitorSessions.length === 0}
                      onClick={() => handlePurgeAnalytics(parseInt(retentionDaysValue))}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/35 px-5 py-2.5 rounded-full text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer inline-flex items-center gap-1.5"
                    >
                      {purging ? (
                        <>
                          <div className="w-3 h-3 border-2 border-red-400/20 border-t-red-400 rounded-full animate-spin" />
                          Bezig met verwerken...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Consolideer &amp; Opschonen
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

              {/* SECTION G: Realtime session detail walkthrough popover */}
              <AnimatePresence>
                {selectedSessionDetail && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    
                    {/* Dark backing overlay */}
                    <motion.div 
                      key="backing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSelectedSessionDetail(null)}
                      className="absolute inset-0 bg-black/85 backdrop-blur-md"
                    />

                    {/* Popover container */}
                    <motion.div 
                      key="container"
                      initial={{ opacity: 0, scale: 0.95, y: 30 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 30 }}
                      className="relative w-full max-w-2xl bg-[#161616] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10"
                    >
                      {/* Close trigger */}
                      <button 
                        type="button"
                        onClick={() => setSelectedSessionDetail(null)}
                        className="absolute top-4 right-4 text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer inline-flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>

                      <div className="p-6 border-b border-white/5 space-y-1">
                        <span className="text-earth-gold text-[10px] font-mono font-bold uppercase tracking-widest">Sessie Walkthrough Trail</span>
                        <h3 className="text-lg font-serif text-white font-medium flex items-center gap-2">
                          📍 {selectedSessionDetail.city || 'Onbekend'}{selectedSessionDetail.country ? `, ${selectedSessionDetail.country}` : ''}
                        </h3>
                        <p className="text-earth-light/40 text-[10px] font-mono leading-relaxed pt-1 flex flex-wrap gap-x-4">
                          <span>🌐 OS: {selectedSessionDetail.userAgent?.substring(0, 80)}...</span>
                          <span>📱 Toestel: {selectedSessionDetail.deviceType}</span>
                        </p>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        
                        {/* 1. Traversed Routes */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
                            <Compass className="w-3.5 h-3.5 text-earth-gold" />
                            Navigatiegeschiedenis &amp; Stay Duration
                          </h4>
                          <div className="relative border-l border-white/10 pl-5 ml-2.5 space-y-4 pt-1">
                            {(selectedSessionDetail.pages || []).map((p: any, idx: number) => (
                              <div key={idx} className="relative space-y-0.5">
                                <span className="absolute -left-[27px] top-1 bg-[#1a1a1a] border border-earth-gold/40 text-earth-gold rounded-full w-4 h-4 text-[9px] font-bold flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <div className="text-xs text-white font-mono font-bold">{p.path}</div>
                                <div className="text-[10px] text-earth-light/50 font-mono">
                                  Binnengekomen: {formatDutchDateTime(p.enteredAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} | Verblijfsduur: <span className="text-earth-gold font-semibold">{formatDurationText(p.durationSeconds || 0)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 2. Element/Button click sequences */}
                        <div className="space-y-3">
                          <h4 className="text-[10px] font-bold text-white uppercase tracking-widest font-mono flex items-center gap-1.5 border-b border-white/5 pb-2">
                            <MousePointerClick className="w-3.5 h-3.5 text-earth-gold" />
                            Klik-gebeurtenissen
                          </h4>
                          {!(selectedSessionDetail.clicks) || selectedSessionDetail.clicks.length === 0 ? (
                            <p className="text-[10px] text-earth-light/30 italic">Er zijn geen knopklikken geregistreerd in deze sessie.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedSessionDetail.clicks.map((click: any, idx: number) => (
                                <div key={idx} className="bg-white/[0.02] border border-white/5 text-[11px] p-2 rounded flex justify-between items-center gap-3">
                                  <div className="space-y-0.5 min-w-0">
                                    <div className="text-white font-medium truncate">
                                      🖱️ Geklikt op: <span className="font-semibold text-emerald-400">"{click.elementText || click.elementId || click.tagName}"</span>
                                    </div>
                                    <div className="text-[9px] text-earth-light/35 font-mono">
                                      Element tag: &lt;{click.tagName?.toLowerCase()}&gt; {click.elementId ? `id="${click.elementId}"` : ''} | Pagina: {click.path}
                                    </div>
                                  </div>
                                  <div className="text-[9px] text-earth-light/50 font-mono shrink-0">
                                    {formatDutchDateTime(click.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                      </div>

                      <div className="p-4 border-t border-white/5 bg-black/20 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedSessionDetail(null)}
                          className="bg-white/10 hover:bg-white/15 text-white text-xs font-bold px-5 py-2 rounded-lg transition-colors cursor-pointer"
                        >
                          Sluiten
                        </button>
                      </div>

                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* MUSIC ANALYTICS TAB */}
        {activeTab === 'music' && (() => {
          const totalThumbsUp = musicListens.filter(m => m.rating === 'up').length;
          const totalThumbsDown = musicListens.filter(m => m.rating === 'down').length;
          const totalCompleted = musicListens.filter(m => m.completed === true || m.completed === 1 || m.completed === '1').length;
          const totalPartial = musicListens.filter(m => !(m.completed === true || m.completed === 1 || m.completed === '1')).length;

          return (
            <div className="space-y-8">
              {/* Own Analytics Protection Banner */}
              <div className="bg-[#181818] border border-earth-gold/30 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-earth-gold/10 text-earth-gold rounded-xl border border-earth-gold/20 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-white font-serif font-bold text-sm flex items-center gap-2 flex-wrap">
                      <span>Eigen Luisterdata &amp; Bezoekersstatistieken</span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase border ${
                        ignoreOwnAnalytics
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}>
                        {ignoreOwnAnalytics ? '🔒 NEGEREN AAN (Geen opslag)' : '🟢 REGISTREREN AAN (Opslaan actief)'}
                      </span>
                    </h4>
                    <p className="text-earth-light/60 text-xs mt-0.5">
                      {ignoreOwnAnalytics
                        ? 'Jouw eigen luistersessies op dit apparaat worden genegeerd. Er worden GEEN records toegevoegd aan de statistieken.'
                        : 'Jouw eigen luistersessies op dit apparaat worden nu WÉL geregistreerd en opgeslagen in de statistieken.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={toggleIgnoreOwnAnalytics}
                  className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer shrink-0 border active:scale-95 ${
                    ignoreOwnAnalytics
                      ? 'bg-earth-gold hover:bg-earth-gold/90 text-black border-earth-gold shadow-md'
                      : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                  }`}
                >
                  {ignoreOwnAnalytics ? '▶️ Schakel registratie AAN' : '⏸️ Negeer mijn luisterdata'}
                </button>
              </div>

              {/* KPI Summary Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-[#181818] border border-white/10 p-5 rounded-2xl shadow-xl space-y-1">
                  <span className="text-earth-light/50 text-xs uppercase tracking-wider font-mono font-bold block">Totaal Luisterbeurten</span>
                  <div className="text-3xl font-serif font-bold text-white flex items-center justify-between">
                    <span>{musicListens.length}</span>
                    <Music className="w-6 h-6 text-earth-gold opacity-80" />
                  </div>
                  <p className="text-earth-light/60 text-[11px] font-mono">&gt;10s of geheel beluisterd</p>
                </div>

                <div className="bg-[#181818] border border-white/10 p-5 rounded-2xl shadow-xl space-y-1">
                  <span className="text-earth-light/50 text-xs uppercase tracking-wider font-mono font-bold block">Volledig Afgeluisterd</span>
                  <div className="text-3xl font-serif font-bold text-emerald-400 flex items-center justify-between">
                    <span>{totalCompleted}</span>
                    <CheckCircle className="w-6 h-6 text-emerald-400 opacity-80" />
                  </div>
                  <p className="text-emerald-400/80 text-[11px] font-mono">
                    {musicListens.length > 0 ? Math.round((totalCompleted / musicListens.length) * 100) : 0}% van alle luisteraars
                  </p>
                </div>

                <div className="bg-[#181818] border border-white/10 p-5 rounded-2xl shadow-xl space-y-1">
                  <span className="text-earth-light/50 text-xs uppercase tracking-wider font-mono font-bold block">Deels Beluisterd (&gt;10s)</span>
                  <div className="text-3xl font-serif font-bold text-amber-400 flex items-center justify-between">
                    <span>{totalPartial}</span>
                    <Clock className="w-6 h-6 text-amber-400 opacity-80" />
                  </div>
                  <p className="text-amber-400/80 text-[11px] font-mono">&gt;10 sec. maar niet tot einde</p>
                </div>

                <div className="bg-[#181818] border border-white/10 p-5 rounded-2xl shadow-xl space-y-1">
                  <span className="text-earth-light/50 text-xs uppercase tracking-wider font-mono font-bold block">Beoordelingen</span>
                  <div className="text-3xl font-serif font-bold text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-400 text-2xl font-bold">👍{totalThumbsUp}</span>
                      <span className="text-rose-400 text-2xl font-bold">👎{totalThumbsDown}</span>
                    </span>
                    <ThumbsUp className="w-6 h-6 text-earth-gold opacity-80" />
                  </div>
                  <p className="text-earth-light/60 text-[11px] font-mono">Vind ik leuk / niet leuk</p>
                </div>

                <div className="bg-[#181818] border border-white/10 p-5 rounded-2xl shadow-xl space-y-1">
                  <span className="text-earth-light/50 text-xs uppercase tracking-wider font-mono font-bold block">Unieke Steden</span>
                  <div className="text-3xl font-serif font-bold text-white flex items-center justify-between">
                    <span>{new Set(musicListens.map(m => m.city).filter(Boolean)).size || 1}</span>
                    <Globe className="w-6 h-6 text-blue-400 opacity-80" />
                  </div>
                  <p className="text-earth-light/60 text-[11px] font-mono">Gelezen via IP Geolocatie</p>
                </div>
              </div>

              {/* Section 2: Song Breakdown Table */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <div>
                    <h3 className="text-xl font-serif text-white font-bold flex items-center gap-2">
                      <Radio className="w-5 h-5 text-earth-gold" />
                      Statistieken per Nummer &amp; Vorm
                    </h3>
                    <p className="text-earth-light/60 text-xs">Aantal luisterbeurten opgesplitst per formaat inclusief beoordelingen (👍 / 👎) gegroepeerd per boek/album.</p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fetchAllData(true)}
                      className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
                      title="Herlaad en ververs alle luisterstatistieken"
                    >
                      <RefreshCw className={`w-4 h-4 ${isAutoRefreshing || loading ? 'animate-spin text-emerald-300' : ''}`} />
                      Verversen
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsTransipModalOpen(true)}
                      className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
                      title="Data overzetten naar TransIP MySQL Analytics database (paulw6_Analytics)"
                    >
                      <Database className="w-4 h-4 text-cyan-400" />
                      TransIP Database Sync
                    </button>

                    <button
                      onClick={() => setIsMusicMapOpen(true)}
                      className="bg-earth-gold hover:bg-earth-gold/90 text-black font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition-transform hover:scale-105 cursor-pointer shadow-lg shadow-earth-gold/10"
                    >
                      <MapPin className="w-4 h-4" />
                      Bekijk op Interactieve Kaart
                    </button>

                    <button
                      onClick={handlePurgeMusicAnalytics}
                      className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                      title="Wis alle opgeslagen luisterbeurten en beoordelingen"
                    >
                      <Trash2 className="w-4 h-4" />
                      Wis alle luisterdata
                    </button>
                  </div>
                </div>

                {/* Filter op Boek / Album Bar */}
                {(() => {
                  const catalogTracks: any[] = (allCatalogTracks && allCatalogTracks.length > 0) ? allCatalogTracks : DEFAULT_TRACK_SEEDS_FALLBACK;
                  const rawAlbums = (allCatalogAlbums && allCatalogAlbums.length > 0) ? allCatalogAlbums : DEFAULT_ALBUMS_FALLBACK;
                  const mergedAlbums: any[] = [...rawAlbums];
                  DEFAULT_ALBUMS_FALLBACK.forEach(defAlb => {
                    if (!mergedAlbums.some(a => (a.title || '').toLowerCase().trim() === defAlb.title.toLowerCase().trim() || String(a.id) === String(defAlb.id))) {
                      mergedAlbums.push(defAlb);
                    }
                  });
                  boeken.forEach(b => {
                    if (b.boektitel && !mergedAlbums.some(a => (a.title || '').toLowerCase().trim() === b.boektitel.toLowerCase().trim())) {
                      mergedAlbums.push({
                        id: b.id,
                        title: b.boektitel,
                        artist: 'Paul van Geenen',
                        description: `Muziek en audio bij ${b.boektitel}`
                      });
                    }
                  });

                  const albumsWithMetrics = mergedAlbums.map(alb => {
                    const plays = musicListens.filter(l => isListenInAlbumOrBook(l, alb, catalogTracks, qrcodes)).length;
                    return {
                      ...alb,
                      plays
                    };
                  });

                  return (
                    <div className="bg-[#121212] border border-white/10 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-earth-gold shrink-0" />
                        <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">Filter op Boek / Album:</span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={selectedBookFilter}
                          onChange={(e) => setSelectedBookFilter(e.target.value)}
                          className="bg-[#1a1a1a] border border-earth-gold/40 text-earth-light text-xs rounded-lg px-3 py-1.5 font-serif font-medium focus:outline-none focus:border-earth-gold cursor-pointer transition-colors"
                        >
                          <option value="all">📚 Alle Boeken &amp; Albums ({musicListens.length} luisterbeurten)</option>
                          {albumsWithMetrics.map(a => (
                            <option key={`opt-album-${a.id || a.title}`} value={String(a.id || a.title)}>
                              📖 {a.title} ({a.plays} plays)
                            </option>
                          ))}
                          <option value="unassigned">🎵 Overig / Niet gecategoriseerd</option>
                        </select>

                        {/* Quick filter pills */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setSelectedBookFilter('all')}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer",
                              selectedBookFilter === 'all'
                                ? "bg-earth-gold text-black shadow-md shadow-earth-gold/20"
                                : "bg-white/5 hover:bg-white/10 text-earth-light/70 border border-white/10"
                            )}
                          >
                            Alles ({musicListens.length})
                          </button>
                          {albumsWithMetrics.map(a => {
                            const isSelected = selectedBookFilter === String(a.id) ||
                                               selectedBookFilter === a.title ||
                                               areAlbumsOrBooksEqual(selectedBookFilter, a.title);
                            return (
                              <button
                                key={`pill-album-${a.id || a.title}`}
                                type="button"
                                onClick={() => setSelectedBookFilter(String(a.id || a.title))}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[11px] font-sans font-bold transition-all flex items-center gap-1 cursor-pointer",
                                  isSelected
                                    ? "bg-earth-gold text-black shadow-md shadow-earth-gold/20"
                                    : "bg-white/5 hover:bg-white/10 text-earth-light/70 border border-white/10"
                                )}
                              >
                                <span>{a.title}</span>
                                <span className={cn(
                                  "text-[10px] px-1 rounded font-mono",
                                  isSelected ? "bg-black/20 text-black font-bold" : "bg-white/10 text-white/60"
                                )}>
                                  {a.plays}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-earth-light/40 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4">Nummer &amp; Titel</th>
                        <th className="py-3 px-4 text-center">Laatst Beluisterd</th>
                        <th className="py-3 px-4 text-center">🎵 MP3</th>
                        <th className="py-3 px-4 text-center">📖 Audioboek</th>
                        <th className="py-3 px-4 text-center">💬 Reflectie</th>
                        <th className="py-3 px-4 text-center">🎥 Video</th>
                        <th className="py-3 px-4 text-right">Totaal &amp; Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(() => {
                        const rawAlbums: any[] = (allCatalogAlbums && allCatalogAlbums.length > 0) ? allCatalogAlbums : DEFAULT_ALBUMS_FALLBACK;
                        const catalogTracks: any[] = (allCatalogTracks && allCatalogTracks.length > 0) ? allCatalogTracks : DEFAULT_TRACK_SEEDS_FALLBACK;

                        const albumsList: any[] = [...rawAlbums];
                        DEFAULT_ALBUMS_FALLBACK.forEach(defAlb => {
                          if (!albumsList.some(a => (a.title || '').toLowerCase().trim() === defAlb.title.toLowerCase().trim() || String(a.id) === String(defAlb.id))) {
                            albumsList.push(defAlb);
                          }
                        });
                        boeken.forEach(b => {
                          if (b.boektitel && !albumsList.some(a => (a.title || '').toLowerCase().trim() === b.boektitel.toLowerCase().trim())) {
                            albumsList.push({
                              id: b.id,
                              title: b.boektitel,
                              artist: 'Paul van Geenen',
                              description: `Muziek bij ${b.boektitel}`
                            });
                          }
                        });

                        const matchedListenIds = new Set<string>();

                        const renderFormatCell = (songListens: any[], fmt: string) => {
                          const list = songListens.filter(l => (l.format || 'mp3') === fmt);
                          const count = list.length;
                          const up = list.filter(l => l.rating === 'up').length;
                          const down = list.filter(l => l.rating === 'down').length;

                          return (
                            <div className="flex flex-col items-center">
                              <span className="font-mono font-bold text-white">{count}</span>
                              {(up > 0 || down > 0) && (
                                <div className="text-[10px] font-mono flex items-center gap-1 mt-0.5">
                                  {up > 0 && <span className="text-emerald-400">👍{up}</span>}
                                  {down > 0 && <span className="text-rose-400">👎{down}</span>}
                                </div>
                              )}
                            </div>
                          );
                        };

                        const elements: React.ReactNode[] = [];

                        albumsList.forEach((album, aIdx) => {
                          const albumTitle = album.title || `Album ${aIdx + 1}`;
                          const albumTitleLower = albumTitle.toLowerCase().trim();
                          const albumIdLower = String(album.id || '').toLowerCase().trim();

                          // Check if this album matches the active filter
                          if (selectedBookFilter !== 'all' && selectedBookFilter !== 'unassigned') {
                            const isMatch = selectedBookFilter === albumIdLower ||
                                            selectedBookFilter.toLowerCase() === albumTitleLower ||
                                            selectedBookFilter === String(album.id) ||
                                            areAlbumsOrBooksEqual(selectedBookFilter, album.title);
                            if (!isMatch) return;
                          }
                          if (selectedBookFilter === 'unassigned') {
                            return; // Only show unassigned section
                          }

                          // Collect all tracks belonging to this album strictly
                          const albumTrackMap = new Map<string, any>();

                          // 1. Add tracks from catalog that belong strictly to this album
                          catalogTracks.forEach(t => {
                            if (isTrackInAlbumOrBook(t, album, qrcodes)) {
                              const cleanTitle = (t.title || t.id || '').replace(/^\d+[\s_]*/, '').toLowerCase().trim();
                              if (!albumTrackMap.has(cleanTitle) || t.album) {
                                albumTrackMap.set(cleanTitle, t);
                              }
                            }
                          });

                          // 2. Also incorporate any uncatalogued songs that have listen activity for this album
                          musicListens.forEach(l => {
                            if (isListenInAlbumOrBook(l, album, catalogTracks, qrcodes)) {
                              const rawTitle = (l.trackTitle || l.song || l.track_title || l.trackId || l.track_id || '').trim();
                              const cleanTitle = rawTitle.replace(/^\d+[\s_]*/, '').toLowerCase().trim();
                              if (cleanTitle && !albumTrackMap.has(cleanTitle)) {
                                albumTrackMap.set(cleanTitle, {
                                  id: l.trackId || l.track_id || rawTitle,
                                  title: rawTitle,
                                  album: albumTitle,
                                  order: l.trackId && String(l.trackId).match(/^\d+/) ? String(l.trackId).match(/^\d+/)![0] : String(albumTrackMap.size + 1).padStart(3, '0')
                                });
                              }
                            }
                          });

                          // Sort tracks strictly by numerical order (001, 002, ...) or title
                          const sortedTracks = Array.from(albumTrackMap.values()).sort((a, b) => {
                            const ordA = parseInt(a.order || a.track_order || a.id, 10) || 999;
                            const ordB = parseInt(b.order || b.track_order || b.id, 10) || 999;
                            if (ordA !== ordB) return ordA - ordB;
                            return (a.title || '').localeCompare(b.title || '');
                          });

                          // Helper function for strict and accurate track matching (no false substring collisions)
                          const isTrackMatch = (l: any, currentTrack: any, currIdx: number, allAlbumTracks: any[]) => {
                            if (!isListenInAlbumOrBook(l, album, catalogTracks, qrcodes)) return false;

                            const trackTitle = (currentTrack.title || '').trim();
                            const cleanTrackTitle = normAlbumOrSongName(trackTitle).replace(/^\d+[\s_.:-]+/, '');
                            const lTitle = (l.trackTitle || l.song || l.track_title || '').trim();
                            const cleanLTitle = normAlbumOrSongName(lTitle).replace(/^\d+[\s_.:-]+/, '');

                            const trackOrder = currentTrack.order || currentTrack.track_order || (currentTrack.id && String(currentTrack.id).match(/^(\d+)/) ? String(currentTrack.id).match(/^(\d+)/)![1] : String(currIdx + 1));
                            const trackNumOnly = String(trackOrder).replace(/^0+/, '');
                            const lId = String(l.trackId || l.track_id || '').toLowerCase().trim().replace(/^0+/, '');

                            // 1. Exact clean title match
                            if (cleanTrackTitle && cleanLTitle && cleanTrackTitle === cleanLTitle) {
                              return true;
                            }

                            // 2. Exact match on raw title lowercase
                            if (trackTitle && lTitle && trackTitle.toLowerCase() === lTitle.toLowerCase()) {
                              return true;
                            }

                            // 3. Match by track ID if title is empty or generic placeholder
                            const isGeneric = !cleanLTitle || cleanLTitle === 'muzieknummer' || cleanLTitle === 'track' || cleanLTitle === 'onbekend' || cleanLTitle === lId;
                            if (isGeneric && lId && trackNumOnly && lId === trackNumOnly) {
                              return true;
                            }

                            // 4. Match by track ID if cleanLTitle does NOT match any other track in this album
                            if (lId && trackNumOnly && lId === trackNumOnly) {
                              const matchesOtherTrack = allAlbumTracks.some(ot => {
                                const otOrder = ot.order || ot.track_order || ot.id || '';
                                const otNum = String(otOrder).replace(/^0+/, '');
                                if (otNum === trackNumOnly) return false;
                                const otClean = normAlbumOrSongName(ot.title).replace(/^\d+[\s_.:-]+/, '');
                                return otClean && otClean === cleanLTitle;
                              });
                              if (!matchesOtherTrack) {
                                return true;
                              }
                            }

                            return false;
                          };

                          // Count total listens in this album
                          let albumTotalListens = 0;
                          sortedTracks.forEach((track, idx) => {
                            const songListens = musicListens.filter(l => isTrackMatch(l, track, idx, sortedTracks));
                            albumTotalListens += songListens.length;
                          });

                          // Album header row
                          elements.push(
                            <tr key={`album-hdr-${album.id || albumTitle}-${aIdx}`} className="bg-white/[0.05] border-t-2 border-earth-gold/30">
                              <td colSpan={7} className="py-2.5 px-4 font-serif text-white font-bold text-sm tracking-wide">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <div className="flex items-center gap-2">
                                    <Disc3 className="w-4 h-4 text-earth-gold shrink-0" />
                                    <span className="text-earth-gold font-bold text-base">{albumTitle}</span>
                                    <span className="text-xs text-white/50 font-mono font-normal">({sortedTracks.length} nummers • {albumTotalListens} luisterbeurten)</span>
                                  </div>
                                  <span className="text-xs text-earth-light/60 font-sans">{album.artist || 'Paul van Geenen'}</span>
                                </div>
                              </td>
                            </tr>
                          );

                          // If album has no tracks
                          if (sortedTracks.length === 0) {
                            elements.push(
                              <tr key={`empty-${album.id || albumTitle}-${aIdx}`} className="bg-white/[0.01]">
                                <td colSpan={7} className="py-6 px-4 text-center text-earth-light/40 italic font-serif">
                                  Er zijn momenteel geen muzieknummers gekoppeld aan {albumTitle}.
                                </td>
                              </tr>
                            );
                          }

                          sortedTracks.forEach((track, tIdx) => {
                            const trackTitle = track.title || `Track ${tIdx + 1}`;
                            const trackOrder = track.order || track.track_order || (track.id && String(track.id).match(/^(\d+)/) ? String(track.id).match(/^(\d+)/)![1].padStart(3, '0') : String(tIdx + 1).padStart(3, '0'));

                            // Match listens for this track in this album strictly without substring cross-contamination
                            const songListens = musicListens.filter(l => {
                              const matches = isTrackMatch(l, track, tIdx, sortedTracks);
                              if (matches && l.id) matchedListenIds.add(l.id);
                              return matches;
                            });

                            // Determine latest listen date
                            const parseUtcDate = (ts?: string | number) => {
                              if (!ts) return null;
                              const rawStr = String(ts).trim();
                              const d = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(rawStr)
                                ? new Date(rawStr.replace(' ', 'T') + 'Z')
                                : new Date(ts);
                              return isNaN(d.getTime()) ? null : d;
                            };

                            const sortedListens = [...songListens].sort((a, b) => {
                              const tA = parseUtcDate(a.timestamp)?.getTime() || 0;
                              const tB = parseUtcDate(b.timestamp)?.getTime() || 0;
                              return tB - tA;
                            });
                            const latestListen = sortedListens[0];
                            const lastPlayedDate = latestListen?.timestamp
                              ? formatDutchDateTime(latestListen.timestamp, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : null;

                            const songUp = songListens.filter(l => l.rating === 'up').length;
                            const songDown = songListens.filter(l => l.rating === 'down').length;
                            const total = songListens.length;

                            elements.push(
                              <tr key={`trk-${album.id || albumTitle}-${track.id || trackOrder}-${tIdx}`} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 px-4 font-serif text-white font-semibold">
                                  <span className="text-earth-gold font-mono text-xs mr-2.5 font-bold">{trackOrder}</span>
                                  <span>{trackTitle}</span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {lastPlayedDate ? (
                                    <span className="font-mono text-xs text-earth-gold/90 bg-earth-gold/10 px-2 py-0.5 rounded border border-earth-gold/20">
                                      {lastPlayedDate}
                                    </span>
                                  ) : (
                                    <span className="text-earth-light/30 text-xs font-mono">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(songListens, 'mp3')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(songListens, 'audiobook')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(songListens, 'reflection')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(songListens, 'video')}</td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono font-bold text-earth-gold text-base">{total}</span>
                                    {(songUp > 0 || songDown > 0) && (
                                      <div className="text-[10px] font-mono flex items-center gap-1 mt-0.5">
                                        {songUp > 0 && <span className="text-emerald-400 font-bold">👍 {songUp}</span>}
                                        {songDown > 0 && <span className="text-rose-400 font-bold">👎 {songDown}</span>}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        });

                        // 3. Fallback: unmatched listens if any exist
                        const unmatchedListens = musicListens.filter(l => l.id && !matchedListenIds.has(l.id));
                        if (unmatchedListens.length > 0 && (selectedBookFilter === 'all' || selectedBookFilter === 'unassigned')) {
                          const unmatchedMap = new Map<string, any[]>();
                          unmatchedListens.forEach(l => {
                            const title = (l.trackTitle || l.song || l.trackId || 'Onbekend nummer').trim();
                            if (!unmatchedMap.has(title)) unmatchedMap.set(title, []);
                            unmatchedMap.get(title)!.push(l);
                          });

                          elements.push(
                            <tr key="album-hdr-unmatched" className="bg-white/[0.05] border-t-2 border-white/20">
                              <td colSpan={7} className="py-2.5 px-4 font-serif text-white font-bold text-sm tracking-wide">
                                <div className="flex items-center gap-2">
                                  <Music className="w-4 h-4 text-earth-light/60 shrink-0" />
                                  <span className="text-earth-light font-bold text-base">Overige Luisteractiviteiten</span>
                                  <span className="text-xs text-white/40 font-mono font-normal">({unmatchedMap.size} nummers)</span>
                                </div>
                              </td>
                            </tr>
                          );

                          Array.from(unmatchedMap.entries()).forEach(([title, listens], uIdx) => {
                            const sortedListens = [...listens].sort((a, b) => {
                              const tA = parseUtcDate(a.timestamp)?.getTime() || 0;
                              const tB = parseUtcDate(b.timestamp)?.getTime() || 0;
                              return tB - tA;
                            });
                            const latestListen = sortedListens[0];
                            const lastPlayedDate = latestListen?.timestamp
                              ? formatDutchDateTime(latestListen.timestamp, {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : null;

                            const songUp = listens.filter(l => l.rating === 'up').length;
                            const songDown = listens.filter(l => l.rating === 'down').length;
                            const total = listens.length;

                            elements.push(
                              <tr key={`unmatched-trk-${title}-${uIdx}`} className="hover:bg-white/[0.02] transition-colors">
                                <td className="py-3.5 px-4 font-serif text-white font-semibold">
                                  <span>{title}</span>
                                </td>
                                <td className="py-3.5 px-4 text-center">
                                  {lastPlayedDate ? (
                                    <span className="font-mono text-xs text-earth-gold/90 bg-earth-gold/10 px-2 py-0.5 rounded border border-earth-gold/20">
                                      {lastPlayedDate}
                                    </span>
                                  ) : (
                                    <span className="text-earth-light/30 text-xs font-mono">—</span>
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(listens, 'mp3')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(listens, 'audiobook')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(listens, 'reflection')}</td>
                                <td className="py-3.5 px-4 text-center">{renderFormatCell(listens, 'video')}</td>
                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono font-bold text-earth-gold text-base">{total}</span>
                                    {(songUp > 0 || songDown > 0) && (
                                      <div className="text-[10px] font-mono flex items-center gap-1 mt-0.5">
                                        {songUp > 0 && <span className="text-emerald-400 font-bold">👍 {songUp}</span>}
                                        {songDown > 0 && <span className="text-rose-400 font-bold">👎 {songDown}</span>}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        }

                        if (elements.length === 0) {
                          elements.push(
                            <tr key="no-results-filter">
                              <td colSpan={7} className="py-8 text-center text-earth-light/50 font-serif">
                                Geen nummers of statistieken gevonden voor dit geselecteerde filter.
                              </td>
                            </tr>
                          );
                        }

                        return elements;
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Recent Plays Log */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-lg font-serif text-white font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    Recente Luisteractiviteiten
                  </h3>
                  <span className="text-xs text-earth-light/40 font-mono">Laatste {Math.min(musicListens.length, 25)} afspelingen</span>
                </div>

                {musicListens.length === 0 ? (
                  <p className="text-xs text-earth-light/40 italic py-8 text-center">Er zijn nog geen muziek luisterbeurten geregistreerd.</p>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {musicListens.slice(0, 25).map((listen, idx) => {
                      const dateStr = listen.timestamp
                        ? formatDutchDateTime(listen.timestamp, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : 'Zojuist';
                      return (
                        <div key={listen.id || idx} className="bg-white/[0.02] border border-white/5 p-3 rounded-xl flex items-center justify-between gap-3 hover:border-white/15 transition-all">
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-sm font-serif text-white font-semibold truncate flex items-center gap-2">
                              <Music className="w-3.5 h-3.5 text-earth-gold shrink-0" />
                              <span>{listen.trackTitle || listen.song || 'Muzieknummer'}</span>
                            </div>
                            <div className="text-[11px] text-earth-light/50 font-mono flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>📍 {listen.city || 'Onbekend'}{listen.country ? `, ${listen.country}` : ''}</span>
                              <span>📱 {listen.deviceType || 'Mobiel'}</span>
                              <span className="text-earth-gold font-bold uppercase text-[10px] bg-earth-gold/10 px-1.5 py-0.2 rounded">
                                {listen.format || 'mp3'}
                              </span>
                              {(listen.completed === true || listen.completed === 1 || listen.completed === '1') ? (
                                <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-emerald-400" /> Volledig beluisterd
                                </span>
                              ) : (
                                <span className="text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" /> Deels {listen.durationSeconds ? `(${listen.durationSeconds}s)` : '(>10s)'}
                                </span>
                              )}
                              {listen.rating === 'up' && (
                                <span className="text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1">
                                  <ThumbsUp className="w-3 h-3" /> Vind ik leuk
                                </span>
                              )}
                              {listen.rating === 'down' && (
                                <span className="text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded text-[10px] font-bold flex items-center gap-1">
                                  <ThumbsDown className="w-3 h-3" /> Vind ik niet leuk
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-white/40 font-mono shrink-0">
                            {dateStr}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* TAB 7: MUZIEK DATABASE (TransIP MySQL) */}
        {activeTab === 'music_db' && !loading && (
          <MusicDbManager />
        )}

        {/* TAB 8: APARTE BEHEERPAGINA VOOR SLOTEN & SOUNDTRACKS */}
        {activeTab === 'track_locks' && !loading && (
          <TrackLocksManager />
        )}

        <p className="mt-8 text-center text-earth-light/20 text-xs">
          Huidige domein: <span className="opacity-40">www.PaulvanGeenen.nl</span>
        </p>
      </div>
      {/* --- MODAL 1: REDIRECT / QR CODE MAPPING --- */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsAdding(false);
                setEditingQRCode(null);
                setUploadError(null);
                setUploadSuccess(null);
                setNewItem({
                  id: '',
                  boekId: '',
                  boekTitel: '',
                  hoofdstukId: '',
                  hoofdstuk: '',
                  song: '',
                  artist: '',
                  spotifyLink: '',
                  qrImage: ''
                });
              }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl w-full max-w-4xl relative shadow-2xl z-10"
            >
              <h2 className="text-2xl font-serif text-white mb-6">
                {editingQRCode ? 'Redirect Mapping Bewerken' : 'Nieuwe Redirect Toevoegen'}
              </h2>
              
              <form onSubmit={handleAdd} className="space-y-5">
                {/* ROW 1: BOEK & HOOFDSTUK */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Boek</label>
                    <select
                      required
                      disabled={!!selectedBookQRFilter || !!editingQRCode}
                      value={newItem.boekId || ''}
                      onChange={(e) => {
                        const targetBookId = e.target.value;
                        const parentBook = boeken.find(b => b.id === targetBookId);
                        const chaptersFiltered = hoofdstukken.filter(h => h.boekId === targetBookId);
                        setNewItem({
                          ...newItem,
                          boekId: targetBookId,
                          boekTitel: parentBook?.boektitel || '',
                          hoofdstukId: chaptersFiltered[0]?.id || '',
                          hoofdstuk: chaptersFiltered[0]?.omschrijving || ''
                        });
                      }}
                      className={cn(
                        "w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold transition-all",
                        (selectedBookQRFilter || editingQRCode) ? "opacity-55 cursor-not-allowed select-none bg-black/20" : ""
                      )}
                    >
                      <option value="" disabled>Selecteer een boek...</option>
                      {boeken.map((b) => (
                        <option key={b.id} value={b.id} className="bg-[#1A1A1A]">
                          {b.boektitel}
                        </option>
                      ))}
                    </select>
                    {(selectedBookQRFilter || editingQRCode) && (
                      <p className="text-earth-gold/80 text-[10px] mt-2 leading-snug font-medium flex items-center gap-1">
                        <span className="shrink-0 text-amber-500">🔒</span>
                        <span>Ingesteld op het actieve boek "{newItem.boekTitel || 'Onbekend'}". Dit kan niet gewijzigd worden vanuit deze weergave.</span>
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Hoofdstuk</label>
                    <select
                      required
                      value={newItem.hoofdstukId || ''}
                      disabled={!newItem.boekId}
                      onChange={(e) => {
                        const targetChapId = e.target.value;
                        const targetChap = hoofdstukken.find(h => h.id === targetChapId);
                        setNewItem({
                          ...newItem,
                          hoofdstukId: targetChapId,
                          hoofdstuk: targetChap?.omschrijving || ''
                        });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold disabled:opacity-50"
                    >
                      <option value="" disabled>
                        {!newItem.boekId ? 'Selecteer eerst een boek' : 'Selecteer een hoofdstuk...'}
                      </option>
                      {activeChapters.map((h) => (
                        <option key={h.id} value={h.id} className="bg-[#1A1A1A]">
                          {h.omschrijving}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ROW 2: SONG TITEL */}
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Song Titel</label>
                  <input 
                    type="text"
                    required
                    value={newItem.song}
                    onChange={(e) => setNewItem({ ...newItem, song: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold text-base"
                    placeholder="My Favorite Song"
                  />
                </div>

                {/* ROW 3: ARTIEST */}
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Artiest</label>
                  <input 
                    type="text"
                    required
                    value={newItem.artist}
                    onChange={(e) => setNewItem({ ...newItem, artist: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold text-base"
                    placeholder="Artiest Naam"
                  />
                </div>

                {/* ROW 4: REDIRECT CODE & SPOTIFY LINK */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                    <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Redirect Code (bijv. H01S1)</label>
                    <input 
                      type="text"
                      required
                      readOnly={!!newItem.qrImage && (qrImageOrigin === 'manual' || qrImageOrigin === 'existing')}
                      value={newItem.id}
                      onChange={(e) => setNewItem({ ...newItem, id: e.target.value.toUpperCase().trim() })}
                      className={cn(
                        "w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold font-mono text-base uppercase transition-all",
                        (newItem.qrImage && (qrImageOrigin === 'manual' || qrImageOrigin === 'existing'))
                          ? "opacity-55 select-none cursor-not-allowed bg-black/20 border-white/5 focus:border-white/5"
                          : ""
                      )}
                      placeholder="H01S1"
                    />
                    {newItem.qrImage && (qrImageOrigin === 'manual' || qrImageOrigin === 'existing') && (
                      <p className="text-earth-gold/80 text-[10px] mt-2 leading-snug font-medium flex items-start gap-1">
                        <span className="shrink-0 text-amber-500">⚠️</span>
                        <span>Vergrendeld omdat er een gekoppelde QR-afbeelding is. Verwijder deze of klik op &quot;Genereer opnieuw&quot; om de code aan te passen.</span>
                      </p>
                    )}
                    {qrImageOrigin === 'auto' && newItem.id && (
                      <p className="text-emerald-400/80 text-[10px] mt-2 leading-snug font-mono truncate">
                        → {buildRedirectQrUrl(newItem.id)}
                      </p>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Spotify Link</label>
                    <input 
                      type="url"
                      required
                      value={newItem.spotifyLink}
                      onChange={(e) => setNewItem({ ...newItem, spotifyLink: e.target.value.trim() })}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold font-mono text-sm"
                      placeholder="https://open.spotify.com/track/..."
                    />
                  </div>
                </div>

                {/* ROW 5: QR CODE IMAGE UPLOAD, AUTO-GENERATIE & PREVIEW */}
                <div className="border-t border-white/5 pt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider">QR Code Afbeelding</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isGeneratingQr || newItem.id.trim().length < 2}
                        onClick={() => runAutoGenerateQr(newItem.id, newItem.boekId)}
                        className="inline-flex items-center gap-1.5 bg-earth-gold/15 hover:bg-earth-gold/25 border border-earth-gold/40 text-earth-gold text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                        title="Genereer automatisch in exacte boekstijl voor https://paulvangeenen.nl/<RedirectCode> met het opgeslagen boek-logo"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isGeneratingQr && "animate-spin")} />
                        {isGeneratingQr ? 'Genereren...' : 'Auto-genereer (Boekstijl)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const qs = new URLSearchParams();
                          if (newItem.id) qs.set('code', newItem.id);
                          if (newItem.boekId) qs.set('boekId', newItem.boekId);
                          window.open(`/beheer/qr-studio?${qs.toString()}`, '_blank', 'noopener,noreferrer');
                        }}
                        className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Open in QR-code Studio voor PNG / SVG / PDF drukwerk download"
                      >
                        <QrCode className="w-3.5 h-3.5 text-earth-gold" />
                        QR Studio
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </button>
                    </div>
                  </div>
                  
                  {uploadError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg text-sm flex items-start gap-2">
                      <span className="shrink-0">⚠️</span>
                      <p className="whitespace-pre-line leading-relaxed">{uploadError}</p>
                    </div>
                  )}

                  {uploadSuccess && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-lg text-sm flex items-start gap-2">
                      <span className="shrink-0">✅</span>
                      <p className="whitespace-pre-line leading-relaxed">{uploadSuccess}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    {/* Visual Preview */}
                    <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden group">
                      {newItem.qrImage ? (
                        <div className="flex flex-col items-center space-y-2">
                          <img 
                            src={newItem.qrImage} 
                            alt="QR Code" 
                            className="w-32 h-32 object-contain bg-white p-2 rounded-lg border border-white/25 shadow-lg max-w-full"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex gap-4">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!newItem.qrImage) return;
                                const fileName = newItem.song?.trim() || newItem.id || 'redirect';
                                if (qrImageOrigin === 'auto' && newItem.id.trim().length >= 2) {
                                  const bookLogo = getBookQrLogo(newItem.boekId);
                                  await downloadStyledQr(
                                    {
                                      ...BOOK_DEFAULT_QR_STYLE,
                                      url: buildRedirectQrUrl(newItem.id),
                                      size: 200,
                                      errorCorrectionLevel: bookLogo ? 'H' : 'Q',
                                      image: bookLogo || undefined,
                                    },
                                    'png',
                                    fileName
                                  );
                                } else {
                                  await downloadDataUrlAsPng(newItem.qrImage, fileName);
                                }
                              }}
                              className="text-xs text-earth-gold hover:text-earth-gold/80 hover:underline transition-colors mt-1 flex items-center gap-1 font-semibold cursor-pointer"
                              title={`Downloaden als "${(newItem.song?.trim() || newItem.id || 'redirect')}.png"`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Downloaden
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewItem({ ...newItem, qrImage: '' });
                                setQrImageOrigin('none');
                                setUploadSuccess(null);
                                setUploadError(null);
                              }}
                              className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors mt-1"
                            >
                              Afbeelding verwijderen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-earth-light/30 text-sm py-4">
                          <span className="block text-3xl mb-1">🖼️</span>
                          {newItem.id.trim().length >= 2
                            ? 'Wordt automatisch gegenereerd bij typen of opslaan...'
                            : 'Vul een Redirect Code in voor automatische QR-generatie.'}
                        </div>
                      )}
                    </div>

                    {/* File Drop / Selector */}
                    <div>
                      <label className="relative border-2 border-dashed border-white/10 hover:border-earth-gold/40 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 text-center select-none bg-black/10 hover:bg-black/30 w-full mb-0">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <span className="text-3xl mb-2">📤</span>
                        <span className="text-sm font-semibold text-white block">Of upload handmatig een QR-bestand</span>
                        <span className="text-xs text-earth-light/40 mt-1 block font-mono">PNG, JPG of JPEG (wordt automatisch gescand ter controle)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsAdding(false);
                      setEditingQRCode(null);
                      setUploadError(null);
                      setUploadSuccess(null);
                      setNewItem({
                        id: '',
                        boekId: '',
                        boekTitel: '',
                        hoofdstukId: '',
                        hoofdstuk: '',
                        song: '',
                        artist: '',
                        spotifyLink: '',
                        qrImage: ''
                      });
                    }}
                    className="flex-1 px-6 py-3 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit"
                    disabled={loading || boeken.length === 0 || hoofdstukken.length === 0}
                    className="flex-1 bg-earth-gold text-black font-bold px-6 py-3 rounded-lg hover:bg-earth-gold/90 transition-colors disabled:opacity-40"
                  >
                    {loading ? 'Bezig...' : 'Opslaan'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CUSTOM MODAL: CONFIRM ID CHANGE --- */}
      <AnimatePresence>
        {showConfirmIdChange && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmIdChange(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#242424] border border-red-500/30 p-8 rounded-2xl w-full max-w-lg relative shadow-2xl z-10 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full flex items-center justify-center mx-auto text-3xl font-bold animate-bounce">
                ⚠️
              </div>
              <div className="space-y-2 text-center">
                <h3 className="text-xl font-serif text-white font-bold">Redirect Code Gewijzigd!</h3>
                <p className="text-earth-light/70 text-sm">
                  Weet je zeker dat je het record wilt opslaan omdat de redirectcode is gewijzigd naar <span className="font-mono text-earth-gold font-bold bg-black/40 px-2 py-1 rounded">{newItem.id}</span>? 
                </p>
                <p className="text-red-400 text-xs">
                  Het oude record met code <span className="font-mono bg-black/30 px-1 py-0.5 rounded">{editingQRCode?.id}</span> zal worden verwijderd en vervangen.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  type="button"
                  onClick={() => setShowConfirmIdChange(false)}
                  className="px-6 py-3 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm font-semibold"
                >
                  Nee, ga terug
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    await saveQRCode(true);
                  }}
                  className="bg-earth-gold hover:bg-earth-gold/90 text-black font-semibold px-6 py-3 rounded-lg transition-all text-sm shadow-lg shadow-earth-gold/10"
                >
                  Ja, opslaan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 2: BOEK TOEVOEGEN / BEWERKEN --- */}
      <AnimatePresence>
        {isAddingBoek && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingBoek(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl w-full max-w-md relative shadow-2xl z-10"
            >
              <h2 className="text-2xl font-serif text-white mb-6">
                {editingBoek ? 'Boek Bewerken' : 'Nieuw Boek Toevoegen'}
              </h2>
              
              <form onSubmit={handleSaveBoek} className="space-y-4">
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Volgnummer</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    value={newBoek.volgnummer}
                    onChange={(e) => setNewBoek({ ...newBoek, volgnummer: parseInt(e.target.value) || 1 })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-earth-gold"
                  />
                </div>
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Boektitel</label>
                  <input 
                    type="text"
                    required
                    value={newBoek.boektitel}
                    onChange={(e) => setNewBoek({ ...newBoek, boektitel: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-earth-gold"
                    placeholder="bijv. Koester het leven"
                  />
                </div>

                <div className="pt-2 border-t border-white/5 space-y-3">
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider">
                    QR-Code Midden-Logo (bijv. Leeuw JPG/PNG)
                  </label>
                  <p className="text-[11px] text-earth-light/50 leading-relaxed">
                    Dit plaatje wordt opgeslagen op het boek en automatisch in het midden van iedere nieuw gegenereerde QR-code van dit boek geplaatst.
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                      {newBoek.qrLogo ? (
                        <img
                          src={newBoek.qrLogo}
                          alt="Boek QR Logo"
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="text-[10px] text-neutral-400 text-center px-1">Geen logo</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-2 bg-white/10 hover:bg-earth-gold hover:text-black text-white text-xs font-bold px-3.5 py-2 rounded-lg transition-colors cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        {newBoek.qrLogo ? 'Logo vervangen' : 'Logo uploaden'}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleBookLogoUpload}
                        />
                      </label>
                      {newBoek.qrLogo && (
                        <button
                          type="button"
                          onClick={() => setNewBoek(prev => ({ ...prev, qrLogo: '' }))}
                          className="text-left text-xs text-red-400 hover:underline cursor-pointer"
                        >
                          Logo verwijderen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingBoek(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-earth-gold text-black font-bold px-4 py-2 rounded-lg hover:bg-earth-gold/90 transition-colors text-sm"
                  >
                    Opslaan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL 3: HOOFDSTUK TOEVOEGEN / BEWERKEN --- */}
      <AnimatePresence>
        {isAddingHoofdstuk && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingHoofdstuk(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1A1A1A] border border-white/10 p-8 rounded-2xl w-full max-w-md relative shadow-2xl z-10"
            >
              <h2 className="text-2xl font-serif text-white mb-6">
                {editingHoofdstuk ? 'Hoofdstuk Bewerken' : 'Nieuw Hoofdstuk Toevoegen'}
              </h2>
              
              <form onSubmit={handleSaveHoofdstuk} className="space-y-4">
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Boek</label>
                  <select
                    required
                    disabled={!!selectedBookChapterFilter || !!editingHoofdstuk}
                    value={newHoofdstuk.boekId}
                    onChange={(e) => setNewHoofdstuk({ ...newHoofdstuk, boekId: e.target.value })}
                    className={cn(
                      "w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-earth-gold transition-all",
                      (selectedBookChapterFilter || editingHoofdstuk) ? "opacity-55 cursor-not-allowed select-none bg-black/20" : ""
                    )}
                  >
                    <option value="" disabled>Selecteer een boek...</option>
                    {boeken.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#1A1A1A]">
                        {b.boektitel}
                      </option>
                    ))}
                  </select>
                  {(selectedBookChapterFilter || editingHoofdstuk) && (
                    <p className="text-earth-gold/80 text-[10px] mt-1.5 leading-snug font-medium flex items-start gap-1">
                      <span className="shrink-0 text-amber-500">🔒</span>
                      <span>Ingesteld op het actieve boek "{boeken.find(b => b.id === newHoofdstuk.boekId)?.boektitel || 'Onbekend'}". Dit kan niet gewijzigd worden vanuit deze weergave.</span>
                    </p>
                  )}
                </div>
                
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Volgnummer</label>
                  <input 
                    type="number"
                    required
                    min={1}
                    value={newHoofdstuk.volgnummer}
                    onChange={(e) => setNewHoofdstuk({ ...newHoofdstuk, volgnummer: parseInt(e.target.value) || 1 })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-earth-gold"
                  />
                </div>
                
                <div>
                  <label className="block text-earth-light/40 text-xs font-bold uppercase tracking-wider mb-2">Hoofdstuk Omschrijving</label>
                  <input 
                    type="text"
                    required
                    value={newHoofdstuk.omschrijving}
                    onChange={(e) => setNewHoofdstuk({ ...newHoofdstuk, omschrijving: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-earth-gold"
                    placeholder="bijv. Hoofdstuk 1"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAddingHoofdstuk(false)}
                    className="flex-1 px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/5 transition-colors text-sm"
                  >
                    Annuleren
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-earth-gold text-black font-bold px-4 py-2 rounded-lg hover:bg-earth-gold/90 transition-colors text-sm"
                  >
                    Opslaan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Map View Modals across all Admin Tabs */}
      <MapModal
        isOpen={isVisitorMapOpen}
        onClose={() => setIsVisitorMapOpen(false)}
        title="Bezoekerslocaties Kaartoverzicht"
        items={visitorSessions}
        type="visitors"
      />

      <MapModal
        isOpen={isScanMapOpen}
        onClose={() => setIsScanMapOpen(false)}
        title="Boek QR-scans Kaartoverzicht"
        items={filteredScans}
        type="scans"
      />

      <MapModal
        isOpen={isMusicMapOpen}
        onClose={() => setIsMusicMapOpen(false)}
        title="Muziek Luisteraars Kaartoverzicht"
        items={musicListens}
        type="music"
      />

      {/* --- MODAL: TRANSIP MYSQL DATABASE IMPORT & SYNC --- */}
      <AnimatePresence>
        {isTransipModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTransipModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[#181818] border border-cyan-500/30 p-6 sm:p-8 rounded-2xl w-full max-w-2xl relative shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsTransipModalOpen(false)}
                className="absolute top-5 right-5 text-earth-light/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-serif text-white font-medium">
                    Data Overzetten naar TransIP MySQL
                  </h2>
                  <p className="text-xs text-cyan-300 font-mono">
                    Database: paulw6_Analytics @ TransIP (127.0.0.1)
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
                <div className="text-xs font-bold uppercase tracking-wider text-earth-light/40 mb-3">
                  Data in TransIP MySQL Database
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                    <div className="text-2xl font-mono text-cyan-400 font-bold">{musicListens.length}</div>
                    <div className="text-[11px] text-earth-light/60 mt-1">Luisterbeurten & Ratings</div>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                    <div className="text-2xl font-mono text-amber-400 font-bold">{scans.length}</div>
                    <div className="text-[11px] text-earth-light/60 mt-1">QR-code Scans</div>
                  </div>
                  <div className="bg-black/30 p-3 rounded-lg border border-white/5">
                    <div className="text-2xl font-mono text-emerald-400 font-bold">{subscribers.length}</div>
                    <div className="text-[11px] text-earth-light/60 mt-1">Abonnees</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs flex items-center justify-center font-bold">1</span>
                  Kies hoe je de data in TransIP laadt:
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="/transip_paulw6_Analytics_import.sql"
                    download="transip_paulw6_Analytics_import.sql"
                    className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-black font-bold px-4 py-3 rounded-xl text-xs transition-all shadow-lg shadow-cyan-600/20 text-center cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download SQL Bestand (.sql)
                  </a>

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch('/transip_paulw6_Analytics_import.sql');
                        const text = await res.text();
                        await navigator.clipboard.writeText(text);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 3500);
                      } catch (e) {
                        alert('Kon script niet kopiëren naar klembord.');
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all border border-white/10 cursor-pointer"
                  >
                    <ClipboardList className="w-4 h-4 text-cyan-400" />
                    {copiedSql ? '✓ Gekopieerd naar Klembord!' : 'Kopieer Volledig SQL Script'}
                  </button>
                </div>
              </div>

              <div className="bg-cyan-950/30 border border-cyan-500/20 rounded-xl p-4 text-xs text-earth-light/80 space-y-2">
                <div className="font-bold text-cyan-300 uppercase tracking-wider text-[11px]">
                  Stappen in phpMyAdmin op TransIP:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-earth-light/70">
                  <li>Open <strong className="text-white">phpMyAdmin</strong> op TransIP.</li>
                  <li>Klik links op de database <strong className="text-cyan-300">paulw6_Analytics</strong>.</li>
                  <li>Klik bovenin op het tabblad <strong className="text-white">SQL</strong> (of <strong className="text-white">Importeren</strong>).</li>
                  <li>Plak het gekopieerde SQL-script (of upload het gedownloade .sql bestand) en klik rechtsonder op <strong className="text-emerald-400">Starten (Go)</strong>.</li>
                </ol>
                <p className="pt-2 text-[11px] text-cyan-300/70 border-t border-cyan-500/10">
                  ✓ Alle {musicListens.length} echte luisterbeurten behouden hun originele datum/tijdstip, IP-stad en rating (eigen tests uit Almere zijn uitgefilterd).
                </p>
                <div className="pt-2 border-t border-cyan-500/10">
                  <div className="font-bold text-amber-300 text-[11px] mb-1">
                    Snelle SQL-opruimopdracht voor phpMyAdmin:
                  </div>
                  <pre className="bg-black/60 p-2 rounded text-[11px] font-mono text-earth-light/90 select-all overflow-x-auto">
DELETE FROM music_listens WHERE city LIKE '%Almere%';
DELETE FROM qr_scans WHERE city LIKE '%Almere%';
                  </pre>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs flex items-center justify-center font-bold">2</span>
                  TransIP Bridge Script (visitor_database.php)
                </h3>
                <p className="text-xs text-earth-light/70">
                  Zorg ervoor dat het bijgewerkte PHP-bestand op je TransIP webhosting staat zodat de app alle statistieken rechtstreeks uit MySQL ophaalt.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href="/api/visitor_database.php"
                    download="visitor_database.php"
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download visitor_database.php
                  </a>
                  <div className="flex items-center gap-2 px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-[11px] text-earth-light/80">
                    Plaats in: <code className="text-emerald-400 font-mono">/www/api/visitor_database.php</code> op TransIP
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setIsTransipModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-5 py-2.5 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
