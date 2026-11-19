import React, { useState, useEffect, useRef } from 'react';
import {
  Facebook,
  Instagram,
  Send,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
  Sparkles,
  Copy,
  ExternalLink,
  Trash2,
  FolderOpen,
  Layers,
  Settings,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Save
} from 'lucide-react';
import { FileManager, StorageItem } from './FileManager';

interface SocialConfigStatus {
  facebook: boolean;
  instagram: boolean;
  fbPageId?: string;
  igUserId?: string;
  fbPageName?: string;
  hasToken?: boolean;
}

interface SocialPostRecord {
  id: string;
  message: string;
  imageUrl?: string;
  imageUrls?: string[];
  platforms: ('facebook' | 'instagram')[];
  status: 'published' | 'queued' | 'partial' | 'error';
  results?: Record<string, any>;
  createdAt: string;
}

interface SelectedMedia {
  id: string;
  file?: File;
  url: string;
  name: string;
  source: 'upload' | 'storage';
}

export function SocialComposer() {
  const [message, setMessage] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<{ facebook: boolean; instagram: boolean }>({
    facebook: true,
    instagram: false,
  });
  const [configured, setConfigured] = useState<SocialConfigStatus>({
    facebook: false,
    instagram: false,
    fbPageName: 'Paul van Geenen - Schrijver & Componist',
  });
  const [posts, setPosts] = useState<SocialPostRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showSetupPanel, setShowSetupPanel] = useState(false);

  // Instellingen voor Schrijvers-Facebookpagina
  const [fbPageNameInput, setFbPageNameInput] = useState('Paul van Geenen - Schrijver & Componist');
  const [fbPageIdInput, setFbPageIdInput] = useState('');
  const [igUserIdInput, setIgUserIdInput] = useState('');
  const [metaTokenInput, setMetaTokenInput] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = async () => {
    try {
      const res = await fetch('/api/social_post.php');
      if (!res.ok) return;
      const data = await res.json();
      if (data.configured) {
        setConfigured(data.configured);
        if (data.configured.fbPageId) setFbPageIdInput(data.configured.fbPageId);
        if (data.configured.igUserId) setIgUserIdInput(data.configured.igUserId);
        if (data.configured.fbPageName) setFbPageNameInput(data.configured.fbPageName);
      }
      if (Array.isArray(data.posts)) setPosts(data.posts);
    } catch {
      // Negeer netwerkfout bij initieel laden
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/social_post.php?action=save_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fbPageName: fbPageNameInput.trim(),
          fbPageId: fbPageIdInput.trim(),
          igUserId: igUserIdInput.trim(),
          ...(metaTokenInput.trim() ? { metaToken: metaTokenInput.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMetaTokenInput('');
        setFeedback({
          type: 'success',
          text: 'Koppeling voor je Schrijvers-Facebookpagina is opgeslagen in de database!',
        });
        await loadPosts();
      } else {
        setFeedback({ type: 'error', text: data.error || 'Kon instellingen niet opslaan.' });
      }
    } catch {
      setFeedback({ type: 'error', text: 'Netwerkfout bij opslaan van instellingen.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: SelectedMedia[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      newItems.push({
        id: `upload_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        file: f,
        url: URL.createObjectURL(f),
        name: f.name,
        source: 'upload',
      });
    }

    setSelectedMedia((prev) => [...prev, ...newItems]);
    setFeedback(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleLibrarySelect = (items: StorageItem[]) => {
    const newItems: SelectedMedia[] = items.map((item, idx) => ({
      id: `storage_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      url: item.url || '',
      name: item.name,
      source: 'storage',
    }));

    setSelectedMedia((prev) => {
      const existingUrls = new Set(prev.map((p) => p.url));
      const filtered = newItems.filter((n) => !existingUrls.has(n.url));
      return [...prev, ...filtered];
    });

    setIsLibraryOpen(false);
    setFeedback(null);
  };

  const removeMediaItem = (id: string) => {
    setSelectedMedia((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item?.file && item.url) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const clearAllMedia = () => {
    selectedMedia.forEach((m) => {
      if (m.file && m.url) URL.revokeObjectURL(m.url);
    });
    setSelectedMedia([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePlatform = (key: 'facebook' | 'instagram') => {
    setSelectedPlatforms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const appendHashtags = () => {
    const tags = '#PaulVanGeenen #DeGeboorteVanDeLeeuw #DeEcho #LionBooks #Roman #Soundtrack';
    if (!message.includes('#PaulVanGeenen')) {
      setMessage((prev) => (prev.trim() ? `${prev.trim()}\n\n${tags}` : tags));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const platforms = (['facebook', 'instagram'] as const).filter((p) => selectedPlatforms[p]);
    if (platforms.length === 0) {
      setFeedback({ type: 'error', text: 'Vink eerst minimaal één kanaal aan (Facebook of Instagram).' });
      return;
    }
    if (!message.trim() && selectedMedia.length === 0) {
      setFeedback({ type: 'error', text: 'Typ eerst een bericht of kies minimaal één foto.' });
      return;
    }
    if (selectedPlatforms.instagram && selectedMedia.length === 0) {
      setFeedback({ type: 'error', text: 'Voor Instagram moet je altijd minimaal één foto kiezen.' });
      return;
    }
    if (selectedPlatforms.instagram && selectedMedia.length > 10) {
      setFeedback({ type: 'error', text: "Instagram ondersteunt maximaal 10 foto's in één carrousel." });
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('message', message.trim());
      formData.append('platforms', JSON.stringify(platforms));

      const uploadFiles = selectedMedia.filter((m) => m.file).map((m) => m.file as File);
      uploadFiles.forEach((file) => {
        formData.append('images[]', file);
      });

      const libraryUrls = selectedMedia.filter((m) => !m.file && m.url).map((m) => m.url);
      if (libraryUrls.length > 0) {
        formData.append('imageUrls', JSON.stringify(libraryUrls));
      }

      const res = await fetch('/api/social_post.php', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: 'error', text: data.error || 'Plaatsen mislukt.' });
        return;
      }

      const status = data.post?.status;
      if (status === 'published') {
        const countText = selectedMedia.length > 1 ? `met ${selectedMedia.length} foto's (als album/carrousel)` : '';
        setFeedback({
          type: 'success',
          text: `Gelukt! Je bericht ${countText} is direct geplaatst op je Schrijvers-Facebookpagina!`,
        });
        setMessage('');
        clearAllMedia();
      } else if (status === 'queued') {
        setFeedback({
          type: 'warning',
          text: "Bericht & foto('s) zijn opgeslagen in de wachtrij (koppel hierboven je Schrijvers-Facebook Page ID & Meta Token om direct live te plaatsen).",
        });
        setMessage('');
        clearAllMedia();
      } else if (status === 'partial') {
        setFeedback({
          type: 'warning',
          text: 'Gedeeltelijk geplaatst. Controleer het resultaat hieronder bij Recente berichten.',
        });
      } else {
        const firstErr = Object.values(data.results || {})
          .map((r: any) => (r as any)?.message)
          .filter(Boolean)
          .join(' | ');
        setFeedback({ type: 'error', text: firstErr || 'Er ging iets mis bij het doorzetten.' });
      }

      await loadPosts();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Netwerkfout bij versturen.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      const res = await fetch(`/api/social_post.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch {
      // Negeer
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Uitleg + Koppeling voor Facebook Schrijverspagina naast persoonlijk profiel */}
      <div className="bg-[#161412] border border-earth-gold/30 rounded-3xl p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-white font-serif font-bold text-base flex items-center gap-2">
                <span>Facebook als Schrijver ({configured.fbPageName || 'Paul van Geenen'})</span>
              </h3>
              <p className="text-xs text-earth-light/70 mt-0.5 leading-relaxed">
                Op Facebook maak je een <strong className="text-white">Schrijverspagina (Auteur)</strong> aan onder je bestaande persoonlijke account. Je houdt dus gewoon één login, maar publiceert hier vanuit je website direct onder je auteursnaam.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowSetupPanel((prev) => !prev)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-mono font-bold text-earth-gold flex items-center gap-2 self-start sm:self-center shrink-0 cursor-pointer"
          >
            <Settings size={14} />
            <span>{showSetupPanel ? 'Sluit Koppeling & Stappenplan' : 'Stappenplan & Pagina Koppelen'}</span>
            {showSetupPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {showSetupPanel && (
          <div className="mt-5 pt-5 border-t border-white/10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3 text-xs text-earth-light/80 bg-black/35 p-4 rounded-2xl border border-white/10">
              <h4 className="font-bold text-earth-gold uppercase tracking-wider font-mono text-[11px]">
                In 3 stappen een Facebook-pagina als Schrijver:
              </h4>
              <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                <li>
                  Ga (ingelogd op je persoonlijke Facebook) naar{' '}
                  <a
                    href="https://www.facebook.com/pages/create/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline font-bold"
                  >
                    facebook.com/pages/create
                  </a>
                  .
                </li>
                <li>
                  Kies als paginanaam bijv. <strong className="text-white">Paul van Geenen - Schrijver &amp; Componist</strong> (of <strong className="text-white">Paul van Geenen - Auteur</strong>) en als categorie <strong className="text-white">Auteur / Schrijver</strong>.
                </li>
                <li>
                  Koppel de pagina aan je Meta App (net als bij <em>Queens &amp; Ko</em>) en vul hiernaast het <strong className="text-white">Facebook Page ID</strong> en <strong className="text-white">Permanent Page Access Token</strong> in.
                </li>
              </ol>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-3 bg-black/35 p-4 rounded-2xl border border-white/10">
              <h4 className="font-bold text-white uppercase tracking-wider font-mono text-[11px]">
                Koppelgegevens Schrijverspagina
              </h4>
              <div>
                <label className="block text-[11px] font-mono text-white/60 mb-1">Weergavenaam Schrijverspagina:</label>
                <input
                  type="text"
                  value={fbPageNameInput}
                  onChange={(e) => setFbPageNameInput(e.target.value)}
                  placeholder="Paul van Geenen - Schrijver & Componist"
                  className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-earth-gold"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-white/60 mb-1">Facebook Page ID:</label>
                  <input
                    type="text"
                    value={fbPageIdInput}
                    onChange={(e) => setFbPageIdInput(e.target.value)}
                    placeholder="Bijv. 104829384756..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-earth-gold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-white/60 mb-1">Instagram User ID (optioneel):</label>
                  <input
                    type="text"
                    value={igUserIdInput}
                    onChange={(e) => setIgUserIdInput(e.target.value)}
                    placeholder="Bijv. 1784140..."
                    className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-earth-gold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-white/60 mb-1">
                  Meta Page Access Token {configured.hasToken && <span className="text-emerald-400">(Al ingesteld — laat leeg om te behouden)</span>}:
                </label>
                <input
                  type="password"
                  value={metaTokenInput}
                  onChange={(e) => setMetaTokenInput(e.target.value)}
                  placeholder={configured.hasToken ? '••••••••••••••••••••••••' : 'Plak hier je permanente Meta Page Access Token (EAA...)'}
                  className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:border-earth-gold"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-earth-gold hover:bg-amber-400 text-black font-bold text-xs font-mono rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Save size={13} />
                  <span>{savingConfig ? 'Opslaan...' : 'Koppeling Opslaan'}</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Main Composer Card */}
      <form
        onSubmit={handleSubmit}
        className="p-6 md:p-8 bg-[#161412] border border-white/10 rounded-3xl space-y-6 relative overflow-hidden shadow-2xl"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-5 relative z-10">
          <div>
            <h3 className="text-earth-gold text-lg font-bold font-serif flex items-center gap-2">
              Bericht &amp; Foto&apos;s Publiceren als Schrijver
            </h3>
            <p className="text-xs text-earth-light/65 font-mono mt-0.5">
              Plaats rechtstreeks op je auteurs-Facebookpagina ({configured.fbPageName || 'Paul van Geenen'}) en eventueel Instagram.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px]">
            <span
              className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                configured.facebook
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <Facebook size={12} />
              {configured.facebook ? 'FB Schrijver Actief' : 'FB Stand-by'}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                configured.instagram
                  ? 'bg-pink-500/10 border-pink-500/30 text-pink-400'
                  : 'bg-white/5 border-white/10 text-white/50'
              }`}
            >
              <Instagram size={12} />
              {configured.instagram ? 'IG Actief' : 'IG Stand-by'}
            </span>
          </div>
        </div>

        {/* Stap 1: Berichttekst */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider font-mono">
              1. Berichttekst
            </label>
            <button
              type="button"
              onClick={appendHashtags}
              className="text-[10px] font-mono text-earth-gold hover:text-white flex items-center gap-1 px-2.5 py-1 bg-earth-gold/10 rounded-lg border border-earth-gold/25 transition-colors cursor-pointer"
            >
              <Sparkles size={11} /> + Boek-hashtags toevoegen
            </button>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Bijv.: Het binnenwerk van 'De Geboorte van de Leeuw' (386 pagina's) is goedgekeurd door de drukker! 🦁📖🎵"
            className="w-full bg-black/40 border border-white/15 focus:border-earth-gold rounded-2xl p-4 text-sm text-white placeholder:text-white/35 outline-none transition-colors resize-y"
          />
        </div>

        {/* Stap 2: Foto's toevoegen */}
        <div className="space-y-3 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <label className="text-xs font-bold text-white/80 uppercase tracking-wider font-mono block">
              2. Foto(&apos;s) toevoegen {selectedPlatforms.instagram && <span className="text-pink-400">(verplicht voor Instagram)</span>}
            </label>
            {selectedMedia.length > 0 && (
              <button
                type="button"
                onClick={clearAllMedia}
                className="text-[10px] font-mono text-white/50 hover:text-red-400 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
              >
                <X size={12} /> Alles wissen
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-4 border-2 border-dashed border-white/15 hover:border-earth-gold/60 rounded-2xl bg-black/30 hover:bg-black/50 transition-all flex items-center gap-3 text-white/80 hover:text-white group text-left cursor-pointer"
            >
              <div className="p-2.5 bg-white/10 group-hover:bg-earth-gold/20 text-white/60 group-hover:text-earth-gold rounded-xl transition-colors shrink-0">
                <ImageIcon size={20} />
              </div>
              <div>
                <p className="text-xs font-bold font-mono">Upload foto(&apos;s)</p>
                <p className="text-[10px] text-white/45 mt-0.5">Vanaf je computer of telefoon (meerdere mogelijk)</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsLibraryOpen(true)}
              className="p-4 border border-white/15 hover:border-earth-gold/60 rounded-2xl bg-black/35 hover:bg-black/55 transition-all flex items-center gap-3 text-white/80 hover:text-white group text-left cursor-pointer"
            >
              <div className="p-2.5 bg-earth-gold/15 text-earth-gold rounded-xl transition-colors shrink-0">
                <FolderOpen size={20} />
              </div>
              <div>
                <p className="text-xs font-bold font-mono">Kies uit Bestandsbeheer</p>
                <p className="text-[10px] text-white/45 mt-0.5">Kies uit je mappen &amp; boekfoto&apos;s op de server</p>
              </div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFilesUpload}
              className="hidden"
            />
          </div>

          {selectedMedia.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs font-mono">
                {selectedMedia.length > 1 ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-earth-gold/15 border border-earth-gold/30 text-earth-gold font-bold">
                    <Layers size={13} /> {selectedMedia.length} foto&apos;s geselecteerd: Wordt als Album op FB en Carrousel op IG geplaatst!
                  </span>
                ) : (
                  <span className="text-white/60">1 foto geselecteerd</span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
                {selectedMedia.map((media, index) => (
                  <div
                    key={media.id}
                    className="relative group rounded-2xl overflow-hidden border border-white/15 bg-black/40 aspect-square shadow-lg"
                  >
                    <img
                      src={media.url}
                      alt={media.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-sm text-[10px] font-mono font-bold text-earth-gold border border-earth-gold/30">
                      #{index + 1}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMediaItem(media.id)}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-red-600 text-white rounded-xl transition-colors shadow-md cursor-pointer"
                      title="Verwijder foto"
                    >
                      <X size={13} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-2 text-[10px] font-mono text-white/80 truncate">
                      {media.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stap 3: Kanalen kiezen */}
        <div className="space-y-2 relative z-10">
          <label className="text-xs font-bold text-white/80 uppercase tracking-wider font-mono block">
            3. Kies waar je het wilt plaatsen
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => togglePlatform('facebook')}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                selectedPlatforms.facebook
                  ? 'bg-blue-600/15 border-blue-500 text-white'
                  : 'bg-black/35 border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-3">
                <Facebook size={22} className={selectedPlatforms.facebook ? 'text-blue-400' : 'text-white/40'} />
                <div className="text-left">
                  <div className="text-sm font-bold">Facebook Schrijverspagina</div>
                  <div className="text-[10px] text-white/55">{configured.fbPageName || 'Paul van Geenen - Schrijver'}</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                  selectedPlatforms.facebook ? 'bg-blue-500 border-blue-400 text-white' : 'border-white/25'
                }`}
              >
                {selectedPlatforms.facebook && <Check size={13} />}
              </div>
            </button>

            <button
              type="button"
              onClick={() => togglePlatform('instagram')}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                selectedPlatforms.instagram
                  ? 'bg-pink-600/15 border-pink-500 text-white'
                  : 'bg-black/35 border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              <div className="flex items-center gap-3">
                <Instagram size={22} className={selectedPlatforms.instagram ? 'text-pink-400' : 'text-white/40'} />
                <div className="text-left">
                  <div className="text-sm font-bold">Instagram</div>
                  <div className="text-[10px] text-white/55">Auteursprofiel</div>
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                  selectedPlatforms.instagram ? 'bg-pink-500 border-pink-400 text-white' : 'border-white/25'
                }`}
              >
                {selectedPlatforms.instagram && <Check size={13} />}
              </div>
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-2xl border text-xs flex items-start gap-2.5 relative z-10 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : feedback.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : feedback.type === 'warning' ? (
              <Clock size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 bg-earth-gold hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg relative z-10 cursor-pointer"
        >
          <Send size={16} />
          {isSubmitting
            ? 'Bezig met plaatsen op socials...'
            : `Plaats op aangevinkte socials ${selectedMedia.length > 1 ? `(${selectedMedia.length} foto's)` : ''}`}
        </button>
      </form>

      {/* Recente berichten / wachtrij */}
      {posts.length > 0 && (
        <div className="p-6 bg-[#161412] border border-white/10 rounded-3xl space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Recente Social Berichten ({posts.length})
          </h4>
          <div className="space-y-3">
            {posts.map((post) => {
              const displayImages =
                post.imageUrls && post.imageUrls.length > 0
                  ? post.imageUrls
                  : post.imageUrl
                  ? [post.imageUrl]
                  : [];
              return (
                <div
                  key={post.id}
                  className="p-4 bg-black/35 border border-white/10 rounded-2xl flex flex-col sm:flex-row gap-4 justify-between"
                >
                  <div className="flex gap-4 min-w-0">
                    {displayImages.length > 0 && (
                      <div className="flex gap-1.5 shrink-0">
                        {displayImages.slice(0, 3).map((imgUrl, i) => (
                          <img
                            key={i}
                            src={imgUrl}
                            alt=""
                            className="w-16 h-16 rounded-xl object-cover border border-white/15"
                          />
                        ))}
                        {displayImages.length > 3 && (
                          <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-xs font-mono text-earth-gold font-bold">
                            +{displayImages.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            post.status === 'published'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : post.status === 'queued'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {post.status === 'published'
                            ? 'Geplaatst'
                            : post.status === 'queued'
                            ? 'Klaargezet'
                            : post.status === 'partial'
                            ? 'Gedeeltelijk'
                            : 'Fout'}
                        </span>
                        {post.platforms.map((pl) => (
                          <span key={pl} className="text-[10px] font-mono text-white/50 uppercase">
                            • {pl}
                          </span>
                        ))}
                        <span className="text-[10px] font-mono text-white/40">
                          {new Date(post.createdAt).toLocaleString('nl-NL')}
                        </span>
                      </div>
                      <p className="text-xs text-white/90 whitespace-pre-line break-words">{post.message}</p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
                    {post.results?.facebook?.postId && (
                      <a
                        href={`https://www.facebook.com/${post.results.facebook.postId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/25 text-[11px] font-mono rounded-xl transition-all flex items-center gap-1.5"
                      >
                        <ExternalLink size={12} />
                        <span>Bekijk op Facebook</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyText(post.id, post.message)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-white/80 text-[11px] font-mono rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>{copiedId === post.id ? 'Gekopieerd!' : 'Kopieer'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePost(post.id)}
                      className="p-1.5 text-white/45 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                      title="Verwijder uit overzicht"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL: Mediabibliotheek Picker */}
      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col">
            <FileManager
              mode="picker"
              multiSelect={true}
              onSelect={handleLibrarySelect}
              onClose={() => setIsLibraryOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
