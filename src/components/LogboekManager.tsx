import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Trash2, Edit3, Save, X, Image as ImageIcon,
  Upload, Loader2, Calendar, CheckCircle2, AlertCircle, Volume2, VolumeX, KeyRound, Sparkles, RotateCcw
} from 'lucide-react';
import {
  LogboekEntry,
  fetchLogboekWithCover,
  saveLogboekEntry,
  saveLogboekCover,
  deleteLogboekEntry,
  uploadLogboekPhoto,
  uploadLogboekAudio,
  formatLogboekDatum,
  openLogboekOverlay,
} from '../lib/logboek';
import logboekCoverRed from '../assets/images/logboek-cover-red.jpg';
import {
  generateLogboekMp3DataUrl,
  getSavedGeminiTtsKey,
  saveGeminiTtsKey,
} from '../lib/logboekTts';
import { cn } from '../lib/utils';

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function LogboekManager() {
  const [entries, setEntries] = useState<LogboekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [datum, setDatum] = useState<string>(() => getTodayIso());
  const [foto, setFoto] = useState<string>('');
  const [tekst, setTekst] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [autoGenerateOnSave, setAutoGenerateOnSave] = useState<boolean>(true);
  const [geminiKey, setGeminiKey] = useState<string>(() => getSavedGeminiTtsKey());
  const [coverImage, setCoverImage] = useState<string>('');
  const [savingCover, setSavingCover] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchLogboekWithCover();
      setEntries(data.entries);
      setCoverImage(data.coverImage || '');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kon logboek niet laden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showStatus = (msg: string) => {
    setStatusMsg(msg);
    window.setTimeout(() => setStatusMsg(null), 5000);
  };

  const resetForm = () => {
    setEditingId(null);
    setDatum(getTodayIso());
    setFoto('');
    setTekst('');
    setAudioUrl('');
    setAudioEnabled(true);
  };

  const handleFileOrBlob = async (file: Blob) => {
    setUploadingPhoto(true);
    setErrorMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Kon bestand niet lezen.'));
        reader.readAsDataURL(file);
      });
      const uploadedUrl = await uploadLogboekPhoto(dataUrl);
      setFoto(uploadedUrl);
      showStatus('Foto geüpload naar /images/logboek!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Foto uploaden mislukt.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAudioFileUpload = async (file: File) => {
    setGeneratingAudio(true);
    setErrorMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Kon audiobestand niet lezen.'));
        reader.readAsDataURL(file);
      });
      const uploadedUrl = await uploadLogboekAudio(dataUrl);
      setAudioUrl(uploadedUrl);
      showStatus('MP3 geüpload naar /audio/logboek!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'MP3 uploaden mislukt.');
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleGenerateMp3 = async (targetDatum: string, targetTekst: string): Promise<string | null> => {
    if (!geminiKey.trim()) {
      throw new Error('Vul eerst hieronder je Gemini API-sleutel in om automatisch een mannenstem-MP3 te maken.');
    }
    setGeneratingAudio(true);
    try {
      const mp3DataUrl = await generateLogboekMp3DataUrl(targetDatum, targetTekst, geminiKey);
      const uploadedUrl = await uploadLogboekAudio(mp3DataUrl);
      setAudioUrl(uploadedUrl);
      return uploadedUrl;
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const blob = items[i].getAsFile();
        if (blob) {
          e.preventDefault();
          await handleFileOrBlob(blob);
          return;
        }
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datum.trim() || !tekst.trim()) {
      setErrorMsg('Vul zowel een datum als een korte notitie in.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      let finalAudioUrl = audioUrl.trim() || null;

      if (autoGenerateOnSave && geminiKey.trim() && (!finalAudioUrl || editingId !== null)) {
        try {
          finalAudioUrl = await handleGenerateMp3(datum.trim(), tekst.trim());
        } catch (ttsErr: any) {
          setErrorMsg(`Notitie wordt opgeslagen, maar MP3 genereren mislukte: ${ttsErr?.message || ttsErr}`);
        }
      }

      await saveLogboekEntry({
        id: editingId ?? undefined,
        datum: datum.trim(),
        foto: foto.trim() || null,
        tekst: tekst.trim(),
        audio_url: finalAudioUrl,
        audio_enabled: audioEnabled,
      });
      showStatus(
        finalAudioUrl
          ? 'Notitie + mannenstem-MP3 opgeslagen!'
          : editingId
            ? 'Notitie bijgewerkt!'
            : 'Nieuwe logboek-notitie toegevoegd!'
      );
      resetForm();
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEntryAudio = async (entry: LogboekEntry) => {
    setErrorMsg(null);
    try {
      const next = !entry.audio_enabled;
      await saveLogboekEntry({
        id: entry.id,
        datum: entry.datum,
        foto: entry.foto || null,
        tekst: entry.tekst,
        audio_url: entry.audio_url || null,
        audio_enabled: next,
      });
      showStatus(next ? `Audio AAN gezet voor ${formatLogboekDatum(entry.datum)}.` : `Audio UIT gezet voor ${formatLogboekDatum(entry.datum)}.`);
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Kon audio-instelling niet wijzigen.');
    }
  };

  const handleEdit = (entry: LogboekEntry) => {
    setEditingId(entry.id);
    setDatum(entry.datum);
    setFoto(entry.foto || '');
    setTekst(entry.tekst);
    setAudioUrl(entry.audio_url || '');
    setAudioEnabled(entry.audio_enabled);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Weet je zeker dat je deze logboek-notitie wilt verwijderen?')) return;
    setErrorMsg(null);
    try {
      await deleteLogboekEntry(id);
      if (editingId === id) resetForm();
      showStatus('Notitie verwijderd.');
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verwijderen mislukt.');
    }
  };

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#7c2218]/30 border border-[#a83829]/40 text-amber-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-white">Logboek Beheer</h2>
            <p className="text-xs text-earth-light/65">
              Korte, gedateerde notities (nieuwste eerst). Plak een foto met Ctrl+V of upload er een, en laat automatisch een mannenstem-MP3 inspreken.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openLogboekOverlay(0)}
          className="px-4 py-2 rounded-xl bg-[#7c2218] hover:bg-[#962b1f] text-amber-50 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border border-[#a83829]/50"
        >
          <BookOpen className="w-4 h-4" />
          <span>Bekijk Open Logboek</span>
        </button>
      </div>

      <div className="bg-[#181818] border border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-earth-gold shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-white">Automatische Mannenstem MP3 (Gemini TTS)</div>
            <p className="text-xs text-earth-light/65">
              Bij opslaan leest een rustige mannenstem eerst de datum voor, wacht even, en leest daarna het bericht voor als MP3.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 min-w-[280px]">
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => {
              setGeminiKey(e.target.value);
              saveGeminiTtsKey(e.target.value);
            }}
            placeholder="Gemini API-sleutel (lokaal bewaard)"
            className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-earth-gold"
          />
        </div>
      </div>

      {/* Omslagafbeelding van het Logboek zelf wijzigen */}
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={coverImage || logboekCoverRed}
            alt="Logboek omslag"
            className="w-16 h-16 rounded-xl object-cover border border-white/15 shrink-0"
          />
          <div>
            <div className="text-sm font-bold text-white">Omslagafbeelding van het Logboek</div>
            <p className="text-xs text-earth-light/65">
              {coverImage ? 'Aangepaste omslagfoto actief.' : 'Standaard rode leren logboek-kaft actief.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/15">
            {savingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Wijzig Omslagfoto</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSavingCover(true);
                setErrorMsg(null);
                try {
                  const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(String(reader.result || ''));
                    reader.onerror = () => reject(new Error('Kon bestand niet lezen.'));
                    reader.readAsDataURL(file);
                  });
                  const uploadedUrl = await uploadLogboekPhoto(dataUrl);
                  await saveLogboekCover(uploadedUrl);
                  setCoverImage(uploadedUrl);
                  showStatus('Logboek omslagafbeelding bijgewerkt!');
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Kon omslagafbeelding niet wijzigen.');
                } finally {
                  setSavingCover(false);
                }
              }}
            />
          </label>
          {coverImage && (
            <button
              type="button"
              disabled={savingCover}
              onClick={async () => {
                setSavingCover(true);
                setErrorMsg(null);
                try {
                  await saveLogboekCover(null);
                  setCoverImage('');
                  showStatus('Standaard rode leren kaft hersteld!');
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Kon standaard kaft niet herstellen.');
                } finally {
                  setSavingCover(false);
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-400/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Herstel Rode Kaft</span>
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-200 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-[#181818] border border-white/10 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            {editingId ? <Edit3 className="w-4 h-4 text-earth-gold" /> : <Plus className="w-4 h-4 text-earth-gold" />}
            <span>{editingId ? `Notitie #${editingId} bewerken` : 'Nieuwe Logboek-Notitie'}</span>
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-earth-light/60 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Annuleren</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-earth-light/70 mb-1.5">
              Datum
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-earth-gold/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-earth-gold"
              />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-mono uppercase tracking-wider text-earth-light/70 mb-1.5">
              Foto (optioneel — upload, plak met Ctrl+V of plak URL)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={foto}
                onChange={(e) => setFoto(e.target.value)}
                placeholder="/images/logboek/... of laat leeg"
                className="flex-1 bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-earth-gold"
              />
              <label className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-2 cursor-pointer border border-white/15 shrink-0">
                {uploadingPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileOrBlob(f);
                  }}
                />
              </label>
              {foto && (
                <button
                  type="button"
                  onClick={() => setFoto('')}
                  className="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs cursor-pointer border border-red-500/30"
                  title="Foto weghalen"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {foto && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
            <img src={foto} alt="Preview" className="w-20 h-16 object-cover rounded-lg border border-white/15" />
            <span className="text-xs text-earth-light/70 truncate">{foto}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-earth-light/70 mb-1.5">
            Notitie (korte vluchtige gedachte, upload, testdruk...)
          </label>
          <textarea
            rows={4}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            required
            placeholder="Schrijf hier een korte aantekening..."
            className="w-full bg-black/40 border border-white/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-earth-gold"
          />
        </div>

        <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => setAudioEnabled(e.target.checked)}
                className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
              />
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-stone-400" />}
                MP3 afspelen bij dit bericht ({audioEnabled ? 'AAN' : 'UIT'})
              </span>
            </label>

            <label className="flex items-center gap-2 text-xs text-earth-light/75 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoGenerateOnSave}
                onChange={(e) => setAutoGenerateOnSave(e.target.checked)}
                className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
              />
              <span>Bij opslaan automatisch mannenstem-MP3 genereren</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="/audio/logboek/... (wordt automatisch ingevuld bij MP3-generatie)"
              className="flex-1 min-w-[200px] bg-black/40 border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-earth-gold"
            />
            <button
              type="button"
              disabled={generatingAudio || !tekst.trim()}
              onClick={async () => {
                setErrorMsg(null);
                try {
                  await handleGenerateMp3(datum, tekst);
                  showStatus('Mannenstem-MP3 gegenereerd en geüpload!');
                } catch (err: any) {
                  setErrorMsg(err?.message || 'Kon MP3 niet genereren.');
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              {generatingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Genereer MP3 nu</span>
            </button>
            <label className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-white/15">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload MP3</span>
              <input
                type="file"
                accept="audio/mpeg,audio/mp3,audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAudioFileUpload(f);
                }}
              />
            </label>
          </div>

          {audioUrl && (
            <audio controls src={audioUrl} className="w-full h-9 mt-1" />
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || uploadingPhoto || generatingAudio}
            className="px-6 py-2.5 rounded-xl bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{editingId ? 'Wijziging Opslaan' : 'Toevoegen aan Logboek'}</span>
          </button>
        </div>
      </form>

      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white">
          Alle Aantekeningen ({entries.length}) — Nieuwste eerst
        </h3>

        {loading ? (
          <div className="py-10 text-center text-earth-light/60 text-sm">Laden...</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-earth-light/60 text-sm">
            Nog geen notities in het logboek. Voeg hierboven je eerste aantekening toe!
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={cn(
                  'p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-4',
                  editingId === entry.id
                    ? 'bg-earth-gold/10 border-earth-gold/40'
                    : 'bg-black/30 border-white/10'
                )}
              >
                <div className="flex gap-4 items-start flex-1 min-w-0">
                  {entry.foto ? (
                    <img
                      src={entry.foto}
                      alt=""
                      className="w-16 h-16 object-cover rounded-lg border border-white/15 shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg border border-dashed border-white/15 flex items-center justify-center text-white/25 shrink-0">
                      <ImageIcon className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-mono text-earth-gold font-bold">
                        {formatLogboekDatum(entry.datum)} ({entry.datum})
                      </span>
                      {entry.audio_url && (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                            entry.audio_enabled
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-stone-500/15 text-stone-400 border-stone-500/30'
                          )}
                        >
                          {entry.audio_enabled ? '🔊 MP3 AAN' : '🔇 MP3 UIT'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{entry.tekst}</p>
                    {entry.audio_url && entry.audio_enabled && (
                      <audio controls src={entry.audio_url} className="h-8 max-w-xs pt-1" />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleEntryAudio(entry)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 cursor-pointer border',
                      entry.audio_enabled
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                        : 'bg-white/5 hover:bg-white/10 text-stone-400 border-white/10'
                    )}
                    title="Zet MP3 afspelen aan of uit voor dit bericht"
                  >
                    {entry.audio_enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                    <span>{entry.audio_enabled ? 'Audio AAN' : 'Audio UIT'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEdit(entry)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Bewerk</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(entry.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Wis</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
