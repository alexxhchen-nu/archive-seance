import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nameInQuote } from '../../../src/pipeline/nameInQuote';
import { locateQuote } from '../../../src/pipeline/locateQuote';
import { isGoldReviewed } from '../../../src/eval/reviewGate';
import type { GoldSet } from '../../../src/eval/score';

interface NhprcGold extends GoldSet {
  fixtureId: string;
  source: { url: string; sha256: string; pages: number[]; license: string };
  labeling: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notEntities: string[];
}

interface PagesFile {
  sha256: string;
  pagesSelected: number[];
  text: Record<string, string>;
}

const LABELS = new Set(['employed-by', 'member-of', 'family', 'business-partner', 'met-with', 'communicated-with']);
const gold = JSON.parse(readFileSync('test/fixtures/eval/nhprc-2015-11/gold.json', 'utf8')) as NhprcGold;
const pages = JSON.parse(readFileSync('test/fixtures/eval/nhprc-2015-11/pages.json', 'utf8')) as PagesFile;

const pageText = (n: number): string => pages.text[String(n)] ?? '';

describe('NHPRC eval gold (pages 1–2)', () => {
  it('is AI-drafted, reviewed by the author (R17.1), and points at the DEMO_SOURCES PDF', () => {
    expect(gold.fixtureId).toBe('nhprc-2015-11-p1-p2');
    expect(gold.source.pages).toEqual([1, 2]);
    expect(gold.source.url).toMatch(/2015-11-minutes\.pdf$/);
    expect(gold.source.sha256).toBe(pages.sha256);
    expect(gold.source.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gold.labeling).toMatch(/AI-drafted/i);
    expect(gold.labeling).toMatch(/reviewed by Alex Chen/i);
    expect(gold.reviewedBy).toBe('Alex Chen');
    expect(gold.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isGoldReviewed(gold)).toBe(true);
    expect(pages.pagesSelected).toEqual([1, 2]);
    expect(pageText(1).length).toBeGreaterThan(1000);
    expect(pageText(2).length).toBeGreaterThan(1000);
  });

  it('every gold mention and relation quote is locatable in the extracted text of its page', () => {
    for (const e of gold.entities) {
      for (const m of e.mentions) {
        const t = pageText(m.page);
        const r = locateQuote(t, 0, m.quote);
        expect(r, `${e.id}: ${m.quote}`).not.toBeNull();
        expect(t.slice(r!.start, r!.end)).toBe(m.quote);
      }
    }
    for (const rel of gold.relations) {
      const t = pageText(rel.page);
      const r = locateQuote(t, 0, rel.quote);
      expect(r, rel.quote).not.toBeNull();
      expect(t.slice(r!.start, r!.end)).toBe(rel.quote);
    }
  });

  it('R3.4a: every mention quote contains the entity name or an alias', () => {
    for (const e of gold.entities) {
      const names = [e.name, ...e.aliases];
      for (const m of e.mentions) {
        expect(names.some((n) => nameInQuote(n, m.quote)), `${e.id} / ${e.name} in "${m.quote}"`).toBe(true);
      }
    }
  });

  it('ids are unique, endpoints exist, labels are closed, notEntities appear in the pages', () => {
    const ids = gold.entities.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of gold.entities) expect(e.mentions.length).toBeGreaterThan(0);
    for (const rel of gold.relations) {
      expect(ids).toContain(rel.subject);
      expect(ids).toContain(rel.object);
      expect(LABELS.has(rel.label)).toBe(true);
    }
    const both = `${pageText(1)} ${pageText(2)}`;
    for (const s of gold.notEntities) expect(both.includes(s), s).toBe(true);
  });
});
