import type { Config } from '../../config/defaults';
import type { IndexSummary } from '../loadAndIndex';
import { PdfLoadError } from '../../pdf/loadPdf';

export interface OpenPdfController {
  cfg: Pick<Config, 'maxPdfMegabytes'>;
  /** `src` query parameter, if the app was opened for a URL. */
  sourceUrl?: string;
  indexFile(file: File): Promise<IndexSummary>;
  indexUrl(url: string): Promise<IndexSummary>;
  /** Must call chrome.permissions.request synchronously (user gesture). */
  requestPermission(url: string): Promise<boolean>;
  /** Deletes every cached page index. */
  clearCache?(): Promise<void>;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function messageOf(e: unknown): string {
  if (e instanceof PdfLoadError) return e.message;
  return `Could not open the PDF: ${e instanceof Error ? e.message : String(e)}`;
}

export function mountOpenPdfPanel(root: HTMLElement, ctl: OpenPdfController): void {
  const card = el('section', { class: 'card', 'aria-labelledby': 'open-pdf-heading' });
  card.append(el('h2', { id: 'open-pdf-heading' }, 'Document'));

  const label = el('label', { for: 'pdf-file-input' }, 'Open local PDF');
  const input = el('input', { type: 'file', id: 'pdf-file-input', accept: 'application/pdf,.pdf', 'data-testid': 'pdf-file-input' });
  const allow = el('button', { type: 'button', 'data-testid': 'btn-allow-origin', hidden: '' });
  const status = el('p', { 'data-testid': 'pdf-status', role: 'status', 'aria-live': 'polite', class: 'meta' });
  const error = el('p', { 'data-testid': 'pdf-error', role: 'alert', class: 'error', hidden: '' });
  const result = el('div', { 'data-testid': 'pdf-result', hidden: '' });
  const clearBtn = el('button', { type: 'button', 'data-testid': 'btn-clear-cache' }, 'Clear cached documents');
  card.append(el('div', { class: 'controls' }), status, error, result);
  card.querySelector('.controls')!.append(label, input, allow, clearBtn);
  root.append(card);

  let pendingUrl: string | undefined;

  const clear = (): void => {
    error.hidden = true;
    error.textContent = '';
    result.hidden = true;
    result.replaceChildren();
    allow.hidden = true;
  };

  const showError = (msg: string): void => {
    error.textContent = msg;
    error.hidden = false;
    status.textContent = msg;
  };

  const show = (s: IndexSummary): void => {
    result.replaceChildren(
      el('p', { 'data-testid': 'pdf-title' }, s.title),
      el('p', { 'data-testid': 'pdf-pages' }, `Pages: ${s.pages}`),
      el('p', { 'data-testid': 'pdf-chunks' }, `Chunks: ${s.chunks}`),
      el('p', { 'data-testid': 'pdf-hash', class: 'meta', title: s.docId }, s.docId.slice(0, 12)),
      ...s.noTextPages.map((n) => el('p', { 'data-testid': 'pdf-no-text-page', class: 'warn' }, `Page ${n}: This page looks scanned (no text layer)`))
    );
    if (s.fromCache) result.append(el('p', { 'data-testid': 'pdf-cached', class: 'meta' }, 'Served from cache'));
    result.hidden = false;
    status.textContent = s.fromCache
      ? `Served from cache: ${s.title}: ${s.pages} pages, ${s.chunks} chunks.`
      : `Indexed ${s.title}: ${s.pages} pages, ${s.chunks} chunks.`;
  };

  const run = async (job: () => Promise<IndexSummary>): Promise<void> => {
    clear();
    status.textContent = 'Loading PDF…';
    try {
      show(await job());
    } catch (e) {
      if (e instanceof PdfLoadError && e.code === 'permission-needed' && pendingUrl && e.origin) {
        showError(`${e.message}.`);
        allow.textContent = `Allow access to ${e.origin}`;
        allow.dataset.origin = e.origin;
        allow.hidden = false;
        return;
      }
      showError(messageOf(e));
    }
  };

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    pendingUrl = undefined;
    void run(() => ctl.indexFile(file));
  });

  clearBtn.addEventListener('click', async () => {
    if (!ctl.clearCache) return;
    try {
      await ctl.clearCache();
    } catch (e) {
      showError(`Could not clear cached documents: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    result.querySelector('[data-testid="pdf-cached"]')?.remove();
    status.textContent = 'Cleared cached documents.';
  });

  allow.addEventListener('click', async () => {
    const url = pendingUrl;
    if (!url) return;
    let granted: boolean;
    try {
      granted = await ctl.requestPermission(url);
    } catch (e) {
      showError(messageOf(e));
      return;
    }
    if (granted) await run(() => ctl.indexUrl(url));
    else showError(`Permission was not granted for ${allow.dataset.origin ?? url}`);
  });

  if (ctl.sourceUrl) {
    pendingUrl = ctl.sourceUrl;
    const url = ctl.sourceUrl;
    void run(() => ctl.indexUrl(url));
  }
}
