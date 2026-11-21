import type { DeviceAvailability } from '../types';

interface LanguageModelOptions {
  expectedInputs: { type: 'text'; languages: string[] }[];
  expectedOutputs: { type: 'text'; languages: string[] }[];
}

interface LanguageModelStatic {
  availability(opts: LanguageModelOptions): Promise<string>;
}

export interface AvailabilityProbe {
  availability: DeviceAvailability;
  hint: string;
}

const HINTS: Record<DeviceAvailability, string> = {
  available: 'Gemini Nano is ready on this device.',
  downloadable: 'Click "Enable on-device AI" to download the model.',
  downloading: 'The on-device model is downloading.',
  unavailable: 'This device does not meet the on-device model requirements.',
  'api-missing': 'The Prompt API (LanguageModel) is not present in this browser.'
};

function isLanguageModel(v: unknown): v is LanguageModelStatic {
  return (typeof v === 'object' || typeof v === 'function') && v !== null &&
    typeof (v as { availability?: unknown }).availability === 'function';
}

const KNOWN: readonly string[] = ['available', 'downloadable', 'downloading', 'unavailable'];

export async function probeOnDevice(globalLike: object = globalThis): Promise<AvailabilityProbe> {
  const lm = (globalLike as { LanguageModel?: unknown }).LanguageModel;
  if (!isLanguageModel(lm)) return { availability: 'api-missing', hint: HINTS['api-missing'] };
  try {
    const raw = await lm.availability({
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    });
    const a: DeviceAvailability = KNOWN.includes(raw) ? (raw as DeviceAvailability) : 'unavailable';
    return { availability: a, hint: HINTS[a] };
  } catch {
    return { availability: 'unavailable', hint: HINTS.unavailable };
  }
}
