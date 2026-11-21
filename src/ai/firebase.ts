import { initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { initializeAppCheck, CustomProvider } from 'firebase/app-check';
import { getAI, GoogleAIBackend } from 'firebase/ai';
import type { AI } from 'firebase/ai';
import type { FirebaseWebConfig } from '../config/env';

let cached: { app: FirebaseApp; ai: AI } | undefined;

export function initFirebase(cfg: FirebaseWebConfig, appCheckDebugToken?: string): AI {
  if (cached) return cached.ai;
  const app = initializeApp(cfg);
  // Debug mode must be enabled before initializeAppCheck. Value comes from untracked env only.
  (globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN =
    appCheckDebugToken || true;
  // Placeholder provider: in debug mode the SDK uses the debug token; avoids bundling reCAPTCHA.
  initializeAppCheck(app, {
    provider: new CustomProvider({
      getToken: async () => {
        throw new Error('No production attestation provider; use a debug token');
      }
    }),
    isTokenAutoRefreshEnabled: true
  });
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  cached = { app, ai };
  return ai;
}
