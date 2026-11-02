import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sliders, X, RotateCcw, Sparkles, Check, Activity, Cookie, Power } from 'lucide-react';
import {
  EQUALIZER_BANDS,
  EQUALIZER_PRESETS,
  EqualizerPreferences,
  getEqualizerPreferences,
  setEqualizerPreferences,
  equalizerEngine
} from '../lib/equalizer';

interface EqualizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPlaying?: boolean;
  lang?: 'nl' | 'en';
}

export const EqualizerModal: React.FC<EqualizerModalProps> = ({ isOpen, onClose, isPlaying = false, lang = 'nl' }) => {
  const isEn = lang === 'en';
  const [preferences, setPreferences] = useState<EqualizerPreferences>(() => getEqualizerPreferences());
  const [activePresetId, setActivePresetId] = useState<string>(() => preferences.presetId);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sync engine when modal mounts or open state changes
  useEffect(() => {
    const prefs = getEqualizerPreferences();
    setPreferences(prefs);
    setActivePresetId(prefs.presetId);
    equalizerEngine.applyPreferences(prefs);
  }, [isOpen]);

  // Realtime Spectrum Visualizer canvas animation
  useEffect(() => {
    if (!isOpen) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    const analyser = equalizerEngine.getAnalyser();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    const dataArray = new Uint8Array(bufferLength);

    const renderSpectrum = () => {
      animationFrameRef.current = requestAnimationFrame(renderSpectrum);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Ruststand wanneer gepauzeerd
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.max(0, (dataArray[i] || 0) * 0.9);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 24;
      const barWidth = (canvas.width / barCount) - 3;
      const step = Math.floor(bufferLength / barCount);

      for (let i = 0; i < barCount; i++) {
        const val = dataArray[i * step] || 0;
        const percent = val / 255;
        const minHeight = 4;
        const barHeight = Math.max(minHeight, percent * (canvas.height - 8));
        const x = i * (barWidth + 3);
        const y = canvas.height - barHeight;

        // Vloeiend goud-amber verloop
        const gradient = ctx.createLinearGradient(0, y, 0, canvas.height);
        if (preferences.enabled) {
          gradient.addColorStop(0, '#fde68a'); // amber-200
          gradient.addColorStop(0.5, '#d4af37'); // earth-gold
          gradient.addColorStop(1, '#92400e'); // amber-800
        } else {
          gradient.addColorStop(0, '#9ca3af'); // grijs (bypassed)
          gradient.addColorStop(1, '#4b5563');
        }

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();
      }
    };

    renderSpectrum();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isOpen, isPlaying, preferences.enabled]);

  // Handler: Wisselen van Preset
  const handleSelectPreset = (presetId: string) => {
    const found = EQUALIZER_PRESETS.find(p => p.id === presetId);
    if (!found) return;

    const newPrefs: EqualizerPreferences = {
      enabled: true,
      presetId: found.id,
      gains: [...found.gains]
    };

    setPreferences(newPrefs);
    setActivePresetId(found.id);
    setEqualizerPreferences(newPrefs.enabled, newPrefs.presetId, newPrefs.gains);
    equalizerEngine.applyPreferences(newPrefs);
  };

  // Handler: Schuifregelaar per band verplaatsen
  const handleBandChange = (index: number, newGain: number) => {
    const roundedGain = Math.round(newGain * 10) / 10;
    const newGains = [...preferences.gains] as [number, number, number, number, number];
    newGains[index] = roundedGain;

    // Controleer of deze instelling toevallig exact overeenkomt met een preset
    let matchingPreset = EQUALIZER_PRESETS.find(p =>
      p.gains.every((g, idx) => Math.abs(g - newGains[idx]) < 0.2)
    );

    const presetId = matchingPreset ? matchingPreset.id : 'custom';

    const newPrefs: EqualizerPreferences = {
      enabled: true,
      presetId,
      gains: newGains
    };

    setPreferences(newPrefs);
    setActivePresetId(presetId);
    setEqualizerPreferences(newPrefs.enabled, newPrefs.presetId, newPrefs.gains);
    equalizerEngine.applyPreferences(newPrefs);
  };

  // Handler: Reset alle banden naar 0 dB (Neutraal)
  const handleReset = () => {
    handleSelectPreset('flat');
  };

  // Handler: Equalizer Aan/Uit schakelen
  const handleToggleEnabled = () => {
    const nextEnabled = !preferences.enabled;
    const newPrefs: EqualizerPreferences = {
      ...preferences,
      enabled: nextEnabled
    };

    setPreferences(newPrefs);
    setEqualizerPreferences(newPrefs.enabled, newPrefs.presetId, newPrefs.gains);
    equalizerEngine.applyPreferences(newPrefs);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#181614] border border-earth-gold/30 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#1f1c19]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-earth-gold/20 border border-earth-gold/40 flex items-center justify-center text-earth-gold shadow-inner">
                <Sliders className="w-5 h-5 text-earth-gold" />
              </div>
              <div>
                <h3 className="text-white font-serif text-lg font-bold flex items-center gap-2">
                  {isEn ? 'Sound & Equalizer' : 'Klank & Equalizer'}
                </h3>
                <p className="text-earth-light/60 text-xs font-mono">
                  {isEn ? 'Personalize audio tone to your preference' : 'Personaliseer het geluid naar uw smaak'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Aan/Uit Schakelaar */}
              <button
                type="button"
                onClick={handleToggleEnabled}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium font-mono transition-all cursor-pointer border ${
                  preferences.enabled
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-white/5 text-white/50 border-white/10 hover:text-white'
                }`}
                title={preferences.enabled ? (isEn ? 'Equalizer is active (click to bypass)' : 'Equalizer is actief (klik om uit te schakelen)') : (isEn ? 'Equalizer is bypassed' : 'Equalizer is uitgeschakeld')}
              >
                <Power className={`w-3.5 h-3.5 ${preferences.enabled ? 'text-emerald-400' : 'text-white/40'}`} />
                <span>{preferences.enabled ? (isEn ? 'EQ ON' : 'EQ AAN') : (isEn ? 'EQ OFF' : 'EQ UIT')}</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title={isEn ? 'Close' : 'Sluiten'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-5 overflow-y-auto space-y-6 custom-scrollbar">
            {/* Realtime Spectrum Visualizer Box */}
            <div className="bg-[#12110f] border border-white/10 rounded-xl p-3 relative overflow-hidden shadow-inner">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs text-earth-gold/80 font-mono">
                  <Activity className="w-3.5 h-3.5 text-earth-gold" />
                  <span>{isEn ? 'Realtime Audio Spectrum' : 'Realtime Audio Spectrum'}</span>
                </div>
                <span className="text-[11px] text-earth-light/50 font-mono">
                  {isPlaying ? (isEn ? 'Music playing live' : 'Muziek speelt live') : (isEn ? 'Paused' : 'Gepauzeerd')}
                </span>
              </div>

              <canvas
                ref={canvasRef}
                width={360}
                height={56}
                className="w-full h-14 block"
              />

              {!preferences.enabled && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center text-xs text-white/70 font-mono">
                  {isEn ? 'Equalizer is bypassed (neutral audio)' : 'Equalizer is uitgeschakeld (neutrale doorgifte)'}
                </div>
              )}
            </div>

            {/* Presets Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-earth-light/60 font-mono font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-earth-gold" />
                  {isEn ? 'Preset Profiles' : 'Voorgedefinieerde Profielen'}
                </span>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-[11px] text-earth-gold hover:text-amber-300 font-mono flex items-center gap-1 cursor-pointer transition-colors"
                  title={isEn ? 'Reset to flat (0 dB)' : 'Herstel naar neutraal (0 dB)'}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{isEn ? 'Reset (Flat 0 dB)' : 'Reset (0 dB)'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {EQUALIZER_PRESETS.map((preset) => {
                  const isSelected = activePresetId === preset.id;
                  const enNames: Record<string, { title: string; desc: string }> = {
                    flat: { title: 'Standard (Flat)', desc: 'Natural and uncolored, as mastered in the studio.' },
                    vocal: { title: 'Warm Vocal & Audiobook', desc: 'Accentuates vocal clarity with warmth and presence.' },
                    acoustic: { title: 'Acoustic & Guitar', desc: 'Crisp acoustic strings and open, spacious ballads.' },
                    bass: { title: 'Deep Bass (Bass Boost)', desc: 'Adds low-end body and punch on smaller speakers.' },
                    bright: { title: 'Bright & Crisp', desc: 'Enhances high frequencies and delicate details.' },
                    night: { title: 'Headphones / Late Night', desc: 'Soft low frequencies for relaxed listening.' }
                  };
                  const displayTitle = isEn && enNames[preset.id] ? enNames[preset.id].title : preset.name.split(' (')[0];
                  const displayDesc = isEn && enNames[preset.id] ? enNames[preset.id].desc : preset.description;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-earth-gold/20 border-earth-gold text-white shadow-md shadow-earth-gold/10'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/80 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-white truncate pr-1">
                          {displayTitle}
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-earth-gold shrink-0" />}
                      </div>
                      <span className="text-[10px] text-earth-light/60 line-clamp-2 leading-tight">
                        {displayDesc}
                      </span>
                    </button>
                  );
                })}

                {/* Aangepast (Custom) status tegel indien sliders handmatig gewijzigd zijn */}
                {activePresetId === 'custom' && (
                  <div className="p-2.5 rounded-xl border bg-earth-gold/20 border-earth-gold text-white flex flex-col justify-between shadow-md">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-earth-gold">{isEn ? 'Custom' : 'Aangepast'}</span>
                      <Check className="w-3.5 h-3.5 text-earth-gold shrink-0" />
                    </div>
                    <span className="text-[10px] text-earth-light/70 leading-tight">
                      {isEn ? 'Manual slider adjustment' : 'Handmatige schuifregelaar instelling'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 5-Band Sliders */}
            <div className="space-y-3 bg-[#141210] border border-white/10 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wider text-earth-light/60 font-mono font-bold">
                  {isEn ? '5-Band Frequency Sliders (-12 dB to +12 dB)' : '5-Bands Frequentieregelaars (-12 dB tot +12 dB)'}
                </span>
              </div>

              {/* Sliders Layout */}
              <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center">
                {EQUALIZER_BANDS.map((band, idx) => {
                  const gain = preferences.gains[idx] ?? 0;
                  const isPositive = gain > 0;
                  const isNegative = gain < 0;
                  const enSubLabels: Record<string, string> = {
                    'Diepe bas': 'Deep bass',
                    'Warmte': 'Warmth',
                    'Stem / Zang': 'Vocals',
                    'Helderheid': 'Clarity',
                    'Sprankel': 'Sparkle'
                  };
                  const subLabel = isEn && enSubLabels[band.subLabel] ? enSubLabels[band.subLabel] : band.subLabel;

                  return (
                    <div key={band.freq} className="flex flex-col items-center space-y-2">
                      {/* Gain dB weergave */}
                      <span
                        className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                          isPositive
                            ? 'text-emerald-400 bg-emerald-500/15'
                            : isNegative
                            ? 'text-amber-400 bg-amber-500/15'
                            : 'text-white/60 bg-white/5'
                        }`}
                      >
                        {isPositive ? `+${gain}` : gain} dB
                      </span>

                      {/* Verticale Slider Container */}
                      <div className="h-32 sm:h-36 flex items-center justify-center relative py-2">
                        {/* 0 dB Middenlijn marker */}
                        <div className="absolute w-6 h-[1px] bg-white/20 pointer-events-none top-1/2 -translate-y-1/2 z-0" />

                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={0.5}
                          value={gain}
                          disabled={!preferences.enabled}
                          onChange={(e) => handleBandChange(idx, parseFloat(e.target.value))}
                          className="h-28 sm:h-32 -rotate-90 w-28 sm:w-32 accent-earth-gold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed z-10"
                          style={{ WebkitAppearance: 'slider-vertical' as any }}
                          title={`${band.label} (${subLabel}): ${gain} dB`}
                        />
                      </div>

                      {/* Frequentielabel */}
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white font-mono">{band.label}</div>
                        <div className="text-[10px] text-earth-light/50 truncate max-w-[65px]">
                          {subLabel}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cookie & Persistence Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-earth-gold/10 border border-earth-gold/25 text-earth-light/80 text-xs">
              <Cookie className="w-4 h-4 text-earth-gold shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {isEn ? (
                  <>
                    Your sound profile and equalizer settings are <strong className="text-earth-gold font-semibold">automatically saved in a cookie</strong>. On every visit your music will immediately play according to your personal preferences.
                  </>
                ) : (
                  <>
                    Uw klankprofiel en equalizer-instellingen worden <strong className="text-earth-gold font-semibold">automatisch bewaard in een cookie</strong>. Bij elk volgend bezoek klinkt uw muziek meteen weer volgens uw persoonlijke voorkeuren.
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/10 bg-[#1f1c19] flex items-center justify-between">
            <div className="text-[11px] text-earth-light/50 font-mono">
              Status: <span className="text-earth-gold font-bold">{preferences.enabled ? (isEn ? 'Active' : 'Actief') : (isEn ? 'Bypassed' : 'Gedeactiveerd')}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-1.5 rounded-full bg-earth-gold text-black font-semibold text-xs hover:bg-amber-300 transition-colors cursor-pointer shadow-md"
            >
              {isEn ? 'Done' : 'Klaar'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
