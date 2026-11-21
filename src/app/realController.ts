import { InferenceMode } from 'firebase/ai';
import { probeOnDevice } from '../ai/availability';
import { initFirebase } from '../ai/firebase';
import { initDeviceModel, runHybridProbe } from '../ai/hybridProbe';
import { makeModel } from '../ai/models';
import { DEFAULTS } from '../config/defaults';
import type { Config } from '../config/defaults';
import { readAppCheckDebugToken, readCloudModel, readFirebaseConfig } from '../config/env';
import type { ProbeController } from './panels/HybridProbePanel';

export function createRealController(env: Readonly<Record<string, unknown>>): ProbeController {
  const fb = readFirebaseConfig(env);
  const cfg: Config = { ...DEFAULTS, cloudModel: readCloudModel(env, DEFAULTS.cloudModel) };
  const notReady = (): Promise<never> =>
    Promise.reject(new Error(`Firebase config missing: ${fb.ok ? '' : fb.missing.join(', ')}`));
  if (!fb.ok) {
    return {
      firebaseOk: false,
      firebaseLabel: 'missing (copy .env.example to .env.local)',
      appCheckLabel: 'inactive',
      probeAvailability: () => probeOnDevice(),
      enableDevice: notReady,
      run: notReady
    };
  }
  const ai = initFirebase(fb.config, readAppCheckDebugToken(env));
  return {
    firebaseOk: true,
    firebaseLabel: 'ok',
    appCheckLabel: 'active (debug)',
    probeAvailability: () => probeOnDevice(),
    enableDevice: (onProgress) => initDeviceModel(makeModel(ai, 'extract', InferenceMode.ONLY_ON_DEVICE, cfg), onProgress),
    run: (mode) => runHybridProbe({ ai, cfg }, mode)
  };
}
