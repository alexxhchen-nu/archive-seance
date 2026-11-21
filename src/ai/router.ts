import type { Config } from '../config/defaults';
import type { DeviceAvailability, Sensitivity } from '../types';

export type Task =
  | { kind: 'extract'; chunkChars: number }
  | { kind: 'cross-page' }
  | { kind: 'adjudicate' };

export interface DocInfo {
  sensitivity: Sensitivity;
  pages: number;
}

export interface Env {
  localAvailability: DeviceAvailability;
  online: boolean;
  localChunksUsed: number;
}

export interface RouteDecision {
  route: 'local' | 'cloud' | 'blocked';
  reason: string;
}

export type RouterConfig = Pick<
  Config,
  'routeLocalMaxChunkChars' | 'routeLocalChunkBudget' | 'routeLongDocPages' | 'crossPageMode' | 'cloudEnabled'
>;

export function decideRoute(task: Task, doc: DocInfo, env: Env, cfg: RouterConfig): RouteDecision {
  const localOk = env.localAvailability === 'available';
  if (doc.sensitivity === 'sensitive') {
    return localOk
      ? { route: 'local', reason: 'sensitive document stays on device' }
      : { route: 'blocked', reason: `sensitive document and on-device model is ${env.localAvailability}` };
  }

  const cloudOk = cfg.cloudEnabled && env.online;
  const noCloud = !cfg.cloudEnabled ? 'cloud disabled' : 'offline';
  switch (task.kind) {
    case 'extract': {
      const fitsLocal = task.chunkChars <= cfg.routeLocalMaxChunkChars;
      const budgetLeft = env.localChunksUsed < cfg.routeLocalChunkBudget;
      const longDoc = doc.pages > cfg.routeLongDocPages;
      /** R4.3 / R4.4 / design 5.2: the local chunk budget only applies to documents longer than routeLongDocPages. */
      const withinBudget = budgetLeft || !longDoc;
      if (localOk && fitsLocal && withinBudget) return { route: 'local', reason: 'fits local limits' };
      if (cloudOk) {
        const why = !localOk
          ? `on-device model is ${env.localAvailability}`
          : !fitsLocal ? 'chunk too large for device' : 'local budget exhausted on long document';
        return { route: 'cloud', reason: why };
      }
      return localOk
        ? { route: 'local', reason: `${noCloud}; best effort local` }
        : { route: 'blocked', reason: `no route available: on-device model is ${env.localAvailability}, ${noCloud}` };
    }
    case 'cross-page':
      if (cfg.crossPageMode === 'local_only') {
        return localOk
          ? { route: 'local', reason: 'config: cross-page local only' }
          : { route: 'blocked', reason: `config: cross-page local only and on-device model is ${env.localAvailability}` };
      }
      if (cloudOk) return { route: 'cloud', reason: 'cross-page reasoning needs long context' };
      return localOk
        ? { route: 'local', reason: `${noCloud}; reduced local batch` }
        : { route: 'blocked', reason: `no route available: on-device model is ${env.localAvailability}, ${noCloud}` };
    case 'adjudicate':
      if (localOk) return { route: 'local', reason: 'short prompt fits on device' };
      if (cloudOk) return { route: 'cloud', reason: `on-device model is ${env.localAvailability}` };
      return { route: 'blocked', reason: `no route available: on-device model is ${env.localAvailability}, ${noCloud}` };
  }
}
