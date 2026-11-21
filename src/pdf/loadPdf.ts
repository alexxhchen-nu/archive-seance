import type { Config } from '../config/defaults';
import { sha256Hex } from '../util/hash';

export type PdfLoadErrorCode =
  | 'not-pdf' | 'too-large' | 'too-many-pages' | 'permission-needed'
  | 'unsupported-scheme' | 'fetch-failed' | 'parse-failed';

export class PdfLoadError extends Error {
  override name = 'PdfLoadError';
  constructor(readonly code: PdfLoadErrorCode, message: string, readonly origin?: string) {
    super(message);
  }
}

export interface LoadedPdf {
  bytes: Uint8Array;
  docId: string;
  sizeBytes: number;
  title: string;
  sourceUrl?: string;
}

export interface PermissionsLike {
  contains(p: { origins: string[] }): Promise<boolean>;
  request(p: { origins: string[] }): Promise<boolean>;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export type PdfLimits = Pick<Config, 'maxPdfMegabytes'>;

const HEADER_WINDOW = 1024;
const MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

function mb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function limitBytes(cfg: PdfLimits): number {
  return cfg.maxPdfMegabytes * 1024 * 1024;
}

function tooLarge(size: number, cfg: PdfLimits): PdfLoadError {
  return new PdfLoadError('too-large', `File is ${mb(size)} MB; the limit is ${cfg.maxPdfMegabytes} MB`);
}

function tooLargeStreamed(cfg: PdfLimits): PdfLoadError {
  return new PdfLoadError('too-large', `File is over ${cfg.maxPdfMegabytes} MB; the limit is ${cfg.maxPdfMegabytes} MB`);
}

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.length, HEADER_WINDOW) - MAGIC.length;
  for (let i = 0; i <= end; i++) {
    if (MAGIC.every((m, j) => bytes[i + j] === m)) return true;
  }
  return false;
}

function parseHttpUrl(url: string): URL {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new PdfLoadError('unsupported-scheme', `This address is not a valid URL: ${url}`);
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new PdfLoadError('unsupported-scheme', `Only http and https addresses can be opened (got ${u.protocol})`);
  }
  return u;
}

/** Host-permission match pattern for exactly this URL's origin (R1.3). */
export function originPattern(url: string): string {
  return `${parseHttpUrl(url).origin}/*`;
}

export function hasHostPermission(perms: PermissionsLike, url: string): Promise<boolean> {
  return perms.contains({ origins: [originPattern(url)] });
}

export function requestHostPermission(perms: PermissionsLike, url: string): Promise<boolean> {
  // Gesture-critical: request() must be the first call, with nothing awaited before it.
  return perms.request({ origins: [originPattern(url)] });
}

async function finish(bytes: Uint8Array, title: string, sourceUrl?: string): Promise<LoadedPdf> {
  if (!hasPdfHeader(bytes)) throw new PdfLoadError('not-pdf', 'This file is not a PDF (missing %PDF- header)');
  const docId = await sha256Hex(bytes);
  const out: LoadedPdf = { bytes, docId, sizeBytes: bytes.byteLength, title };
  if (sourceUrl !== undefined) out.sourceUrl = sourceUrl;
  return out;
}

export async function loadPdfFromFile(file: File | Blob, cfg: PdfLimits): Promise<LoadedPdf> {
  if (file.size > limitBytes(cfg)) throw tooLarge(file.size, cfg);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = 'name' in file && typeof file.name === 'string' && file.name ? file.name : 'Untitled PDF';
  return finish(bytes, name);
}

function titleFromUrl(u: URL): string {
  const seg = u.pathname.split('/').filter(Boolean).pop();
  if (!seg) return 'Untitled PDF';
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

async function readCapped(res: Response, cap: number, cfg: PdfLimits): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > cap) throw tooLarge(buf.byteLength, cfg);
    return buf;
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw tooLargeStreamed(cfg);
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export async function loadPdfFromUrl(
  url: string,
  deps: { fetch: FetchLike; permissions: PermissionsLike },
  cfg: PdfLimits
): Promise<LoadedPdf> {
  const u = parseHttpUrl(url);
  if (!(await hasHostPermission(deps.permissions, url))) {
    throw new PdfLoadError('permission-needed', `Access to ${u.origin} has not been granted yet`, u.origin);
  }
  let res: Response;
  try {
    res = await deps.fetch(u.href, { credentials: 'omit' });
  } catch (e) {
    throw new PdfLoadError('fetch-failed', `Could not download the PDF: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!res.ok) throw new PdfLoadError('fetch-failed', `Download failed with HTTP ${res.status}`);
  const cap = limitBytes(cfg);
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > cap) {
    await res.body?.cancel();
    throw tooLarge(declared, cfg);
  }
  const bytes = await readCapped(res, cap, cfg);
  return finish(bytes, titleFromUrl(u), u.href);
}
