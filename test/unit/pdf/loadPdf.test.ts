import { describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import {
  PdfLoadError, hasHostPermission, loadPdfFromFile, loadPdfFromUrl, originPattern, requestHostPermission
} from '../../../src/pdf/loadPdf';
import type { FetchLike, PermissionsLike } from '../../../src/pdf/loadPdf';

const cfg = { maxPdfMegabytes: 1 };
const MB = 1024 * 1024;
const pdfBytes = new TextEncoder().encode('%PDF-1.4\n% tiny\n%%EOF\n');

async function code(p: Promise<unknown>): Promise<PdfLoadError> {
  const e = await p.then(() => undefined, (x: unknown) => x);
  expect(e).toBeInstanceOf(PdfLoadError);
  return e as PdfLoadError;
}

function perms(granted: boolean): PermissionsLike & { contains: ReturnType<typeof vi.fn>; request: ReturnType<typeof vi.fn> } {
  return { contains: vi.fn(async () => granted), request: vi.fn(async () => true) };
}

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i < chunks.length) c.enqueue(chunks[i++]!);
      else c.close();
    }
  });
}

describe('loadPdfFromFile', () => {
  it('loads a PDF file and hashes it', async () => {
    const f = new File([pdfBytes], 'minutes.pdf', { type: 'application/pdf' });
    const r = await loadPdfFromFile(f, cfg);
    expect(r.title).toBe('minutes.pdf');
    expect(r.sizeBytes).toBe(pdfBytes.length);
    expect(r.docId).toBe(createHash('sha256').update(pdfBytes).digest('hex'));
    expect(r.sourceUrl).toBeUndefined();
  });

  it('accepts a header after leading junk within 1024 bytes; Blob gets fallback title', async () => {
    const r = await loadPdfFromFile(new Blob([new Uint8Array(100), pdfBytes]), cfg);
    expect(r.title).toBe('Untitled PDF');
  });

  it('rejects non-PDF content naming the cause', async () => {
    const e = await code(loadPdfFromFile(new File(['hello'], 'notes.txt'), cfg));
    expect(e.code).toBe('not-pdf');
    expect(e.message).toBe('This file is not a PDF (missing %PDF- header)');
    const late = await code(loadPdfFromFile(new Blob([new Uint8Array(1024), pdfBytes]), cfg));
    expect(late.code).toBe('not-pdf');
  });

  it('rejects by size before reading', async () => {
    const arrayBuffer = vi.fn();
    const fake = { size: 63.2 * MB, arrayBuffer } as unknown as Blob;
    const e = await code(loadPdfFromFile(fake, { maxPdfMegabytes: 50 }));
    expect(e.code).toBe('too-large');
    expect(e.message).toBe('File is 63.2 MB; the limit is 50 MB');
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});

describe('originPattern and permissions', () => {
  it('builds origin patterns including ports', () => {
    expect(originPattern('https://archive.example.org/a/b.pdf?x=1')).toBe('https://archive.example.org/*');
    expect(originPattern('http://localhost:8080/x.pdf')).toBe('http://localhost:8080/*');
  });

  it.each(['file:///tmp/a.pdf', 'data:application/pdf;base64,JVBE', 'blob:https://a.example/123',
    'chrome-extension://abc/x.pdf', 'javascript:void(0)', 'not a url'])('rejects %s', (u) => {
    expect(() => originPattern(u)).toThrowError(PdfLoadError);
    try { originPattern(u); } catch (e) { expect((e as PdfLoadError).code).toBe('unsupported-scheme'); }
  });

  it('requestHostPermission calls request synchronously with only the origin', () => {
    const p = perms(false);
    void requestHostPermission(p, 'https://archive.example.org:8443/docs/a.pdf');
    expect(p.request).toHaveBeenCalledTimes(1);
    expect(p.request).toHaveBeenCalledWith({ origins: ['https://archive.example.org:8443/*'] });
    expect(p.contains).not.toHaveBeenCalled();
  });

  it('hasHostPermission asks contains for the origin', async () => {
    const p = perms(true);
    expect(await hasHostPermission(p, 'https://a.example/x')).toBe(true);
    expect(p.contains).toHaveBeenCalledWith({ origins: ['https://a.example/*'] });
  });
});

describe('loadPdfFromUrl', () => {
  const url = 'https://archive.example.org/papers/Lantern%20Minutes.pdf';

  it('throws permission-needed without fetching', async () => {
    const fetch = vi.fn<FetchLike>();
    const e = await code(loadPdfFromUrl(url, { fetch, permissions: perms(false) }, cfg));
    expect(e.code).toBe('permission-needed');
    expect(e.origin).toBe('https://archive.example.org');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches once without credentials when permission is held', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response(pdfBytes));
    const r = await loadPdfFromUrl(url, { fetch, permissions: perms(true) }, cfg);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ credentials: 'omit' });
    expect(r.docId).toBe(createHash('sha256').update(pdfBytes).digest('hex'));
    expect(r.title).toBe('Lantern Minutes.pdf');
    expect(r.sourceUrl).toBe(url);
  });

  it('falls back to Untitled PDF for a bare origin', async () => {
    const fetch = vi.fn<FetchLike>(async () => new Response(pdfBytes));
    expect((await loadPdfFromUrl('https://a.example/', { fetch, permissions: perms(true) }, cfg)).title).toBe('Untitled PDF');
  });

  it('rejects unsupported schemes before anything else', async () => {
    const p = perms(true);
    const fetch = vi.fn<FetchLike>();
    expect((await code(loadPdfFromUrl('file:///a.pdf', { fetch, permissions: p }, cfg))).code).toBe('unsupported-scheme');
    expect(p.contains).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('maps HTTP errors and network failures to fetch-failed', async () => {
    const e = await code(loadPdfFromUrl(url, { fetch: async () => new Response('x', { status: 404 }), permissions: perms(true) }, cfg));
    expect(e.code).toBe('fetch-failed');
    expect(e.message).toMatch(/HTTP 404/);
    const n = await code(loadPdfFromUrl(url, { fetch: async () => { throw new TypeError('offline'); }, permissions: perms(true) }, cfg));
    expect(n.code).toBe('fetch-failed');
  });

  it('rejects early on Content-Length over the limit', async () => {
    const body = streamOf([pdfBytes]);
    const res = new Response(body, { headers: { 'content-length': String(3 * MB) } });
    const e = await code(loadPdfFromUrl(url, { fetch: async () => res, permissions: perms(true) }, cfg));
    expect(e.code).toBe('too-large');
    expect(e.message).toBe('File is 3.0 MB; the limit is 1 MB');
  });

  it('caps streamed bytes when Content-Length is missing', async () => {
    const big = new Uint8Array(256 * 1024);
    big.set(pdfBytes);
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(c) { pulled++; c.enqueue(big); }
    });
    const e = await code(loadPdfFromUrl(url, { fetch: async () => new Response(body), permissions: perms(true) }, cfg));
    expect(e.code).toBe('too-large');
    expect(e.message).toMatch(/limit is 1 MB/);
    expect(pulled).toBeLessThan(10);
  });

  it('rejects non-PDF bodies', async () => {
    const e = await code(loadPdfFromUrl(url, { fetch: async () => new Response('<html>'), permissions: perms(true) }, cfg));
    expect(e.code).toBe('not-pdf');
  });
});
