// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountOpenPdfPanel } from '../../../../src/app/panels/OpenPdfPanel';
import type { OpenPdfController } from '../../../../src/app/panels/OpenPdfPanel';
import type { IndexSummary } from '../../../../src/app/loadAndIndex';
import { PdfLoadError } from '../../../../src/pdf/loadPdf';
import { DEFAULTS } from '../../../../src/config/defaults';

const q = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const flush = () => new Promise((r) => setTimeout(r, 0));

const summary: IndexSummary = {
  title: 'mixed-scanned.pdf', docId: 'abcdef0123456789'.repeat(4), pages: 3, chunks: 2,
  noTextPages: [2], pageTexts: [], chunkList: []
};

function ctl(over: Partial<OpenPdfController> = {}): OpenPdfController {
  return {
    cfg: DEFAULTS,
    indexFile: vi.fn(async () => summary),
    indexUrl: vi.fn(async () => summary),
    requestPermission: vi.fn(async () => true),
    ...over
  };
}

function mount(c: OpenPdfController) {
  const root = document.createElement('div');
  document.body.append(root);
  mountOpenPdfPanel(root, c);
  return root;
}

function choose(root: HTMLElement, file: File): void {
  const input = q(root, 'pdf-file-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change'));
}

describe('OpenPdfPanel', () => {
  it('has a labelled file input and a polite status region', () => {
    const root = mount(ctl());
    const input = q(root, 'pdf-file-input') as HTMLInputElement;
    expect(input.labels?.[0]?.textContent).toBe('Open local PDF');
    expect(input.accept).toBe('application/pdf,.pdf');
    expect(q(root, 'pdf-status').getAttribute('aria-live')).toBe('polite');
    expect(q(root, 'pdf-error').getAttribute('role')).toBe('alert');
  });

  it('shows counts, hash and one entry per no-text page', async () => {
    const root = mount(ctl());
    choose(root, new File(['x'], 'mixed-scanned.pdf'));
    await flush();
    expect(q(root, 'pdf-title').textContent).toBe('mixed-scanned.pdf');
    expect(q(root, 'pdf-pages').textContent).toBe('Pages: 3');
    expect(q(root, 'pdf-chunks').textContent).toBe('Chunks: 2');
    expect(q(root, 'pdf-hash').textContent).toBe('abcdef012345');
    const nt = root.querySelectorAll('[data-testid="pdf-no-text-page"]');
    expect([...nt].map((n) => n.textContent)).toEqual(['Page 2: This page looks scanned (no text layer)']);
    expect(q(root, 'pdf-error').hidden).toBe(true);
  });

  it('shows the error and clears counts on PdfLoadError', async () => {
    const indexFile = vi.fn<OpenPdfController['indexFile']>(async () => summary);
    const root = mount(ctl({ indexFile }));
    choose(root, new File(['x'], 'a.pdf'));
    await flush();
    indexFile.mockRejectedValueOnce(new PdfLoadError('not-pdf', 'This file is not a PDF (missing %PDF- header)'));
    choose(root, new File(['x'], 'notes.txt'));
    await flush();
    expect(q(root, 'pdf-error').hidden).toBe(false);
    expect(q(root, 'pdf-error').textContent).toMatch(/^This file is not a PDF/);
    expect(root.querySelector('[data-testid="pdf-pages"]')).toBeNull();
  });

  it('offers an origin button for permission-needed; click requests first, then loads', async () => {
    const indexUrl = vi.fn<OpenPdfController['indexUrl']>()
      .mockRejectedValueOnce(new PdfLoadError('permission-needed', 'Access to https://a.example has not been granted yet', 'https://a.example'))
      .mockResolvedValueOnce(summary);
    const order: string[] = [];
    const requestPermission = vi.fn(async () => { order.push('request'); return true; });
    const root = mount(ctl({ sourceUrl: 'https://a.example/x.pdf', indexUrl, requestPermission }));
    await flush();
    const btn = q(root, 'btn-allow-origin') as HTMLButtonElement;
    expect(btn.hidden).toBe(false);
    expect(btn.tagName).toBe('BUTTON');
    expect(btn.textContent).toBe('Allow access to https://a.example');
    btn.click();
    expect(requestPermission).toHaveBeenCalledWith('https://a.example/x.pdf');
    await flush();
    await flush();
    expect(order).toEqual(['request']);
    expect(indexUrl).toHaveBeenCalledTimes(2);
    expect(q(root, 'pdf-pages').textContent).toBe('Pages: 3');
  });

  it('reports a denied permission', async () => {
    const indexUrl = vi.fn<OpenPdfController['indexUrl']>()
      .mockRejectedValue(new PdfLoadError('permission-needed', 'Access to https://a.example has not been granted yet', 'https://a.example'));
    const root = mount(ctl({ sourceUrl: 'https://a.example/x.pdf', indexUrl, requestPermission: vi.fn(async () => false) }));
    await flush();
    q(root, 'btn-allow-origin').click();
    await flush();
    expect(q(root, 'pdf-error').textContent).toBe('Permission was not granted for https://a.example');
    expect(indexUrl).toHaveBeenCalledTimes(1);
  });
});
