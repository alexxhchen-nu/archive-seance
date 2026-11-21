import { describe, expect, it } from 'vitest';
import { readAppCheckDebugToken, readCloudModel, readFirebaseConfig } from '../../../src/config/env';

describe('env', () => {
  it('reports missing required keys', () => {
    expect(readFirebaseConfig({})).toEqual({
      ok: false, missing: ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID']
    });
    expect(readFirebaseConfig({ VITE_FIREBASE_API_KEY: ' ', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' }))
      .toEqual({ ok: false, missing: ['VITE_FIREBASE_API_KEY'] });
  });

  it('builds config with optional authDomain', () => {
    const base = { VITE_FIREBASE_API_KEY: 'k', VITE_FIREBASE_PROJECT_ID: 'p', VITE_FIREBASE_APP_ID: 'a' };
    expect(readFirebaseConfig(base)).toEqual({ ok: true, config: { apiKey: 'k', projectId: 'p', appId: 'a' } });
    expect(readFirebaseConfig({ ...base, VITE_FIREBASE_AUTH_DOMAIN: 'd' }))
      .toEqual({ ok: true, config: { apiKey: 'k', projectId: 'p', appId: 'a', authDomain: 'd' } });
  });

  it('reads token and cloud model', () => {
    expect(readAppCheckDebugToken({ VITE_APPCHECK_DEBUG_TOKEN: '' })).toBeUndefined();
    expect(readAppCheckDebugToken({ VITE_APPCHECK_DEBUG_TOKEN: 'x' })).toBe('x');
    expect(readCloudModel({}, 'm')).toBe('m');
    expect(readCloudModel({ VITE_CLOUD_MODEL: 'n' }, 'm')).toBe('n');
  });
});
