import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Plus, Trash2, Edit3, Save, X, Image as ImageIcon,
  Upload, Loader2, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
  LogboekEntry,
  fetchLogboekEntries,
  saveLogboekEntry,
  deleteLogboekEntry,
  uploadLogboekPhoto,
  formatLogboekDatum,
  openLogboekOverlay,
} from '../lib/logboek';
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
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [datum, setDatum] = useState<string>(() => getTodayIso());
  const [foto, setFoto] = useState<string>('');
  const [tekst, setTekst] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchLogboekEntries();
      setEntries(data);
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
    window.setTimeout(() => setStatusMsg(null), 4000);
  };

  const resetForm = () => {
    setEditingId(null);
    setDatum(getTodayIso());
    setFoto('');
    setTekst('');
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
      await saveLogboekEntry({
        id: editingId ?? undefined,
        datum: datum.trim(),
        foto: foto.trim() || null,
        tekst: tekst.trim(),
      });
      showStatus(editingId ? 'Notitie bijgewerkt!' : 'Nieuwe logboek-notitie toegevoegd!');
      resetForm();
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry: LogboekEntry) => {
    setEditingId(entry.id);
    setDatum(entry.datum);
    setFoto(entry.foto || '');
    setTekst(entry.tekst);
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
      {/* Header */}
      <div className="bg-[#181818] border border-white/10 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#7c2218]/30 border border-[#a83829]/40 text-amber-200">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-white">Logboek Beheer</h2>
            <p className="text-xs text-earth-light/65">
              Korte, gedateerde notities (nieuwste eerst). Plak een afbeelding met Ctrl+V of upload een foto.
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

      {/* Formulier */}
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

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || uploadingPhoto}
            className="px-6 py-2.5 rounded-xl bg-earth-gold hover:bg-earth-gold/90 text-black font-bold text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{editingId ? 'Wijziging Opslaan' : 'Toevoegen aan Logboek'}</span>
          </button>
        </div>
      </form>

      {/* Overzicht van notities */}
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
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-earth-gold font-bold mb-1">
                      {formatLogboekDatum(entry.datum)} ({entry.datum})
                    </div>
                    <p className="text-sm text-white/90 whitespace-pre-wrap break-words">{entry.tekst}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
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
