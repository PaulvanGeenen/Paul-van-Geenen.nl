import { GoogleGenAI } from '@google/genai';
import { Mp3Encoder } from '@breezystack/lamejs';
import { formatLogboekDatum } from './logboek';

const GEMINI_KEY_STORAGE = 'pvg_gemini_tts_api_key_v1';

export function getSavedGeminiTtsKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

export function saveGeminiTtsKey(key: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

function base64ToInt16Array(base64: string): Int16Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

async function synthesizeDutchMalePcm(ai: GoogleGenAI, textToRead: string): Promise<Int16Array> {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [
      {
        parts: [
          {
            text: `Spreek de volgende Nederlandse tekst rustig, natuurlijk en warm uit:\n${textToRead}`,
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Charon', // Rustige, diepe mannenstem
          },
        },
      },
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inlineData = (part as any)?.inlineData;
    if (inlineData?.data) {
      return base64ToInt16Array(inlineData.data);
    }
  }
  throw new Error('Geen audio ontvangen van Gemini TTS.');
}

function encodePcmToMp3DataUrl(pcmSamples: Int16Array, sampleRate = 24000): string {
  const encoder = new Mp3Encoder(1, sampleRate, 128);
  const mp3Chunks: Uint8Array[] = [];
  const blockSize = 1152;

  for (let i = 0; i < pcmSamples.length; i += blockSize) {
    const chunk = pcmSamples.subarray(i, i + blockSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
  }
  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  let totalLength = 0;
  for (const c of mp3Chunks) totalLength += c.length;
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of mp3Chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  let binary = '';
  const chunkStrSize = 8192;
  for (let i = 0; i < merged.length; i += chunkStrSize) {
    const slice = merged.subarray(i, i + chunkStrSize);
    binary += String.fromCharCode(...slice);
  }
  return `data:audio/mp3;base64,${btoa(binary)}`;
}

/**
 * Genereert een echte MP3 waarin een mannenstem eerst de datum voorleest,
 * ~0,9 seconde wacht, en daarna het logboekbericht voorleest.
 */
export async function generateLogboekMp3DataUrl(
  datum: string,
  tekst: string,
  apiKey?: string
): Promise<string> {
  const key = (apiKey || getSavedGeminiTtsKey()).trim();
  if (!key) {
    throw new Error('Vul eerst een Gemini API-sleutel in om automatisch MP3-audio te genereren.');
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const spokenDate = formatLogboekDatum(datum) || datum;

  const [datePcm, bodyPcm] = await Promise.all([
    synthesizeDutchMalePcm(ai, spokenDate),
    synthesizeDutchMalePcm(ai, tekst),
  ]);

  // 0,9 seconde stilte op 24.000 Hz tussen datum en bericht
  const pauseSamples = new Int16Array(Math.round(24000 * 0.9));
  const combined = new Int16Array(datePcm.length + pauseSamples.length + bodyPcm.length);
  combined.set(datePcm, 0);
  combined.set(pauseSamples, datePcm.length);
  combined.set(bodyPcm, datePcm.length + pauseSamples.length);

  return encodePcmToMp3DataUrl(combined, 24000);
}
