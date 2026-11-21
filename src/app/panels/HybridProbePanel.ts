import type { AvailabilityProbe } from '../../ai/availability';
import type { HybridProbeResult } from '../../ai/hybridProbe';
import type { HybridModeName } from '../../types';
import { createStore } from '../state/store';

/** Everything the panel needs; real and scripted wiring both implement it. */
export interface ProbeController {
  firebaseOk: boolean;
  firebaseLabel: string;
  appCheckLabel: string;
  banner?: string;
  probeAvailability(): Promise<AvailabilityProbe>;
  /** Called only from the "Enable on-device AI" click handler. */
  enableDevice(onProgress: (p: number) => void): Promise<void>;
  run(mode: HybridModeName): Promise<HybridProbeResult>;
}

interface PanelState {
  device?: AvailabilityProbe;
  progress?: number;
  busy: boolean;
  result?: HybridProbeResult;
  error?: string;
}

export function describeError(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  const msg = e instanceof Error ? e.message : String(e);
  if (name === 'ModelTimeoutError') return `The model did not answer in time. ${msg}.`;
  if (name === 'ModelOutputParseError') return `The model returned output that is not valid extraction JSON (${msg}).`;
  if (name === 'MissingInferenceSourceError') return 'The SDK did not report where inference ran; result discarded.';
  if (name === 'PrivacyInvariantError') return msg;
  if (/\b(401|403)\b|app[- ]?check/i.test(msg)) {
    return 'App Check token rejected: register the debug token in the Firebase console (see README).';
  }
  if (/on-?device|LanguageModel|not available|unavailable/i.test(msg)) {
    return `On-device model unavailable: ${msg}. Try "Enable on-device AI" or run in the cloud.`;
  }
  return `Request failed: ${msg}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function mountHybridProbePanel(root: HTMLElement, ctl: ProbeController): void {
  const store = createStore<PanelState>({ busy: false });

  if (ctl.banner) root.append(el('div', { class: 'banner', 'data-testid': 'flavor-banner' }, ctl.banner));

  const chips = el('div', { class: 'chips' });
  const chipFirebase = el('span', { class: 'chip', 'data-testid': 'chip-firebase' }, `Firebase config: ${ctl.firebaseLabel}`);
  const chipAppCheck = el('span', { class: 'chip', 'data-testid': 'chip-appcheck' }, `App Check: ${ctl.appCheckLabel}`);
  const chipDevice = el('span', { class: 'chip', 'data-testid': 'chip-device' }, 'On-device: checking…');
  const chipCloud = el('span', { class: 'chip', 'data-testid': 'chip-cloud' }, 'Cloud: allowed');
  chipFirebase.classList.toggle('bad', !ctl.firebaseOk);
  chips.append(chipFirebase, chipAppCheck, chipDevice, chipCloud);

  const controls = el('div', { class: 'controls' });
  const btnEnable = el('button', { type: 'button', 'data-testid': 'btn-enable-device' }, 'Enable on-device AI');
  const progress = el('span', { class: 'progress', 'data-testid': 'device-progress' });
  const btnDevice = el('button', { type: 'button', 'data-testid': 'btn-run-device' }, 'Run on-device only');
  const btnHybrid = el('button', { type: 'button', 'data-testid': 'btn-run-hybrid' }, 'Run hybrid (prefer on-device)');
  const btnCloud = el('button', { type: 'button', 'data-testid': 'btn-run-cloud' }, 'Run in cloud only');
  controls.append(btnEnable, progress, btnDevice, btnHybrid, btnCloud);
  const configNote = el('p', { class: 'note', 'data-testid': 'config-note' });
  if (!ctl.firebaseOk) {
    configNote.textContent =
      'Firebase config missing: copy .env.example to .env.local, fill in the values, and rebuild. AI buttons are disabled.';
  }

  const card = el('section', { class: 'card', 'data-testid': 'result-card' });
  const badge = el('div', { class: 'badge', 'data-testid': 'path-badge' });
  const meta = el('p', { class: 'meta' });
  const modeReq = el('span', { 'data-testid': 'mode-requested' });
  const latency = el('span', { 'data-testid': 'latency' });
  meta.append('Requested mode: ', modeReq, ' · Latency: ', latency);
  const entList = el('ul', { 'data-testid': 'entities' });
  const relList = el('ul', { 'data-testid': 'relations' });
  const json = el('pre', { 'data-testid': 'result-json' });
  const err = el('p', { class: 'error', role: 'alert', 'data-testid': 'probe-error' });
  card.append(badge, meta, el('h3', {}, 'Entities'), entList, el('h3', {}, 'Relations'), relList, json, err);

  root.append(chips, controls, configNote, card, el('footer', {}, 'Machine-extracted; verify against source.'));

  const runButtons: [HTMLButtonElement, HybridModeName][] = [
    [btnDevice, 'only_on_device'], [btnHybrid, 'prefer_on_device'], [btnCloud, 'only_in_cloud']
  ];

  store.subscribe((s) => {
    chipDevice.textContent = s.device ? `On-device: ${s.device.availability} (${s.device.hint})` : 'On-device: checking…';
    progress.textContent = s.progress === undefined ? '' : `Download: ${Math.round(s.progress * 100)}%`;
    const disabled = !ctl.firebaseOk || s.busy;
    for (const [b] of runButtons) b.disabled = disabled;
    btnEnable.disabled = disabled;
    const r = s.result;
    badge.textContent = r ? (r.source === 'on_device' ? 'Ran on-device' : 'Ran in cloud') : '';
    badge.hidden = !r;
    badge.className = `badge ${r?.source === 'in_cloud' ? 'cloud' : 'ondevice'}`;
    card.hidden = !r && !s.error;
    modeReq.textContent = r?.requestedMode ?? '';
    latency.textContent = r ? `${Math.round(r.ms)} ms` : '';
    entList.replaceChildren(...(r?.entities ?? []).map((e) => el('li', {}, `${e.name} (${e.type}): “${e.quote}”`)));
    relList.replaceChildren(...(r?.relations ?? []).map((x) => el('li', {}, `${x.subject} —${x.label}→ ${x.object}: “${x.quote}”`)));
    json.textContent = r ? r.rawText : '';
    err.textContent = s.error ?? '';
  });

  const refreshDevice = async (): Promise<void> => {
    store.set({ device: await ctl.probeAvailability() });
  };

  btnEnable.addEventListener('click', () => {
    store.set({ busy: true, error: undefined, progress: 0 });
    ctl.enableDevice((p) => store.set({ progress: p }))
      .then(refreshDevice)
      .catch((e: unknown) => store.set({ error: describeError(e) }))
      .finally(() => store.set({ busy: false }));
  });

  for (const [btn, mode] of runButtons) {
    btn.addEventListener('click', () => {
      store.set({ busy: true, error: undefined, result: undefined });
      ctl.run(mode)
        .then((result) => store.set({ result }))
        .catch((e: unknown) => store.set({ error: describeError(e) }))
        .finally(() => store.set({ busy: false }));
    });
  }

  void refreshDevice();
}
