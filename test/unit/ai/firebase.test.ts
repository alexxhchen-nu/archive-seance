import { describe, expect, it, vi } from 'vitest';

const { order, g } = vi.hoisted(() => ({
  order: [] as string[],
  g: globalThis as { FIREBASE_APPCHECK_DEBUG_TOKEN?: unknown }
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => { order.push('initializeApp'); return { name: 'app' }; }) }));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(() => { order.push(`initializeAppCheck:debug=${String(g.FIREBASE_APPCHECK_DEBUG_TOKEN)}`); }),
  CustomProvider: vi.fn(function CustomProvider() { order.push('CustomProvider'); }),
  ReCaptchaV3Provider: vi.fn(() => { order.push('ReCaptchaV3Provider'); }),
  ReCaptchaEnterpriseProvider: vi.fn(() => { order.push('ReCaptchaEnterpriseProvider'); })
}));
vi.mock('firebase/ai', () => ({
  getAI: vi.fn(() => { order.push('getAI'); return { kind: 'ai' }; }),
  GoogleAIBackend: vi.fn(function GoogleAIBackend() {})
}));

const { initFirebase } = await import('../../../src/ai/firebase');

describe('initFirebase', () => {
  it('sets debug flag before App Check, App Check before getAI, no reCAPTCHA, idempotent', () => {
    const cfg = { apiKey: 'k', projectId: 'p', appId: 'a' };
    const ai1 = initFirebase(cfg);
    expect(order).toEqual(['initializeApp', 'CustomProvider', 'initializeAppCheck:debug=true', 'getAI']);
    expect(order.some((o) => o.startsWith('ReCaptcha'))).toBe(false);
    const ai2 = initFirebase(cfg);
    expect(ai2).toBe(ai1);
    expect(order).toHaveLength(4);
  });
});
