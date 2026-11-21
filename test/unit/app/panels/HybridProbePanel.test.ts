// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountHybridProbePanel } from '../../../../src/app/panels/HybridProbePanel';
import type { ProbeController } from '../../../../src/app/panels/HybridProbePanel';
import type { EvalMode, Predictions } from '../../../../src/eval/predictions';
import type { HybridModeName, InferenceSourceTag } from '../../../../src/types';

const q = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const flush = () => new Promise((r) => setTimeout(r, 0));

function ctl(over: Partial<ProbeController> = {}, source: InferenceSourceTag = 'on_device'): ProbeController {
  return {
    firebaseOk: true,
    firebaseLabel: 'ok',
    appCheckLabel: 'active (debug)',
    probeAvailability: async () => ({ availability: 'downloadable', hint: 'h' }),
    enableDevice: vi.fn(async (cb: (p: number) => void) => { cb(1); }),
    run: vi.fn(async (mode: HybridModeName) => ({
      requestedMode: mode, source, ms: 12, entities: [], relations: [], rawText: '{}',
      log: { id: 'i', at: 'a', kind: 'extract' as const, requestedRoute: 'local' as const, inferenceSource: source, payloadChars: 1, payloadSha256: 'x', ms: 12 }
    })),
    ...over
  };
}

function mount(c: ProbeController) {
  const root = document.createElement('div');
  document.body.append(root);
  mountHybridProbePanel(root, c);
  return root;
}

describe('HybridProbePanel', () => {
  it('shows "Ran on-device" from the reported source', async () => {
    const root = mount(ctl());
    q(root, 'btn-run-device').click();
    await flush();
    expect(q(root, 'path-badge').textContent).toBe('Ran on-device');
    expect(q(root, 'mode-requested').textContent).toBe('only_on_device');
  });

  it('shows "Ran in cloud" for a hybrid run that fell back', async () => {
    const root = mount(ctl({}, 'in_cloud'));
    q(root, 'btn-run-hybrid').click();
    await flush();
    expect(q(root, 'path-badge').textContent).toBe('Ran in cloud');
    expect(q(root, 'mode-requested').textContent).toBe('prefer_on_device');
  });

  it('disables buttons and explains when config is missing', () => {
    const root = mount(ctl({ firebaseOk: false, firebaseLabel: 'missing (copy .env.example to .env.local)', appCheckLabel: 'inactive' }));
    for (const id of ['btn-run-device', 'btn-run-hybrid', 'btn-run-cloud', 'btn-enable-device']) {
      expect((q(root, id) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(q(root, 'chip-firebase').textContent).toContain('missing');
    expect(q(root, 'config-note').textContent).toContain('.env.local');
  });

  it('calls enableDevice only from the click', async () => {
    const c = ctl();
    const root = mount(c);
    await flush();
    expect(c.enableDevice).not.toHaveBeenCalled();
    q(root, 'btn-enable-device').click();
    await flush();
    expect(c.enableDevice).toHaveBeenCalledTimes(1);
  });

  it('renders human-readable errors', async () => {
    const root = mount(ctl({ run: async () => { throw new Error('403 App Check token invalid'); } }));
    q(root, 'btn-run-cloud').click();
    await flush();
    expect(q(root, 'probe-error').textContent).toContain('App Check token rejected');
  });

  it('hides eval export buttons unless the controller provides exportEval', () => {
    const root = mount(ctl());
    expect(root.querySelector('[data-testid="btn-export-eval-local"]')).toBeNull();
  });

  it('exports an eval run per mode and hands the payload to saveEval', async () => {
    const payload = { mode: 'cloud-enabled', entities: [], relations: [], wallClockMs: 5 } as unknown as Predictions;
    const exportEval = vi.fn(async (_m: EvalMode) => payload);
    const saveEval = vi.fn();
    const root = mount(ctl({ exportEval, saveEval }));
    q(root, 'btn-export-eval-cloud').click();
    await flush();
    expect(exportEval).toHaveBeenCalledWith('cloud-enabled');
    expect(saveEval).toHaveBeenCalledWith(payload);
    expect(q(root, 'eval-export-status').textContent).toContain('Exported cloud-enabled run');
  });
});
