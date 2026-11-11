import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  QrCode,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Palette,
  Sliders,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  BookOpen,
  Trash2,
  Upload,
  RotateCcw,
  ArrowLeft,
  Save,
} from 'lucide-react';
import {
  BOOK_DEFAULT_QR_STYLE,
  QrStyleConfig,
  buildRedirectQrUrl,
  createStyledQrInstance,
  downloadStyledQr,
  generateRedirectQrDataUrl,
  optimizeCenterLogoForBook,
  verifyQrBlobScanability,
} from '../utils/qrGenerator';
import {
  getTransipBoeken,
  getTransipQrCodes,
  saveTransipQrCode,
} from '../lib/transip';
import { markDeviceAsAdmin } from '../lib/analytics';
import { DotType, CornerSquareType, CornerDotType, ErrorCorrectionLevel } from 'qr-code-styling';
import { cn } from '../lib/utils';

interface StudioBook {
  id: string;
  volgnummer: number;
  boektitel: string;
  qrLogo?: string;
}

interface StudioQrMapping {
  id: string;
  boekId?: string;
  boekTitel?: string;
  hoofdstukId?: string;
  hoofdstuk: string;
  song: string;
  artist: string;
  spotifyLink: string;
  qrImage?: string;
}

type AccordionSection = 'content' | 'colors' | 'logo' | 'design';

