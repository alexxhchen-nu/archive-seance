import './styles.css';
import { mountHybridProbePanel } from './panels/HybridProbePanel';
import type { ProbeController } from './panels/HybridProbePanel';
import { mountOpenPdfPanel } from './panels/OpenPdfPanel';
import { loadAndIndex } from './loadAndIndex';
import { DEFAULTS } from '../config/defaults';
import { loadPdfFromFile, loadPdfFromUrl, requestHostPermission } from '../pdf/loadPdf';
import { openPdf } from '../pdf/openPdf';

function mountPdf(root: HTMLElement): void {
  const cfg = DEFAULTS;
  const permissions = chrome.permissions;
  const open = (bytes: Uint8Array) => openPdf(bytes, cfg);
  const src = new URLSearchParams(location.search).get('src') ?? undefined;
  mountOpenPdfPanel(root, {
    cfg,
    ...(src ? { sourceUrl: src } : {}),
    indexFile: (file) => loadAndIndex({ load: () => loadPdfFromFile(file, cfg), open }, cfg),
    indexUrl: (url) => loadAndIndex({ load: () => loadPdfFromUrl(url, { fetch: (u, init) => fetch(u, init), permissions }, cfg), open }, cfg),
    requestPermission: (url) => requestHostPermission(permissions, url)
  });
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  mountPdf(root);
  let ctl: ProbeController;
  if (import.meta.env.MODE === 'mock') {
    const { createMockController } = await import('../ai/mock/mockFirebase');
    ctl = createMockController(location.search);
  } else {
    const { createRealController } = await import('./realController');
    ctl = createRealController(import.meta.env);
  }
  mountHybridProbePanel(root, ctl);
}

void boot();
