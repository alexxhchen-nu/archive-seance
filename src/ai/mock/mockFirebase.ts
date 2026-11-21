import type { AI, InferenceMode } from 'firebase/ai';
import type { AvailabilityProbe } from '../availability';
import type { GenerateLike } from '../call';
import { initDeviceModel, runHybridProbe } from '../hybridProbe';
import type { DeviceInitLike, MakeModelFn } from '../hybridProbe';
import { DEFAULTS } from '../../config/defaults';
import type { ProbeController } from '../../app/panels/HybridProbePanel';

// Scripted stand-in for Firebase AI Logic. Only bundled in `--mode mock`.
type MockDevice = 'available' | 'downloadable' | 'unavailable' | 'missing';

const MOCK_JSON = JSON.stringify({
  entities: [
    { name: 'Edith Marlow', type: 'person', quote: 'the Harbor Commission chaired by Edith Marlow' },
    { name: 'Harbor Commission', type: 'org', quote: 'the Harbor Commission chaired by Edith Marlow' },
    { name: 'Lantern Trading Company', type: 'org', quote: 'representatives of the Lantern Trading Company' }
  ],
  relations: [
    { subject: 'Harbor Commission', object: 'Lantern Trading Company', label: 'met-with',
      quote: 'the Harbor Commission chaired by Edith Marlow met with representatives of the Lantern Trading Company' }
  ]
});

// Console demo (T20) script for test/fixtures/eval/harbor-eval-minutes.pdf. Every quote is a verbatim
// span of that synthetic fixture. "E. Marlow" / "Edith Marlow" share a surname and initial (name 0.88),
// which buildEntities scores as a ghost; "Dr. Oswin Hale" appears twice with identical tokens (solid).
export const DEMO_SCRIPT = {
  entities: [
    { name: 'Edith Marlow', type: 'person', quote: 'Mrs. Edith Marlow chaired the meeting in the reading room' },
    { name: 'Saltmarsh Historical Society', type: 'org', quote: 'a member of the Saltmarsh Historical Society since 1931' },
    { name: 'Dr. Oswin Hale', type: 'person', quote: 'Dr. Oswin Hale reported on the damaged ledgers' },
    { name: 'E. Marlow', type: 'person', quote: 'E. Marlow wrote to Dr. Oswin Hale in March' },
    { name: 'Dr. Oswin Hale', type: 'person', quote: 'E. Marlow wrote to Dr. Oswin Hale in March' }
  ],
  relations: [
    { subject: 'E. Marlow', object: 'Dr. Oswin Hale', label: 'communicated-with', quote: 'E. Marlow wrote to Dr. Oswin Hale in March' }
  ]
} as const;

const fold = (s: string): string => s.replace(/\s+/gu, ' ').toLowerCase();

/** Answers an extraction prompt with the DEMO_SCRIPT items whose quote occurs in that prompt's chunk. */
export function demoExtractionText(prompt: string): string {
  const p = fold(prompt);
  const has = (q: string): boolean => p.includes(fold(q));
  const entities = DEMO_SCRIPT.entities.filter((e) => has(e.quote));
  const relations = DEMO_SCRIPT.relations.filter((r) => has(r.quote));
  return JSON.stringify({ entities, relations });
}

export function parseMockDevice(search: string): MockDevice {
  const v = new URLSearchParams(search).get('device');
  return v === 'downloadable' || v === 'unavailable' || v === 'missing' ? v : 'available';
}

export function createMockFirebase(initial: MockDevice) {
  let device: MockDevice = initial;
  const ai = { app: { name: 'mock' } } as unknown as AI;
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const build = (mode: InferenceMode, demo = false): GenerateLike & DeviceInitLike => {
    const model: GenerateLike & DeviceInitLike = {
      async generateContent(prompt: string) {
        await delay(device === 'available' ? 120 : 300);
        let source: 'on_device' | 'in_cloud';
        if (mode === 'only_on_device') {
          if (device !== 'available') throw new Error('on-device model unavailable');
          source = 'on_device';
        } else if (mode === 'prefer_on_device') {
          source = device === 'available' ? 'on_device' : 'in_cloud';
        } else {
          source = 'in_cloud';
        }
        const text = demo ? demoExtractionText(prompt) : MOCK_JSON;
        return { response: { text: () => text, inferenceSource: source } };
      },
      async initializeDeviceModel(onProgress) {
        if (device === 'unavailable' || device === 'missing') throw new Error('on-device model unavailable');
        for (let i = 0; i <= 10; i++) {
          onProgress?.(i / 10);
          await delay(50);
        }
        device = 'available';
      }
    };
    return model;
  };
  const makeModel: MakeModelFn = (_ai, _kind, mode) => build(mode);
  const makeDeviceModel = (): DeviceInitLike => build('only_on_device');

  const probeAvailability = async (): Promise<AvailabilityProbe> => {
    if (device === 'missing') return { availability: 'api-missing', hint: 'MOCK: LanguageModel global absent.' };
    return { availability: device, hint: `MOCK: scripted availability "${device}".` };
  };

  const makeDemoModel = (): GenerateLike => build('only_on_device' as InferenceMode, true);

  return { ai, makeModel, makeDeviceModel, makeDemoModel, probeAvailability };
}

export function createMockController(search: string): ProbeController & { evalModel: () => GenerateLike; demoModel: () => GenerateLike } {
  const m = createMockFirebase(parseMockDevice(search));
  const cfg = { ...DEFAULTS };
  return {
    firebaseOk: true,
    firebaseLabel: 'ok (mock)',
    appCheckLabel: 'active (mock)',
    banner: 'MOCK build: scripted responses, no Firebase calls are made.',
    probeAvailability: m.probeAvailability,
    enableDevice: (onProgress) => initDeviceModel(m.makeDeviceModel(), onProgress),
    run: (mode) => runHybridProbe({ ai: m.ai, cfg, makeModel: m.makeModel }, mode),
    evalModel: () => m.makeModel(m.ai, 'extract', 'only_on_device' as InferenceMode, cfg),
    demoModel: () => m.makeDemoModel()
  };
}
