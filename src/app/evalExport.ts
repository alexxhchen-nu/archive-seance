import { buildPredictions } from '../eval/predictions';
import type { BuildFlavor, EvalMode, Predictions } from '../eval/predictions';
import type { Config } from '../config/defaults';
import type { GenerateLike } from '../ai/call';
import type { Env } from '../ai/router';
import { runExtraction } from '../pipeline/runExtraction';
import type { Chunk, PageText } from '../types';

/** Fixture id of the reviewed NHPRC gold (test/fixtures/eval/nhprc-2015-11/gold.json). */
export const NHPRC_FIXTURE_ID = 'nhprc-2015-11-p1-p2';
/** SHA-256 of the official NHPRC 2015-11 PDF (docs/DEMO_SOURCES.md and gold.json source.sha256). */
export const NHPRC_PDF_SHA256 = 'ecb7abc7009f6e7fe95187c483c795100dd0fa375a51640c210eedd7c5be2fd9';
export const NHPRC_PAGES: readonly number[] = [1, 2];

export interface EvalExportDeps {
  cfg: Config;
  /** On-device model (only_on_device), as runExtraction requires. */
  model: GenerateLike;
  env: () => Env;
  flavor: BuildFlavor;
  gitSha: string | null;
  now?: () => Date;
  clock?: () => number;
}

/** Runs the local extraction pipeline on NHPRC pages 1–2 of an indexed document and builds the eval payload. */
export async function runEvalExport(doc: { pageTexts: PageText[]; chunkList: Chunk[] }, mode: EvalMode, deps: EvalExportDeps): Promise<Predictions> {
  const now = deps.now ?? (() => new Date());
  const clock = deps.clock ?? (() => performance.now());
  const pages = doc.pageTexts.filter((p) => NHPRC_PAGES.includes(p.page));
  const chunks = doc.chunkList.filter((c) => NHPRC_PAGES.includes(c.page));
  if (pages.length !== NHPRC_PAGES.length) throw new Error('Open the NHPRC PDF (pages 1–2 must be indexed) before exporting an eval run.');
  const docId = pages[0]?.docId ?? '';
  if (docId !== NHPRC_PDF_SHA256) {
    throw new Error('The open document is not the NHPRC 2015-11 minutes (SHA-256 mismatch). See docs/DEMO_SOURCES.md.');
  }
  const cfg = { ...deps.cfg, cloudEnabled: mode === 'cloud-enabled' };
  const t0 = clock();
  const result = await runExtraction(
    { docId: pages[0]?.docId ?? '', sensitivity: 'public', pages, chunks },
    { cfg, model: deps.model, env: deps.env }
  );
  const wallClockMs = Math.round(clock() - t0);
  const modelCalls = result.log.filter((l) => l.inferenceSource === 'on_device' || l.inferenceSource === 'in_cloud').length;
  if (result.aborted || modelCalls === 0) {
    throw new Error(
      'Eval extraction made no model calls (on-device model may be unavailable, or the run was aborted). ' +
      'Enable on-device AI and retry. Cloud-routed chunks are not extracted yet, so a cloud-enabled export also needs a local model. Nothing was exported.'
    );
  }
  return buildPredictions(result, {
    fixtureId: NHPRC_FIXTURE_ID, mode, flavor: deps.flavor, gitSha: deps.gitSha,
    timestamp: now().toISOString(), wallClockMs, mergeCfg: cfg
  });
}

/** Saves the payload as a JSON download. */
export function downloadPredictions(p: Predictions, doc: Document = document): void {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = doc.createElement('a');
  a.href = url;
  a.download = `eval-${p.fixtureId}-${p.mode}-${p.timestamp.replace(/[:.]/g, '-')}.json`;
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
