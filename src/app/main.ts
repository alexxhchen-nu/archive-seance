import './styles.css';
import { mountHybridProbePanel } from './panels/HybridProbePanel';
import type { ProbeController } from './panels/HybridProbePanel';
import { mountOpenPdfPanel } from './panels/OpenPdfPanel';
import { loadAndIndex } from './loadAndIndex';
import type { IndexSummary } from './loadAndIndex';
import { downloadPredictions, runEvalExport } from './evalExport';
import type { GenerateLike } from '../ai/call';
import { DEFAULTS } from '../config/defaults';
import { loadPdfFromFile, loadPdfFromUrl, requestHostPermission } from '../pdf/loadPdf';
import { openPdf } from '../pdf/openPdf';
import { clearAll, getIndex, putIndex } from '../storage/indexCache';

let lastIndexed: IndexSummary | undefined;
const remember = (p: Promise<IndexSummary>): Promise<IndexSummary> => p.then((s) => { lastIndexed = s; return s; });

function mountPdf(root: HTMLElement): void {
  const cfg = DEFAULTS;
  const permissions = chrome.permissions;
  const open = (bytes: Uint8Array) => openPdf(bytes, cfg);
  const cache = { getIndex: (id: string) => getIndex(id), putIndex: (i: Parameters<typeof putIndex>[0]) => putIndex(i) };
  const src = new URLSearchParams(location.search).get('src') ?? undefined;
  mountOpenPdfPanel(root, {
    cfg,
    ...(src ? { sourceUrl: src } : {}),
    indexFile: (file) => remember(loadAndIndex({ load: () => loadPdfFromFile(file, cfg), open, cache }, cfg)),
    indexUrl: (url) => remember(loadAndIndex({ load: () => loadPdfFromUrl(url, { fetch: (u, init) => fetch(u, init), permissions }, cfg), open, cache }, cfg)),
    requestPermission: (url) => requestHostPermission(permissions, url),
    clearCache: () => clearAll()
  });
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  mountPdf(root);
  let ctl: ProbeController & { evalModel?: () => GenerateLike };
  if (import.meta.env.MODE === 'mock') {
    const { createMockController } = await import('../ai/mock/mockFirebase');
    ctl = createMockController(location.search);
  } else {
    const { createRealController } = await import('./realController');
    ctl = createRealController(import.meta.env);
  }
  const evalModel = ctl.evalModel;
  if (ctl.firebaseOk && evalModel) {
    const flavor = import.meta.env.MODE === 'mock' ? 'mock' : 'real';
    const sha = (import.meta.env as Record<string, unknown>).VITE_GIT_SHA;
    ctl = {
      ...ctl,
      exportEval: async (mode) => {
        if (!lastIndexed) throw new Error('Open the NHPRC PDF before exporting an eval run.');
        const { availability } = await ctl.probeAvailability();
        return runEvalExport(lastIndexed, mode, {
          cfg: DEFAULTS, model: evalModel(), flavor, gitSha: typeof sha === 'string' && sha ? sha : null,
          env: () => ({ localAvailability: availability, online: navigator.onLine, localChunksUsed: 0 })
        });
      },
      saveEval: (p) => downloadPredictions(p)
    };
  }
  mountHybridProbePanel(root, ctl);
}

void boot();
