import './styles.css';
import { mountHybridProbePanel } from './panels/HybridProbePanel';
import type { ProbeController } from './panels/HybridProbePanel';

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
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
