import type { DemoPayload } from '../consoleDemo';
import { describeError } from './HybridProbePanel';

export interface ConsoleDemoController {
  /** Runs T17 extraction + T18 merge on the open document. Called only from the Summon click. */
  summon(onStatus: (msg: string) => void): Promise<DemoPayload>;
  /** Saves the payload as a JSON download. */
  download?(p: DemoPayload): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

const pct = (x: number): string => x.toFixed(2);

function entityItem(e: DemoPayload['entities'][number]): HTMLLIElement {
  const li = el('li', { class: `entity ${e.status}`, 'data-testid': 'demo-entity', 'data-status': e.status });
  li.style.opacity = String(e.status === 'ghost' ? e.opacity : 1);
  li.append(
    el('strong', {}, e.label),
    ` (${e.type}) · `,
    el('span', { class: 'status', 'data-testid': 'demo-entity-status' }, e.status === 'ghost' ? 'Possible match (ghost)' : 'Solid'),
    ` · confidence ${pct(e.confidence)}`
  );
  const details = el('details', { 'data-testid': 'demo-entity-detail' });
  details.append(el('summary', {}, 'Details'));
  if (e.members.length > 1) details.append(el('p', {}, `Members: ${e.members.join(' / ')}`));
  if (e.weakestLink) {
    const s = e.weakestLink.score;
    details.append(el('p', {}, `Weakest link: ${e.weakestLink.a} ↔ ${e.weakestLink.b} = ${pct(s.total)} ` +
      `(name ${pct(s.name)}, context ${pct(s.context)}, verdict ${s.verdict === null ? 'none' : pct(s.verdict)}${s.capped ? `, capped: ${s.capped}` : ''})`));
  }
  const ev = el('ul', {});
  ev.append(...e.evidence.map((x) => el('li', { 'data-testid': 'demo-evidence' }, `p. ${x.page}: “${x.quote}”`)));
  details.append(ev);
  li.append(details);
  return li;
}

/** T20 debug console: Summon -> runExtraction -> buildEntities, list + JSON dump. No graph (T22). */
export function mountConsoleDemoPanel(root: HTMLElement, ctl: ConsoleDemoController): void {
  const card = el('section', { class: 'card', 'aria-labelledby': 'demo-heading', 'data-testid': 'console-demo' });
  card.append(el('h2', { id: 'demo-heading' }, 'Console demo (debug)'),
    el('p', { class: 'note' }, 'Open a PDF above, then Summon to run local extraction and merge. Machine-extracted; verify against source.'));
  const controls = el('div', { class: 'controls' });
  const btnSummon = el('button', { type: 'button', 'data-testid': 'btn-summon' }, 'Summon');
  const btnCopy = el('button', { type: 'button', 'data-testid': 'btn-demo-copy', disabled: '' }, 'Copy JSON');
  const btnDownload = el('button', { type: 'button', 'data-testid': 'btn-demo-download', disabled: '' }, 'Download JSON');
  controls.append(btnSummon, btnCopy, btnDownload);
  const status = el('p', { class: 'meta', role: 'status', 'aria-live': 'polite', 'data-testid': 'demo-status' });
  const thresholds = el('p', { class: 'meta', 'data-testid': 'demo-thresholds' });
  const err = el('p', { class: 'error', role: 'alert', 'data-testid': 'demo-error' });
  const list = el('ul', { class: 'entities', 'data-testid': 'demo-entities' });
  const json = el('pre', { 'data-testid': 'demo-json' });
  card.append(controls, status, thresholds, err, list, json);
  root.append(card);

  let payload: DemoPayload | undefined;
  const text = (): string => JSON.stringify(payload, null, 2);

  btnSummon.addEventListener('click', () => {
    btnSummon.disabled = true;
    err.textContent = '';
    status.textContent = 'Summoning…';
    ctl.summon((m) => { status.textContent = m; })
      .then((p) => {
        payload = p;
        const solid = p.entities.filter((e) => e.status === 'solid').length;
        status.textContent = `${p.entities.length} entities (${solid} solid, ${p.entities.length - solid} ghost), ` +
          `${p.relations.length} relations; chunks local ${p.chunks.local}/${p.chunks.total}; dropped unanchored ${p.droppedUnanchored}.`;
        thresholds.textContent = `Thresholds: solid ≥ ${p.thresholds.mergeAutoThreshold}, ghost ≥ ${p.thresholds.mergeGhostThreshold} (source: ${p.thresholds.source}).`;
        list.replaceChildren(...p.entities.map(entityItem));
        json.textContent = text();
        btnCopy.disabled = false;
        btnDownload.disabled = !ctl.download;
      })
      .catch((e: unknown) => {
        status.textContent = '';
        err.textContent = describeError(e);
      })
      .finally(() => { btnSummon.disabled = false; });
  });
  btnCopy.addEventListener('click', () => {
    if (!payload) return;
    navigator.clipboard.writeText(text()).then(
      () => { status.textContent = 'Copied JSON.'; },
      () => { status.textContent = 'Copy failed; select the JSON below.'; }
    );
  });
  btnDownload.addEventListener('click', () => { if (payload) ctl.download?.(payload); });
}
