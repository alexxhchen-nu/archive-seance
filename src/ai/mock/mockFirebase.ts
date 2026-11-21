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

export function parseMockDevice(search: string): MockDevice {
  const v = new URLSearchParams(search).get('device');
  return v === 'downloadable' || v === 'unavailable' || v === 'missing' ? v : 'available';
}

export function createMockFirebase(initial: MockDevice) {
  let device: MockDevice = initial;
  const ai = { app: { name: 'mock' } } as unknown as AI;
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const build = (mode: InferenceMode): GenerateLike & DeviceInitLike => {
    const model: GenerateLike & DeviceInitLike = {
      async generateContent() {
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
        return { response: { text: () => MOCK_JSON, inferenceSource: source } };
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

  return { ai, makeModel, makeDeviceModel, probeAvailability };
}

export function createMockController(search: string): ProbeController {
  const m = createMockFirebase(parseMockDevice(search));
  const cfg = { ...DEFAULTS };
  return {
    firebaseOk: true,
    firebaseLabel: 'ok (mock)',
    appCheckLabel: 'active (mock)',
    banner: 'MOCK build: scripted responses, no Firebase calls are made.',
    probeAvailability: m.probeAvailability,
    enableDevice: (onProgress) => initDeviceModel(m.makeDeviceModel(), onProgress),
    run: (mode) => runHybridProbe({ ai: m.ai, cfg, makeModel: m.makeModel }, mode)
  };
}