export function QRStudio() {
  const [searchParams] = useSearchParams();
  const initialBoekId = searchParams.get('boekId') || '';
  const initialCode = (searchParams.get('code') || '').trim().toUpperCase();

  // Auth state matching Admin.tsx
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(() => {
    return typeof window !== 'undefined' && localStorage.getItem('krabbels_admin_token') === 'GONDA1984';
  });

  // Loaded data
  const [boeken, setBoeken] = useState<StudioBook[]>([]);
  const [qrMappings, setQrMappings] = useState<StudioQrMapping[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Selected context
  const [selectedBookId, setSelectedBookId] = useState<string>(initialBoekId);
  const [selectedMappingId, setSelectedMappingId] = useState<string>(initialCode);
  const [logoMode, setLogoMode] = useState<'book' | 'custom' | 'none'>('book');
  const [customLogo, setCustomLogo] = useState<string>('');

  // QR Configuration — exact book default style
  const [config, setConfig] = useState<QrStyleConfig>({
    ...BOOK_DEFAULT_QR_STYLE,
    url: initialCode ? buildRedirectQrUrl(initialCode) : 'https://paulvangeenen.nl/',
  });

  // UI state
  const [openSections, setOpenSections] = useState<Record<AccordionSection, boolean>>({
    content: true,
    colors: false,
    logo: true,
    design: false,
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [scanCheck, setScanCheck] = useState<{
    status: 'checking' | 'ok' | 'warn';
    decoded: string | null;
  }>({ status: 'checking', decoded: null });
  const [downloadingFormat, setDownloadingFormat] = useState<'png' | 'svg' | 'pdf' | null>(null);
  const [savingToMapping, setSavingToMapping] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  const renderSeqRef = useRef(0);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'GONDA1984') {
      localStorage.setItem('krabbels_admin_token', 'GONDA1984');
      markDeviceAsAdmin();
      setIsAuthorized(true);
      setAuthError(null);
    } else {
      setAuthError('Onjuist wachtwoord.');
    }
  };

  // Load books & redirect mappings once authorized
  useEffect(() => {
    if (!isAuthorized) return;
    let cancelled = false;

    const loadAll = async () => {
      setLoadingData(true);
      try {
        const token = localStorage.getItem('krabbels_admin_token') || 'GONDA1984';

        const fetchBooks = async (): Promise<StudioBook[]> => {
          try {
            const res = await fetch('/api/boeken', { headers: { Authorization: token } });
            if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
              const data = await res.json();
              if (Array.isArray(data?.boeken)) return data.boeken;
            }
          } catch {}
          return await getTransipBoeken();
        };

        const fetchMappings = async (): Promise<StudioQrMapping[]> => {
          try {
            const res = await fetch('/api/qrcodes', { headers: { Authorization: token } });
            if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
              const data = await res.json();
              if (Array.isArray(data?.qrcodes)) return data.qrcodes;
            }
          } catch {}
          return await getTransipQrCodes();
        };

        const [bList, qList] = await Promise.all([fetchBooks(), fetchMappings()]);
        if (cancelled) return;

        bList.sort((a, b) => (Number(a.volgnummer) || 0) - (Number(b.volgnummer) || 0));
        qList.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
        setBoeken(bList);
        setQrMappings(qList);

        // Preselect book matching URL param or mapping's book or first book with a logo
        if (!selectedBookId) {
          const matchingMap = initialCode ? qList.find((m) => m.id.toUpperCase() === initialCode) : null;
          if (matchingMap?.boekId) {
            setSelectedBookId(matchingMap.boekId);
          } else {
            const bookWithLogo = bList.find((b) => Boolean(b.qrLogo));
            if (bookWithLogo) {
              setSelectedBookId(bookWithLogo.id);
            } else if (bList[0]) {
              setSelectedBookId(bList[0].id);
            }
          }
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [isAuthorized]);

  const activeBook = useMemo(
    () => boeken.find((b) => b.id === selectedBookId) || null,
    [boeken, selectedBookId]
  );

  // Determine effective logo image
  const effectiveLogo = useMemo(() => {
    if (logoMode === 'none') return undefined;
    if (logoMode === 'custom') return customLogo || undefined;
    return activeBook?.qrLogo || undefined;
  }, [logoMode, customLogo, activeBook]);

  const effectiveConfig = useMemo<QrStyleConfig>(
    () => ({
      ...config,
      image: effectiveLogo,
    }),
    [config, effectiveLogo]
  );

  // Render preview & verify scannability with jsQR
  const regeneratePreview = async (cfg: QrStyleConfig) => {
    const seq = ++renderSeqRef.current;
    setScanCheck((prev) => ({ ...prev, status: 'checking' }));
    try {
      // Preview renders cleanly at 600px while preserving exact aspect proportions of chosen size
      const previewConfig: QrStyleConfig = {
        ...cfg,
        size: 600,
      };
      const qr = createStyledQrInstance(previewConfig, 'canvas');
      const blob = await qr.getRawData('png');
      if (seq !== renderSeqRef.current) return;
      if (blob instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => {
          if (seq === renderSeqRef.current && typeof reader.result === 'string') {
            setPreviewUrl(reader.result);
          }
        };
        reader.readAsDataURL(blob);

        const verified = await verifyQrBlobScanability(blob);
        if (seq !== renderSeqRef.current) return;
        const matches =
          verified.scanable &&
          (verified.decodedValue || '').trim().toLowerCase() === cfg.url.trim().toLowerCase();
        setScanCheck({
          status: matches ? 'ok' : 'warn',
          decoded: verified.decodedValue,
        });
      }
    } catch (err) {
      console.error('QR Studio preview error:', err);
      if (seq === renderSeqRef.current) {
        setScanCheck({ status: 'warn', decoded: null });
      }
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = setTimeout(() => {
      regeneratePreview(effectiveConfig);
    }, 120);
    return () => clearTimeout(timer);
  }, [isAuthorized, effectiveConfig]);

  const toggleSection = (sec: AccordionSection) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleSelectMapping = (codeId: string) => {
    setSelectedMappingId(codeId);
    if (!codeId) return;
    const found = qrMappings.find((m) => m.id === codeId);
    setConfig((prev) => ({
      ...prev,
      url: buildRedirectQrUrl(codeId),
    }));
    if (found?.boekId) {
      setSelectedBookId(found.boekId);
    }
  };

  const handleCustomLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeCenterLogoForBook(file, 640);
      setCustomLogo(optimized);
      setLogoMode('custom');
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('De afbeelding kon niet worden geladen.');
    }
    e.target.value = '';
  };

  const handleResetToBookDefault = () => {
    setConfig((prev) => ({
      ...BOOK_DEFAULT_QR_STYLE,
      url: prev.url,
    }));
    setLogoMode('book');
  };

  const deriveFileName = () => {
    if (matchedMapping?.song?.trim()) {
      return matchedMapping.song.trim();
    }
    try {
      const parsed = new URL(config.url);
      const slug = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
      if (slug) return `qrcode_${slug.toUpperCase()}`;
    } catch {}
    return `qrcode_${selectedMappingId || 'paulvangeenen'}`;
  };

  const handleDownload = async (format: 'png' | 'svg' | 'pdf') => {
    setDownloadingFormat(format);
    try {
      await downloadStyledQr(effectiveConfig, format, deriveFileName());
    } catch (err) {
      console.error(`Download ${format} error:`, err);
      alert(`Kon ${format.toUpperCase()}-bestand niet downloaden.`);
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Optional convenience: sync this generated QR back into the selected Redirect Mapping record
  const matchedMapping = useMemo(() => {
    if (selectedMappingId) {
      return qrMappings.find((m) => m.id.toUpperCase() === selectedMappingId.toUpperCase()) || null;
    }
    try {
      const parsed = new URL(config.url);
      const seg = parsed.pathname.replace(/^\/+/, '').toUpperCase();
      if (seg) return qrMappings.find((m) => m.id.toUpperCase() === seg) || null;
    } catch {}
    return null;
  }, [selectedMappingId, config.url, qrMappings]);

  const handleSaveToMapping = async () => {
    if (!matchedMapping) return;
    setSavingToMapping(true);
    setSaveToast(null);
    try {
      const { dataUrl } = await generateRedirectQrDataUrl(matchedMapping.id, effectiveLogo, 246);
      const updated = { ...matchedMapping, qrImage: dataUrl };
      const token = localStorage.getItem('krabbels_admin_token') || 'GONDA1984';
      let savedViaApi = false;
      try {
        const res = await fetch('/api/qrcodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token,
          },
          body: JSON.stringify(updated),
        });
        if (res.ok && (res.headers.get('content-type') || '').includes('application/json')) {
          savedViaApi = true;
        }
      } catch {}
      if (!savedViaApi) {
        await saveTransipQrCode(updated);
      }
      setQrMappings((prev) => prev.map((m) => (m.id === matchedMapping.id ? updated : m)));
      setSaveToast(`QR-afbeelding bijgewerkt op redirect ${matchedMapping.id}.`);
      setTimeout(() => setSaveToast(null), 4000);
    } catch (err) {
      console.error('Error saving QR back to mapping:', err);
      alert('Fout bij opslaan naar Redirect Mapping.');
    } finally {
      setSavingToMapping(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-earth-dark px-6">
        <div className="bg-earth-clay/10 p-8 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-earth-gold/20 rounded-full flex items-center justify-center text-earth-gold">
              <Shield className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-2xl font-serif text-white text-center mb-2">QR-code Studio</h1>
          <p className="text-earth-light/60 text-xs text-center mb-6">Log in met het beheerderswachtwoord.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wachtwoord"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-earth-gold"
              autoFocus
            />
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-earth-gold text-black font-bold py-3 rounded-lg hover:bg-earth-gold/90 transition-colors"
            >
              Toegang verkrijgen
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-earth-dark text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Studio Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-earth-gold/20">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-earth-gold font-bold block">
                  Beheer • Drukwerk Generator
                </span>
                <h1 className="text-2xl sm:text-3xl font-serif text-white leading-tight">
                  QR-code Studio
                </h1>
              </div>
            </div>
            <p className="text-earth-light/60 text-sm italic">
              Genereer drukklare QR-codes exact in de stijl van jouw boeken (PNG, vector SVG &amp; PDF).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleResetToBookDefault}
              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-earth-light/80 hover:text-white px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer"
              title="Zet kleuren, vierkante stijl, foutcorrectie H en boek-logo terug naar standaard"
            >
              <RotateCcw className="w-3.5 h-3.5 text-earth-gold" />
              Boek-standaard herstellen
            </button>
            <Link
              to="/beheer"
              className="flex items-center gap-2 bg-white/5 hover:bg-earth-gold/15 border border-earth-gold/30 text-white px-4 py-2 rounded-full text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-earth-gold" />
              Naar Beheer
            </Link>
          </div>
        </header>

        {/* Context Bar: Boek & Bestaande Redirect */}
        <section className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4 shadow-lg">
          <div>
            <label className="flex items-center gap-2 text-earth-gold text-xs font-bold uppercase tracking-wider mb-2">
              <BookOpen className="w-3.5 h-3.5" />
              Boek (voor Midden-Logo)
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => {
                setSelectedBookId(e.target.value);
                setLogoMode('book');
              }}
              disabled={loadingData}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold cursor-pointer"
            >
              <option value="">-- Kies een boek (optioneel) --</option>
              {boeken.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#1A1A1A]">
                  {b.boektitel} {b.qrLogo ? '✓ (met logo)' : '(geen logo)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-earth-light/60 text-xs font-bold uppercase tracking-wider mb-2">
              <Link2 className="w-3.5 h-3.5 text-earth-gold" />
              Bestaande Redirect Invullen (Optioneel)
            </label>
            <select
              value={selectedMappingId}
              onChange={(e) => handleSelectMapping(e.target.value)}
              disabled={loadingData}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold cursor-pointer"
            >
              <option value="">-- Vrije URL of kies redirectcode --</option>
              {qrMappings
                .filter((m) => !selectedBookId || m.boekId === selectedBookId)
                .map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#1A1A1A]">
                    {m.id} — {m.song} ({m.hoofdstuk})
                  </option>
                ))}
            </select>
          </div>
        </section>

        {/* Main 2-column Studio Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Accordions */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. ENTER CONTENT */}
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <button
                type="button"
                onClick={() => toggleSection('content')}
                className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold">
                    <Link2 className="w-4 h-4" />
                  </span>
                  <span className="font-serif text-lg text-white">1. Inhoud &amp; URL</span>
                </span>
                {openSections.content ? (
                  <ChevronUp className="w-5 h-5 text-earth-gold" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-earth-light/50" />
                )}
              </button>

              {openSections.content && (
                <div className="p-5 space-y-4 border-t border-white/5">
                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Jouw URL
                    </label>
                    <input
                      type="text"
                      value={config.url}
                      onChange={(e) => setConfig((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://paulvangeenen.nl/B03H26S4"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-earth-gold"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                      <span className="text-[11px] text-earth-light/40">
                        Standaard boek-formaat: <code className="text-earth-gold">https://paulvangeenen.nl/&#123;RedirectCode&#125;</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, url: 'https://paulvangeenen.nl/' }))}
                        className="text-[11px] text-earth-gold hover:underline cursor-pointer"
                      >
                        Vul basis-URL in
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. SET COLORS */}
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <button
                type="button"
                onClick={() => toggleSection('colors')}
                className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold">
                    <Palette className="w-4 h-4" />
                  </span>
                  <span className="font-serif text-lg text-white">2. Kleuren Instellen</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-mono text-earth-light/50">
                    <span className="w-3.5 h-3.5 rounded border border-white/20" style={{ backgroundColor: config.fgColor }} />
                    <span>/</span>
                    <span className="w-3.5 h-3.5 rounded border border-white/20" style={{ backgroundColor: config.bgColor }} />
                  </span>
                  {openSections.colors ? (
                    <ChevronUp className="w-5 h-5 text-earth-gold" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-earth-light/50" />
                  )}
                </span>
              </button>

              {openSections.colors && (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5">
                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Voorgrondkleur (Blokjes)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.fgColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, fgColor: e.target.value }))}
                        className="w-11 h-10 rounded-lg bg-black/40 border border-white/10 cursor-pointer p-1"
                      />
                      <input
                        type="text"
                        value={config.fgColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, fgColor: e.target.value }))}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm uppercase focus:outline-none focus:border-earth-gold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Achtergrondkleur
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.bgColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, bgColor: e.target.value }))}
                        className="w-11 h-10 rounded-lg bg-black/40 border border-white/10 cursor-pointer p-1"
                      />
                      <input
                        type="text"
                        value={config.bgColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, bgColor: e.target.value }))}
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white font-mono text-sm uppercase focus:outline-none focus:border-earth-gold"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. ADD LOGO IMAGE */}
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <button
                type="button"
                onClick={() => toggleSection('logo')}
                className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold">
                    <ImageIcon className="w-4 h-4" />
                  </span>
                  <span className="font-serif text-lg text-white">3. Logo Afbeelding (Midden)</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[11px] font-mono text-earth-gold">
                    {logoMode === 'none'
                      ? 'Uit'
                      : logoMode === 'custom'
                      ? 'Aangepast logo'
                      : activeBook?.qrLogo
                      ? 'Boeklogo actief'
                      : 'Geen boeklogo'}
                  </span>
                  {openSections.logo ? (
                    <ChevronUp className="w-5 h-5 text-earth-gold" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-earth-light/50" />
                  )}
                </span>
              </button>

              {openSections.logo && (
                <div className="p-5 space-y-4 border-t border-white/5">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-24 h-24 rounded-xl bg-white border border-white/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {effectiveLogo ? (
                        <img
                          src={effectiveLogo}
                          alt="Midden logo"
                          className="w-full h-full object-contain p-1.5"
                        />
                      ) : (
                        <span className="text-[11px] text-neutral-400 text-center px-2">
                          Geen logo
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-2.5 w-full">
                      <div className="flex flex-wrap gap-2">
                        <label className="inline-flex items-center gap-2 bg-earth-gold text-black font-bold px-3.5 py-2 rounded-lg text-xs hover:bg-earth-gold/90 transition-colors cursor-pointer">
                          <Upload className="w-3.5 h-3.5" />
                          Eigen Logo Uploaden
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleCustomLogoUpload}
                          />
                        </label>

                        {activeBook?.qrLogo && logoMode !== 'book' && (
                          <button
                            type="button"
                            onClick={() => setLogoMode('book')}
                            className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-earth-gold/30 text-earth-gold px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Gebruik Boeklogo
                          </button>
                        )}

                        {effectiveLogo && (
                          <button
                            type="button"
                            onClick={() => setLogoMode('none')}
                            className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Geen logo
                          </button>
                        )}
                      </div>

                      <p className="text-[11px] text-earth-light/50 leading-relaxed">
                        {activeBook
                          ? activeBook.qrLogo
                            ? `Opgeslagen logo van "${activeBook.boektitel}" wordt automatisch gebruikt.`
                            : `Er is nog geen standaard logo opgeslagen bij "${activeBook.boektitel}". Upload er een in Tab 'Boeken' of hier tijdelijk.`
                          : 'Selecteer een boek om het bijbehorende standaard logo te laden.'}
                      </p>
                    </div>
                  </div>

                  {effectiveLogo && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-earth-light/60 font-medium">Logo grootte</span>
                          <span className="font-mono text-earth-gold">
                            {Math.round(config.imageSize * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={20}
                          max={42}
                          step={1}
                          value={Math.round(config.imageSize * 100)}
                          onChange={(e) =>
                            setConfig((prev) => ({ ...prev, imageSize: Number(e.target.value) / 100 }))
                          }
                          className="w-full accent-earth-gold cursor-pointer"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-earth-light/60 font-medium">Witte rand rond logo</span>
                          <span className="font-mono text-earth-gold">
                            {(config.imageMarginRatio * 100).toFixed(1)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={30}
                          step={2}
                          value={Math.round(config.imageMarginRatio * 1000)}
                          onChange={(e) =>
                            setConfig((prev) => ({
                              ...prev,
                              imageMarginRatio: Number(e.target.value) / 1000,
                            }))
                          }
                          className="w-full accent-earth-gold cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. CUSTOMIZE DESIGN */}
            <div className="bg-[#1A1A1A] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
              <button
                type="button"
                onClick={() => toggleSection('design')}
                className="w-full flex items-center justify-between px-5 py-4 bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-left cursor-pointer"
              >
                <span className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-earth-gold/15 border border-earth-gold/30 flex items-center justify-center text-earth-gold">
                    <Sliders className="w-4 h-4" />
                  </span>
                  <span className="font-serif text-lg text-white">4. Ontwerp Aanpassen</span>
                </span>
                {openSections.design ? (
                  <ChevronUp className="w-5 h-5 text-earth-gold" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-earth-light/50" />
                )}
              </button>

              {openSections.design && (
                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5">
                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Module Vorm (Blokjes)
                    </label>
                    <select
                      value={config.dotType}
                      onChange={(e) =>
                        setConfig((prev) => ({ ...prev, dotType: e.target.value as DotType }))
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold"
                    >
                      <option value="square">Vierkant (Boek-standaard)</option>
                      <option value="rounded">Licht afgerond</option>
                      <option value="dots">Stippen</option>
                      <option value="classy">Klassiek</option>
                      <option value="classy-rounded">Klassiek afgerond</option>
                      <option value="extra-rounded">Extra afgerond</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Hoekogen Buitenrand
                    </label>
                    <select
                      value={config.cornerSquareType}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cornerSquareType: e.target.value as CornerSquareType,
                        }))
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold"
                    >
                      <option value="square">Vierkant (Boek-standaard)</option>
                      <option value="extra-rounded">Afgerond</option>
                      <option value="dot">Cirkel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Hoekogen Kern
                    </label>
                    <select
                      value={config.cornerDotType}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          cornerDotType: e.target.value as CornerDotType,
                        }))
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold"
                    >
                      <option value="square">Vierkant (Boek-standaard)</option>
                      <option value="dot">Rond</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-earth-light/50 text-xs font-bold uppercase tracking-wider mb-2">
                      Foutcorrectie (ECC)
                    </label>
                    <select
                      value={config.errorCorrectionLevel}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          errorCorrectionLevel: e.target.value as ErrorCorrectionLevel,
                        }))
                      }
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-earth-gold"
                    >
                      <option value="H">H — Hoog 30% (Boek-standaard bij logo)</option>
                      <option value="Q">Q — Kwartiel 25%</option>
                      <option value="M">M — Medium 15%</option>
                      <option value="L">L — Laag 7%</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-earth-light/60 font-medium">
                        Buitenmarge (Quiet Zone)
                      </span>
                      <span className="font-mono text-earth-gold">
                        {(config.quietZoneRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={10}
                      step={1}
                      value={Math.round(config.quietZoneRatio * 100)}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          quietZoneRatio: Number(e.target.value) / 100,
                        }))
                      }
                      className="w-full accent-earth-gold cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Preview, Quality & Downloads */}
          <div className="lg:col-span-5 lg:sticky lg:top-8 bg-[#1A1A1A] border border-white/10 rounded-2xl p-6 space-y-5 shadow-2xl">
            {/* QR Preview Box */}
            <div className="bg-white rounded-xl p-4 flex items-center justify-center aspect-square max-w-[320px] mx-auto shadow-inner border border-white/20">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Live QR-code voorbeeld"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-neutral-400 text-sm flex flex-col items-center gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-neutral-500" />
                  <span>QR genereren...</span>
                </div>
              )}
            </div>

            {/* Live jsQR Scan Check */}
            <div
              className={cn(
                'rounded-xl px-4 py-3 border text-xs flex items-start gap-2.5',
                scanCheck.status === 'ok'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : scanCheck.status === 'warn'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-white/5 border-white/10 text-earth-light/60'
              )}
            >
              {scanCheck.status === 'ok' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              ) : scanCheck.status === 'warn' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              ) : (
                <RefreshCw className="w-4 h-4 shrink-0 mt-0.5 animate-spin text-earth-gold" />
              )}
              <div className="min-w-0 flex-1">
                {scanCheck.status === 'ok' && (
                  <>
                    <div className="font-bold">Scan-verificatie geslaagd</div>
                    <div className="font-mono text-[11px] truncate opacity-85">
                      {scanCheck.decoded}
                    </div>
                  </>
                )}
                {scanCheck.status === 'warn' && (
                  <>
                    <div className="font-bold">Let op: moeilijk scanbaar in simulatie</div>
                    <div className="opacity-85">
                      Verklein het logo iets of kies foutcorrectie H met hoog contrast.
                    </div>
                  </>
                )}
                {scanCheck.status === 'checking' && <div>Scanbaarheid controleren...</div>}
              </div>
            </div>

            {/* Quality Slider */}
            <div className="space-y-2 pt-1">
              <input
                type="range"
                min={200}
                max={2400}
                step={2}
                value={config.size}
                onChange={(e) => setConfig((prev) => ({ ...prev, size: Number(e.target.value) }))}
                className="w-full accent-earth-gold cursor-pointer"
              />
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="text-earth-light/40">Lage kwaliteit</span>
                <button
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, size: 246 }))}
                  className="font-mono font-bold text-earth-gold hover:underline cursor-pointer"
                  title="Klik om terug te zetten naar 246 x 246 Px (boek-standaard)"
                >
                  {config.size} x {config.size} Px
                </button>
                <span className="text-earth-light/40">Drukwerk (hoog)</span>
              </div>
            </div>

            {/* Action & Download Buttons */}
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => regeneratePreview(effectiveConfig)}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-earth-gold" />
                  QR Verversen
                </button>
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload('png')}
                  className="flex items-center justify-center gap-2 bg-earth-gold hover:bg-earth-gold/90 text-black font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-earth-gold/15 disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {downloadingFormat === 'png' ? 'Bezig...' : 'Download PNG'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload('svg')}
                  className="flex items-center justify-center gap-2 bg-black/40 hover:bg-earth-gold/10 border border-earth-gold/30 hover:border-earth-gold text-earth-gold font-mono font-bold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingFormat === 'svg' ? 'Bezig...' : '.SVG (Vector Drukwerk)'}
                </button>
                <button
                  type="button"
                  disabled={downloadingFormat !== null}
                  onClick={() => handleDownload('pdf')}
                  className="flex items-center justify-center gap-2 bg-black/40 hover:bg-earth-gold/10 border border-earth-gold/30 hover:border-earth-gold text-earth-gold font-mono font-bold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingFormat === 'pdf' ? 'Bezig...' : '.PDF (100×100 mm)'}
                </button>
              </div>

              {matchedMapping && (
                <button
                  type="button"
                  disabled={savingToMapping}
                  onClick={handleSaveToMapping}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold py-2.5 px-4 rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingToMapping
                    ? 'Opslaan...'
                    : `Sla QR-preview op bij Redirect ${matchedMapping.id}`}
                </button>
              )}

              {saveToast && (
                <p className="text-emerald-400 text-xs text-center font-medium">{saveToast}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
