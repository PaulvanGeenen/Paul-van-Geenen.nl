import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, RefreshCw, Plus, Trash2, Edit3, CheckCircle2, AlertCircle, 
  Music, Folder, FileAudio, FileVideo, Image, Subtitles, ExternalLink,
  Sparkles, Layers, Shield, Check, X, Eye, HelpCircle, ChevronRight,
  FolderSync
} from 'lucide-react';
import { cn } from '../lib/utils';

interface DbAlbum {
  id: number;
  title: string;
  artist: string;
  description: string;
  order_num: number;
  cover?: string;
}

interface DbTrack {
  id: number;
  album_id: number;
  track_order: number;
  title: string;
  foldername: string;
  media_detected?: {
    mp3?: string;
    audiobook?: string | null;
    reflection?: string | null;
    videoMov?: string | null;
    coverJpg?: string | null;
    portraitJpg?: string | null;
    landscapeJpg?: string | null;
    thumbnailJpg?: string | null;
    subtitles?: Record<string, string>;
  };
}

export function MusicDbManager() {
  // TransIP Bridge configuration (persisted in localStorage)
  const [apiUrl, setApiUrl] = useState<string>(() => {
    const saved = localStorage.getItem('transip_music_api_url');
    return saved || '/api/music_database.php';
  });
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('transip_music_api_key') || 'music-secret-key-paul-2026';
  });

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

  // SQL Console state
  const [isSqlConsoleOpen, setIsSqlConsoleOpen] = useState<boolean>(false);
  const [customSql, setCustomSql] = useState<string>('SELECT * FROM tracks ORDER BY album_id ASC, track_order ASC;');
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlLoading, setSqlLoading] = useState<boolean>(false);

  // Data
  const [albums, setAlbums] = useState<DbAlbum[]>([]);
  const [tracks, setTracks] = useState<DbTrack[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<number | 'all'>('all');

  // Modals & forms
  const [isAddingAlbum, setIsAddingAlbum] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<DbAlbum | null>(null);
  const [albumForm, setAlbumForm] = useState({
    title: '',
    artist: 'Paul van Geenen',
    description: '',
    order_num: 1,
    cover: ''
  });

  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [editingTrack, setEditingTrack] = useState<DbTrack | null>(null);
  const [trackForm, setTrackForm] = useState({
    album_id: 1,
    track_order: 1,
    title: '',
    foldername: ''
  });

  const [previewMediaTrack, setPreviewMediaTrack] = useState<DbTrack | null>(null);

  // Save config changes
  const saveConfig = (url: string, key: string) => {
    setApiUrl(url);
    setApiKey(key);
    localStorage.setItem('transip_music_api_url', url);
    localStorage.setItem('transip_music_api_key', key);
  };

  // Helper fetch function to the TransIP PHP Bridge / Server Proxy
  const fetchBridge = async (action: string, method: string = 'GET', body?: any): Promise<any> => {
    const urlsToTry = [
      apiUrl,
      '/api/music_database.php',
      '/api/music-bridge'
    ];

    let lastError: Error | null = null;

    for (let i = 0; i < urlsToTry.length; i++) {
      const currentTryUrl = urlsToTry[i];
      try {
        const cleanUrl = currentTryUrl.startsWith('http') ? currentTryUrl : `${window.location.origin}${currentTryUrl}`;
        const urlObj = new URL(cleanUrl);
        urlObj.searchParams.set('action', action);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        };

        const options: RequestInit = {
          method,
          headers
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
          options.body = JSON.stringify(body);
        }

        const res = await fetch(urlObj.toString(), options);
        const text = await res.text();
        
        let data: any = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          // Response is not JSON (e.g. 404 HTML from external host)
        }

        if (data && (data.success !== undefined || data.tracks !== undefined || data.albums !== undefined)) {
          return data;
        }

        // If direct external URL returned non-JSON, try fallback internal route
        if (i === 0 && currentTryUrl.startsWith('http')) {
          continue;
        }
      } catch (err: any) {
        lastError = err;
        // If direct URL failed with network error/CORS, try next in list
        if (i < urlsToTry.length - 1) {
          continue;
        }
      }
    }

    throw lastError || new Error('Kon geen verbinding maken met de database bridge.');
  };

  // Test connection to TransIP MySQL
  const testConnection = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetchBridge('test_connection');
      if (res && (res.success || res.connected)) {
        setConnectionStatus('connected');
        setStatusMessage(res.message || 'Succesvol verbonden met database bridge!');
        loadData();
      } else {
        setConnectionStatus('error');
        setStatusMessage(res?.error || 'Verbinding mislukt.');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setStatusMessage('Fout bij het bereiken van de PHP Bridge: ' + (err.message || 'Onbekende fout'));
    } finally {
      setLoading(false);
    }
  };

  // Load albums and tracks from database
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetchBridge('get_admin_data');
      if (res && res.success) {
        setAlbums(res.albums || []);
        setTracks(res.tracks || []);
        setConnectionStatus('connected');
      } else {
        if (res?.error && res.error.includes("doesn't exist")) {
          setConnectionStatus('connected');
          setStatusMessage("Database verbonden! Klik op 'Tabellen Initialiseren (1-Klik)' om de tabellen aan te maken.");
        } else {
          setStatusMessage(res?.error || 'Fout bij het ophalen van data.');
        }
      }
    } catch (err: any) {
      setStatusMessage('Kon catalogus niet ophalen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Init tables & seed standard data
  const handleInitTables = async () => {
    if (!window.confirm('Wil je de tabellen "albums" en "tracks" initialiseren in de database "paulw6_Music" en de standaard muziekdata inladen?')) {
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetchBridge('init_tables');
      if (res.success) {
        setStatusMessage(res.message);
        setConnectionStatus('connected');
        await loadData();
      } else {
        setStatusMessage('Fout: ' + res.error);
      }
    } catch (err: any) {
      setStatusMessage('Fout bij uitvoeren init_tables: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Re-seed tables & clean reset data
  const handleReseedTables = async () => {
    if (!window.confirm('Let op: Dit overschrijft alle tracks en albums in de database met de 11 geverifieerde nummers en 3 albums uit het schema. Weet je het zeker?')) {
      return;
    }
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await fetchBridge('reseed_tables');
      if (res.success) {
        setStatusMessage(res.message);
        setConnectionStatus('connected');
        await loadData();
      } else {
        setStatusMessage('Fout: ' + res.error);
      }
    } catch (err: any) {
      setStatusMessage('Fout bij herstellen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Scan server folders & auto import
  const handleScanAndSyncServerFolders = async () => {
    setLoading(true);
    setStatusMessage('Bezig met scannen van fysieke mappen op de server...');
    try {
      const res = await fetchBridge('sync_all_server_folders');
      if (res.success) {
        setStatusMessage(`Scan voltooid: ${res.total_folders_found} mappen gevonden op server. ${res.new_tracks_imported} nieuwe nummers geïmporteerd!`);
        setConnectionStatus('connected');
        await loadData();
      } else {
        setStatusMessage('Fout bij scannen van mappen: ' + res.error);
      }
    } catch (err: any) {
      setStatusMessage('Fout bij server scan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Album
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        id: editingAlbum ? editingAlbum.id : undefined,
        ...albumForm
      };
      const res = await fetchBridge('save_album', 'POST', payload);
      if (res.success) {
        setIsAddingAlbum(false);
        setEditingAlbum(null);
        await loadData();
      } else {
        alert('Fout bij opslaan album: ' + res.error);
      }
    } catch (err: any) {
      alert('Fout: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Album
  const handleDeleteAlbum = async (album: DbAlbum) => {
    if (!window.confirm(`Weet je zeker dat je het album "${album.title}" en alle gekoppelde nummers wilt verwijderen?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetchBridge('delete_album', 'POST', { id: album.id });
      if (res.success) {
        await loadData();
      } else {
        alert('Fout bij verwijderen album: ' + res.error);
      }
    } catch (err: any) {
      alert('Fout: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Track
  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        id: editingTrack ? editingTrack.id : undefined,
        ...trackForm
      };
      const res = await fetchBridge('save_track', 'POST', payload);
      if (res.success) {
        setIsAddingTrack(false);
        setEditingTrack(null);
        await loadData();
      } else {
        alert('Fout bij opslaan nummer: ' + res.error);
      }
    } catch (err: any) {
      alert('Fout: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Track
  const handleDeleteTrack = async (track: DbTrack) => {
    if (!window.confirm(`Weet je zeker dat je het nummer "${track.title}" wilt verwijderen?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetchBridge('delete_track', 'POST', { id: track.id });
      if (res.success) {
        await loadData();
      } else {
        alert('Fout bij verwijderen nummer: ' + res.error);
      }
    } catch (err: any) {
      alert('Fout: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Initial load on mount
  useEffect(() => {
    testConnection();
  }, []);

  const filteredTracks = selectedAlbumId === 'all'
    ? tracks
    : tracks.filter(t => t.album_id === selectedAlbumId);

  // Execute custom SQL query via the PHP bridge
  const executeCustomSql = async () => {
    if (!customSql.trim()) return;
    setSqlLoading(true);
    setSqlResult(null);
    try {
      const cleanUrl = apiUrl.startsWith('http') ? apiUrl : `${window.location.origin}${apiUrl}`;
      const res = await fetch(cleanUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey
        },
        body: JSON.stringify({ sql: customSql, params: [] })
      });
      const data = await res.json();
      setSqlResult(data);
      if (data.success && !customSql.trim().toUpperCase().startsWith('SELECT')) {
        await loadData();
      }
    } catch (err: any) {
      setSqlResult({ success: false, error: err.message });
    } finally {
      setSqlLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* SECTION 1: TransIP Database Bridge Header & Controls */}
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <Database className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-xl font-serif text-white font-bold">TransIP MySQL Database Beheer</h3>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full border bg-black/40 text-emerald-400 border-emerald-500/30">
                    Database: paulw6_Music
                  </span>
                </div>
                <p className="text-xs text-earth-light/60 mt-0.5">
                  Beheer van albums, titels en fysieke mapnamen via de beveiligde PHP Bridge. Alle bestanden worden automatisch gedetecteerd.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsSqlConsoleOpen(!isSqlConsoleOpen)}
              className={cn(
                "px-3.5 py-2 rounded-xl border text-xs font-mono transition-all flex items-center gap-1.5",
                isSqlConsoleOpen ? "bg-earth-gold text-black font-bold border-earth-gold" : "bg-white/5 hover:bg-white/10 border-white/10 text-earth-light hover:text-white"
              )}
            >
              <Database className="w-3.5 h-3.5" />
              SQL Console
            </button>

            <button
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-earth-light hover:text-white transition-all flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5 text-earth-gold" />
              Bridge Instellingen
            </button>

            <button
              disabled={loading}
              onClick={testConnection}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-mono text-white transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 text-blue-400", loading && "animate-spin")} />
              Verbinding Testen
            </button>
          </div>
        </div>

        {/* Status indicator bar */}
        <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-earth-light/40 font-mono text-[11px]">Verbindingsstatus:</span>
            {connectionStatus === 'connected' && (
              <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-medium text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verbonden met paulw6_Music op TransIP
              </span>
            )}
            {connectionStatus === 'error' && (
              <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-mono font-medium text-[11px]">
                <AlertCircle className="w-3.5 h-3.5" /> Niet verbonden / Fout
              </span>
            )}
            {connectionStatus === 'idle' && (
              <span className="text-white/40 font-mono text-[11px]">Verbinding controleren...</span>
            )}
          </div>

          {statusMessage && (
            <span className="text-[11px] font-mono text-earth-gold/80 bg-earth-gold/5 px-2.5 py-0.5 rounded border border-earth-gold/15">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Expandable SQL Console Panel */}
        <AnimatePresence>
          {isSqlConsoleOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
            >
              <div className="bg-black/50 border border-white/10 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" /> Directe MySQL Query Console
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCustomSql('SELECT * FROM albums ORDER BY order_num ASC;')}
                      className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono text-earth-light hover:text-white"
                    >
                      SELECT albums
                    </button>
                    <button
                      onClick={() => setCustomSql('SELECT * FROM tracks ORDER BY album_id ASC, track_order ASC;')}
                      className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono text-earth-light hover:text-white"
                    >
                      SELECT tracks
                    </button>
                    <button
                      onClick={() => setCustomSql('SHOW TABLES;')}
                      className="px-2 py-0.5 bg-white/5 hover:bg-white/10 rounded text-[10px] font-mono text-earth-light hover:text-white"
                    >
                      SHOW TABLES
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={customSql}
                    onChange={(e) => setCustomSql(e.target.value)}
                    placeholder="Voer SQL query in (bijv. SELECT * FROM tracks;)"
                    className="w-full bg-black/70 border border-white/10 rounded-lg p-2.5 font-mono text-xs text-white focus:border-emerald-400 outline-none resize-none"
                  />
                  <button
                    disabled={sqlLoading}
                    onClick={executeCustomSql}
                    className="px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shrink-0 transition-transform active:scale-95 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {sqlLoading ? 'Bezig...' : 'Uitvoeren'}
                  </button>
                </div>

                {sqlResult && (
                  <div className="p-3 bg-black/80 border border-white/5 rounded-lg max-h-56 overflow-auto text-xs font-mono">
                    {sqlResult.success ? (
                      <div className="space-y-1">
                        <div className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                          <Check className="w-3 h-3" /> Query succesvol uitgevoerd
                          {sqlResult.affected_rows !== undefined && ` (${sqlResult.affected_rows} rijen gewijzigd)`}
                          {Array.isArray(sqlResult.data) && ` (${sqlResult.data.length} resultaten)`}
                        </div>
                        <pre className="text-white/80 text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(sqlResult.data ?? sqlResult, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-rose-400 font-bold text-[11px] flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Fout: {sqlResult.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expandable Bridge Configuration Panel */}
        <AnimatePresence>
          {isConfigOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
            >
              <div className="bg-black/40 border border-white/5 p-4 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-earth-gold uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> Database Gateway &amp; Bridge Instellingen
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        saveConfig('/api/music_database.php', apiKey);
                        testConnection();
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-mono transition-colors",
                        apiUrl === '/api/music_database.php' ? "bg-earth-gold text-black font-bold" : "bg-white/5 text-earth-light hover:text-white"
                      )}
                    >
                      Standaard Proxy (/api/music_database.php)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        saveConfig('https://paulvangeenen.nl/api/music_database.php', apiKey);
                        testConnection();
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded text-[10px] font-mono transition-colors",
                        apiUrl.startsWith('http') ? "bg-earth-gold text-black font-bold" : "bg-white/5 text-earth-light hover:text-white"
                      )}
                    >
                      Direct TransIP (paulvangeenen.nl)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block text-earth-light/60 mb-1 font-mono text-[11px]">Bridge API URL:</label>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => saveConfig(e.target.value, apiKey)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-earth-gold outline-none"
                      placeholder="/api/music_database.php"
                    />
                  </div>
                  <div>
                    <label className="block text-earth-light/60 mb-1 font-mono text-[11px]">Geheime API Key (X-API-Key):</label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => saveConfig(apiUrl, e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-xs focus:border-earth-gold outline-none"
                      placeholder="music-secret-key-paul-2026"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-earth-light/40 font-mono">
                  💡 De standaard proxy routeert automatisch en heeft een fallback. Upload het bestand <code className="text-earth-gold">public/api/music_database.php</code> naar je TransIP hosting (<code className="text-white">/www/api/music_database.php</code>) om de live MySQL database te gebruiken.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SECTION 2: Albums Beheer */}
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-serif text-white font-bold flex items-center gap-2">
              <Layers className="w-4 h-4 text-earth-gold" />
              Albums ({albums.length})
            </h3>
            <p className="text-xs text-earth-light/50">Tabel: <code>albums</code> (id, title, artist, description, order_num)</p>
          </div>

          <button
            onClick={() => {
              setEditingAlbum(null);
              setAlbumForm({
                title: '',
                artist: 'Paul van Geenen',
                description: '',
                order_num: albums.length + 1,
                cover: ''
              });
              setIsAddingAlbum(true);
            }}
            className="px-4 py-2 bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition-transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Nieuw Album Toevoegen
          </button>
        </div>

        {albums.length === 0 ? (
          <div className="py-12 text-center text-earth-light/40 space-y-3">
            <Layers className="w-8 h-8 mx-auto opacity-30 animate-pulse" />
            <p className="text-sm">Nog geen albums gevonden in de database.</p>
            <button
              onClick={handleInitTables}
              className="text-xs text-earth-gold underline hover:text-earth-gold/80"
            >
              Klik hier om direct de standaard albums &amp; nummers in te laden.
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {albums.map((alb) => {
              const albumTrackCount = tracks.filter(t => t.album_id === alb.id).length;
              const isSelected = selectedAlbumId === alb.id;
              const albumCover = alb.cover || (
                (alb.title.toLowerCase().includes('geboorte') || alb.title.toLowerCase().includes('leeuw')) ? '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg' :
                alb.title.toLowerCase().includes('echo') ? '/@music/_albums/De%20Echo%20Album.jpg' :
                '/@music/_albums/Muzikale%20Krabbels%20Album.jpg'
              );

              return (
                <div
                  key={alb.id}
                  className={cn(
                    "bg-white/[0.02] border p-4 rounded-xl flex flex-col justify-between space-y-3 transition-all cursor-pointer group",
                    isSelected ? "border-earth-gold bg-earth-gold/5 shadow-lg shadow-earth-gold/5" : "border-white/5 hover:border-white/20"
                  )}
                  onClick={() => setSelectedAlbumId(isSelected ? 'all' : alb.id)}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-mono text-earth-gold bg-earth-gold/10 px-2 py-0.5 rounded border border-earth-gold/20 font-bold">
                        ID: {alb.id} · Volgorde: {alb.order_num}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingAlbum(alb);
                            setAlbumForm({
                              title: alb.title,
                              artist: alb.artist,
                              description: alb.description || '',
                              order_num: alb.order_num,
                              cover: alb.cover || ''
                            });
                            setIsAddingAlbum(true);
                          }}
                          className="p-1 text-earth-light/60 hover:text-white bg-white/5 hover:bg-white/10 rounded"
                          title="Album bewerken"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAlbum(alb)}
                          className="p-1 text-rose-400/60 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded"
                          title="Album verwijderen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/60 border border-white/10 shrink-0 shadow-md">
                        <img
                          src={albumCover}
                          alt={alb.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/banner-boek-3.jpg';
                          }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-serif text-white font-bold group-hover:text-earth-gold transition-colors truncate">
                          {alb.title}
                        </h4>
                        <p className="text-xs text-earth-light/60 truncate">{alb.artist}</p>
                        {alb.cover && (
                          <span className="text-[9px] font-mono text-emerald-400 block truncate" title={alb.cover}>
                            Cover: {alb.cover}
                          </span>
                        )}
                      </div>
                    </div>

                    {alb.description && (
                      <p className="text-[11px] text-earth-light/40 line-clamp-2 italic">{alb.description}</p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-earth-light/50">
                    <span>{albumTrackCount} nummer{albumTrackCount !== 1 ? 's' : ''}</span>
                    <span className="text-earth-gold group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                      {isSelected ? 'Geselecteerd' : 'Filter nummers'} <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 3: Tracks Beheer */}
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-lg font-serif text-white font-bold flex items-center gap-2">
              <Music className="w-4 h-4 text-earth-gold" />
              Muzieknummers ({filteredTracks.length})
            </h3>
            <p className="text-xs text-earth-light/50">Tabel: <code>tracks</code> (id, album_id, track_order, title, foldername)</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Album filter tabs */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5 text-xs">
              <button
                onClick={() => setSelectedAlbumId('all')}
                className={cn(
                  "px-3 py-1 rounded-lg font-mono transition-colors",
                  selectedAlbumId === 'all' ? "bg-earth-gold text-black font-bold" : "text-earth-light/60 hover:text-white"
                )}
              >
                Alles ({tracks.length})
              </button>
              {albums.map((alb) => (
                <button
                  key={alb.id}
                  onClick={() => setSelectedAlbumId(alb.id)}
                  className={cn(
                    "px-3 py-1 rounded-lg font-mono transition-colors truncate max-w-[140px]",
                    selectedAlbumId === alb.id ? "bg-earth-gold text-black font-bold" : "text-earth-light/60 hover:text-white"
                  )}
                >
                  {alb.title}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const targetAlbId = selectedAlbumId !== 'all' ? selectedAlbumId : (albums[0]?.id || 1);
                const nextOrder = tracks.filter(t => t.album_id === targetAlbId).length + 1;
                setEditingTrack(null);
                setTrackForm({
                  album_id: targetAlbId,
                  track_order: nextOrder,
                  title: '',
                  foldername: ''
                });
                setIsAddingTrack(true);
              }}
              className="px-4 py-2 bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 transition-transform hover:scale-105 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nieuw Nummer Toevoegen
            </button>
          </div>
        </div>

        {filteredTracks.length === 0 ? (
          <div className="py-12 text-center text-earth-light/40 space-y-3">
            <Music className="w-8 h-8 mx-auto opacity-30 animate-pulse" />
            <p className="text-sm">Geen nummers gevonden voor deze selectie.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/30 text-earth-light/40 uppercase tracking-wider font-mono border-b border-white/5">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Titel</th>
                  <th className="py-3 px-4">Album</th>
                  <th className="py-3 px-4">Mapnaam op TransIP</th>
                  <th className="py-3 px-4 text-center">Gedetecteerde Bestanden</th>
                  <th className="py-3 px-4 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTracks.map((trk) => {
                  const parentAlbum = albums.find(a => a.id === trk.album_id);
                  const media = trk.media_detected;

                  return (
                    <tr key={trk.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-earth-gold">
                        {String(trk.track_order).padStart(3, '0')}
                      </td>
                      <td className="py-3.5 px-4 font-serif text-white font-semibold text-sm">
                        {trk.title}
                      </td>
                      <td className="py-3.5 px-4 text-earth-light/70 font-serif">
                        {parentAlbum?.title || `Album ID: ${trk.album_id}`}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-earth-light/60 flex items-center gap-1.5">
                        <Folder className="w-3.5 h-3.5 text-earth-gold shrink-0" />
                        <span>{trk.foldername}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* MP3 badge */}
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] font-bold" title="MP3 Audio">
                            MP3
                          </span>
                          {/* Audiobook badge */}
                          {media?.audiobook && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono text-[10px]" title="Audioboek">
                              Audioboek
                            </span>
                          )}
                          {/* Reflection badge */}
                          {media?.reflection && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[10px]" title="Reflectie">
                              Reflectie
                            </span>
                          )}
                          {/* Video badge */}
                          {media?.videoMov && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px]" title="Video .mov/.mp4">
                              Video
                            </span>
                          )}
                          {/* Subtitles badge */}
                          {media?.subtitles && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px]" title="Ondertiteling SRT">
                              SRT ({Object.keys(media.subtitles).join('/')})
                            </span>
                          )}

                          <button
                            onClick={() => setPreviewMediaTrack(trk)}
                            className="p-1 text-earth-light/40 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-colors ml-1"
                            title="Bekijk alle gedetecteerde paden"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setEditingTrack(trk);
                              setTrackForm({
                                album_id: trk.album_id,
                                track_order: trk.track_order,
                                title: trk.title,
                                foldername: trk.foldername
                              });
                              setIsAddingTrack(true);
                            }}
                            className="p-1.5 text-earth-light/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            title="Nummer bewerken"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTrack(trk)}
                            className="p-1.5 text-rose-400/60 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg transition-colors"
                            title="Nummer verwijderen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- MODAL: ALBUM TOEVOEGEN / BEWERKEN --- */}
      <AnimatePresence>
        {isAddingAlbum && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1C1C1C] border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingAlbum(false)}
                className="absolute top-6 right-6 text-earth-light/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif text-white mb-6 font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-earth-gold" />
                {editingAlbum ? 'Album Bewerken' : 'Nieuw Album Toevoegen'}
              </h2>

              <form onSubmit={handleSaveAlbum} className="space-y-4 text-xs">
                <div>
                  <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                    Album Titel
                  </label>
                  <input
                    type="text"
                    required
                    value={albumForm.title}
                    onChange={(e) => setAlbumForm({ ...albumForm, title: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-earth-gold outline-none"
                    placeholder="Muzikale Krabbels"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                      Artiest
                    </label>
                    <input
                      type="text"
                      required
                      value={albumForm.artist}
                      onChange={(e) => setAlbumForm({ ...albumForm, artist: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-earth-gold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                      Volgorde (order_num)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={albumForm.order_num}
                      onChange={(e) => setAlbumForm({ ...albumForm, order_num: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono focus:border-earth-gold outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Cover Afbeelding (URL of relatief pad)</span>
                    <span className="text-[10px] text-earth-gold font-normal">Optioneel</span>
                  </label>
                  <div className="flex gap-3 items-start">
                    <input
                      type="text"
                      value={albumForm.cover}
                      onChange={(e) => setAlbumForm({ ...albumForm, cover: e.target.value })}
                      className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-xs focus:border-earth-gold outline-none"
                      placeholder="bijv. /images/banner-boek-1.jpg of @music map"
                    />
                    <div className="w-12 h-12 rounded-xl bg-black/80 border border-white/20 overflow-hidden shrink-0 flex items-center justify-center">
                      <img
                        src={albumForm.cover || (
                          (albumForm.title.toLowerCase().includes('geboorte') || albumForm.title.toLowerCase().includes('leeuw')) ? '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg' :
                          albumForm.title.toLowerCase().includes('echo') ? '/@music/_albums/De%20Echo%20Album.jpg' :
                          '/@music/_albums/Muzikale%20Krabbels%20Album.jpg'
                        )}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/banner-boek-3.jpg';
                        }}
                      />
                    </div>
                  </div>

                  {/* Snelknoppen voor bekende album covers */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setAlbumForm({ ...albumForm, cover: '/@music/_albums/De%20Geboorte%20van%20de%20Leeuw%20Album.jpg' })}
                      className="px-2 py-1 bg-white/5 hover:bg-earth-gold/20 text-earth-light hover:text-earth-gold rounded text-[10px] font-mono transition-colors"
                    >
                      De Geboorte van de Leeuw
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlbumForm({ ...albumForm, cover: '/@music/_albums/De%20Echo%20Album.jpg' })}
                      className="px-2 py-1 bg-white/5 hover:bg-earth-gold/20 text-earth-light hover:text-earth-gold rounded text-[10px] font-mono transition-colors"
                    >
                      De Echo
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlbumForm({ ...albumForm, cover: '/@music/_albums/Muzikale%20Krabbels%20Album.jpg' })}
                      className="px-2 py-1 bg-white/5 hover:bg-earth-gold/20 text-earth-light hover:text-earth-gold rounded text-[10px] font-mono transition-colors"
                    >
                      Muzikale Krabbels
                    </button>
                    <button
                      type="button"
                      onClick={() => setAlbumForm({ ...albumForm, cover: '' })}
                      className="px-2 py-1 bg-white/5 hover:bg-rose-500/20 text-earth-light/60 hover:text-rose-400 rounded text-[10px] font-mono transition-colors"
                    >
                      Auto Detectie
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                    Omschrijving (optioneel)
                  </label>
                  <textarea
                    rows={3}
                    value={albumForm.description}
                    onChange={(e) => setAlbumForm({ ...albumForm, description: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-earth-gold outline-none resize-none"
                    placeholder="Korte toelichting over dit album..."
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingAlbum(false)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 text-earth-light hover:text-white font-medium"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-earth-gold text-black font-bold rounded-xl hover:scale-105 transition-transform"
                  >
                    {editingAlbum ? 'Opslaan' : 'Album Aanmaken'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: NUMMER TOEVOEGEN / BEWERKEN --- */}
      <AnimatePresence>
        {isAddingTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1C1C1C] border border-white/10 p-8 rounded-2xl w-full max-w-lg shadow-2xl relative"
            >
              <button
                onClick={() => setIsAddingTrack(false)}
                className="absolute top-6 right-6 text-earth-light/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-serif text-white mb-6 font-bold flex items-center gap-2">
                <Music className="w-5 h-5 text-earth-gold" />
                {editingTrack ? 'Nummer Bewerken' : 'Nieuw Nummer Toevoegen'}
              </h2>

              <form onSubmit={handleSaveTrack} className="space-y-4 text-xs">
                {/* Album selectie */}
                <div>
                  <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                    Behoort tot Album
                  </label>
                  <select
                    required
                    value={trackForm.album_id}
                    onChange={(e) => {
                      const albId = parseInt(e.target.value, 10);
                      const nextOrder = tracks.filter(t => t.album_id === albId).length + 1;
                      setTrackForm({
                        ...trackForm,
                        album_id: albId,
                        track_order: nextOrder
                      });
                    }}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-earth-gold outline-none"
                  >
                    {albums.map((a) => (
                      <option key={a.id} value={a.id} className="bg-[#1C1C1C]">
                        {a.title} ({a.artist})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                      Volgnummer
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={trackForm.track_order}
                      onChange={(e) => setTrackForm({ ...trackForm, track_order: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-earth-gold outline-none text-center"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5">
                      Titel van het Lied
                    </label>
                    <input
                      type="text"
                      required
                      value={trackForm.title}
                      onChange={(e) => {
                        const newTitle = e.target.value;
                        setTrackForm({
                          ...trackForm,
                          title: newTitle,
                          // Automatisch suggestie doen voor foldername indien leeg
                          foldername: trackForm.foldername || `${String(trackForm.track_order).padStart(3, '0')} ${newTitle}`
                        });
                      }}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-earth-gold outline-none"
                      placeholder="the Silent Code"
                    />
                  </div>
                </div>

                {/* Mapnaam */}
                <div>
                  <label className="block text-earth-light/60 font-bold uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Fysieke Mapnaam op TransIP Server</span>
                    <span className="text-[10px] text-earth-gold font-normal lowercase">in /@music/...</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={trackForm.foldername}
                      onChange={(e) => setTrackForm({ ...trackForm, foldername: e.target.value })}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-3 text-white font-mono text-sm focus:border-earth-gold outline-none"
                      placeholder="011 the Silent Code"
                    />
                    <Folder className="w-4 h-4 text-earth-light/40 absolute left-3 top-3.5" />
                  </div>
                  <p className="text-[11px] text-earth-light/40 mt-1.5 italic">
                    💡 Alle mediabestanden (MP3, Audiobook, Reflectie, Video MOV, Foto's en SRT) worden automatisch uit deze map ingeladen.
                  </p>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingTrack(false)}
                    className="px-5 py-2.5 rounded-xl border border-white/10 text-earth-light hover:text-white font-medium"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-earth-gold text-black font-bold rounded-xl hover:scale-105 transition-transform"
                  >
                    {editingTrack ? 'Opslaan' : 'Nummer Toevoegen'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- MODAL: PREVIEW GEDETECTEERDE BESTANDEN --- */}
      <AnimatePresence>
        {previewMediaTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1C1C1C] border border-white/10 p-8 rounded-2xl w-full max-w-xl shadow-2xl relative"
            >
              <button
                onClick={() => setPreviewMediaTrack(null)}
                className="absolute top-6 right-6 text-earth-light/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-lg font-serif text-white mb-2 font-bold flex items-center gap-2">
                <Eye className="w-5 h-5 text-earth-gold" />
                Gedetecteerde Bestanden voor "{previewMediaTrack.title}"
              </h2>
              <p className="text-xs text-earth-light/50 font-mono mb-6">
                Map: <code>/@music/{previewMediaTrack.foldername}</code>
              </p>

              <div className="space-y-3 text-xs max-h-[380px] overflow-y-auto pr-1">
                {/* MP3 */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileAudio className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-white">MP3 Hoofdaudio</div>
                      <div className="text-[11px] font-mono text-earth-light/40 truncate">{previewMediaTrack.media_detected?.mp3 || 'Niet gevonden'}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono text-[10px] font-bold">Actief</span>
                </div>

                {/* Audiobook */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileAudio className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-white">Audioboek Versie</div>
                      <div className="text-[11px] font-mono text-earth-light/40 truncate">{previewMediaTrack.media_detected?.audiobook || 'Geen audiobook in map'}</div>
                    </div>
                  </div>
                  {previewMediaTrack.media_detected?.audiobook ? (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono text-[10px]">Aanwezig</span>
                  ) : (
                    <span className="text-[10px] text-earth-light/30 font-mono">—</span>
                  )}
                </div>

                {/* Reflection */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileAudio className="w-4 h-4 text-purple-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-white">Reflectie Audio</div>
                      <div className="text-[11px] font-mono text-earth-light/40 truncate">{previewMediaTrack.media_detected?.reflection || 'Geen reflectie in map'}</div>
                    </div>
                  </div>
                  {previewMediaTrack.media_detected?.reflection ? (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[10px]">Aanwezig</span>
                  ) : (
                    <span className="text-[10px] text-earth-light/30 font-mono">—</span>
                  )}
                </div>

                {/* Video MOV */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileVideo className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-white">Video MOV / MP4</div>
                      <div className="text-[11px] font-mono text-earth-light/40 truncate">{previewMediaTrack.media_detected?.videoMov || 'Geen video in map'}</div>
                    </div>
                  </div>
                  {previewMediaTrack.media_detected?.videoMov ? (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[10px]">Aanwezig</span>
                  ) : (
                    <span className="text-[10px] text-earth-light/30 font-mono">—</span>
                  )}
                </div>

                {/* Subtitles */}
                <div className="p-3 bg-black/40 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Subtitles className="w-4 h-4 text-rose-400 shrink-0" />
                    <div className="truncate">
                      <div className="font-bold text-white">Ondertiteling (SRT)</div>
                      <div className="text-[11px] font-mono text-earth-light/40 truncate">
                        {previewMediaTrack.media_detected?.subtitles
                          ? Object.entries(previewMediaTrack.media_detected.subtitles).map(([lang, url]) => `${lang}: ${url.split('/').pop()}`).join(', ')
                          : 'Geen .srt bestanden in map'}
                      </div>
                    </div>
                  </div>
                  {previewMediaTrack.media_detected?.subtitles ? (
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-mono text-[10px]">Aanwezig</span>
                  ) : (
                    <span className="text-[10px] text-earth-light/30 font-mono">—</span>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                <button
                  onClick={() => setPreviewMediaTrack(null)}
                  className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl"
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
