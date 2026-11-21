export type EnvLike = Readonly<Record<string, unknown>>;

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
}

export type FirebaseConfigResult =
  | { ok: true; config: FirebaseWebConfig }
  | { ok: false; missing: string[] };

function str(env: EnvLike, key: string): string {
  const v = env[key];
  return typeof v === 'string' ? v.trim() : '';
}

export function readFirebaseConfig(env: EnvLike): FirebaseConfigResult {
  const required = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    appId: 'VITE_FIREBASE_APP_ID'
  } as const;
  const missing = Object.values(required).filter((k) => str(env, k) === '');
  if (missing.length > 0) return { ok: false, missing };
  const config: FirebaseWebConfig = {
    apiKey: str(env, required.apiKey),
    projectId: str(env, required.projectId),
    appId: str(env, required.appId)
  };
  const authDomain = str(env, 'VITE_FIREBASE_AUTH_DOMAIN');
  if (authDomain) config.authDomain = authDomain;
  return { ok: true, config };
}

/** Empty -> undefined, which lets the SDK generate and log a debug token. */
export function readAppCheckDebugToken(env: EnvLike): string | undefined {
  return str(env, 'VITE_APPCHECK_DEBUG_TOKEN') || undefined;
}

export function readCloudModel(env: EnvLike, fallback: string): string {
  return str(env, 'VITE_CLOUD_MODEL') || fallback;
}
