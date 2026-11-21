export type Sensitivity = 'sensitive' | 'public';
export type Route = 'local' | 'cloud';
export type InferenceSourceTag = 'on_device' | 'in_cloud';

export type HybridKind = 'extract' | 'probe';
export type HybridModeName = 'only_on_device' | 'prefer_on_device' | 'only_in_cloud';

export type DeviceAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'api-missing';

export interface InferenceLogEntry {
  id: string;
  at: string;
  kind: 'extract' | 'cross-page' | 'adjudicate' | 'ocr';
  requestedRoute: Route;
  inferenceSource: InferenceSourceTag | 'failed';
  payloadChars: number;
  payloadSha256: string;
  ms: number;
  error?: string;
}

export type EntityType = 'person' | 'org';

export interface DocumentRecord {
  id: string;                 // sha256 hex of PDF bytes
  title: string;
  sourceUrl?: string;         // absent for local files
  pages: number;
  sensitivity: Sensitivity;   // default 'sensitive'
  createdAt: string;          // ISO-8601
}

export interface PageText {
  docId: string;
  page: number;               // 1-based
  text: string;               // normalized
  itemOffsets: number[];      // itemOffsets[i] = char offset where pdf.js text item i starts in `text`
  status: 'ok' | 'no-text';
}

export interface Chunk {
  id: string;                 // `${docId}:${page}:${start}`
  docId: string;
  page: number;
  start: number;              // inclusive char offset in PageText.text
  end: number;                // exclusive
}

export interface Anchor {
  docId: string;
  page: number;
  start: number;
  end: number;
  quote: string;              // === pageText.text.slice(start,end) (verified in code)
}

export interface Mention {
  id: string;
  surface: string;            // name as written
  type: EntityType;
  anchor: Anchor;
  sentenceId: string;         // `${docId}:${page}:${sentenceStart}`
  source: { route: Route; inferenceSource: InferenceSourceTag; ocr: boolean };
}

export interface Entity {
  id: string;
  type: EntityType;
  label: string;              // chosen canonical surface (longest, most frequent)
  mentionIds: string[];
  status: 'solid' | 'ghost';
  confidence: number;         // 1.0 for single-mention entities; weakest-link for clusters
  weakestLink?: { aMentionId: string; bMentionId: string; score: ScoreBreakdown };
  userDecision?: 'confirmed' | 'split' | 'unsure';
}

export interface ScoreBreakdown {
  name: number;               // 0..1
  context: number;            // 0..1
  verdict: number | null;     // 0, 0.5, 1 or null if no model verdict
  capped?: 'suffix-conflict' | 'initial-conflict' | 'verdict-different' | 'auto-needs-name>=0.90';
  total: number;              // 0..1
}

export type RelationLabel =
  | 'employed-by' | 'member-of' | 'family' | 'business-partner'
  | 'met-with' | 'communicated-with' | 'mentioned-together';

export interface Relation {
  id: string;
  aEntityId: string;
  bEntityId: string;
  label: RelationLabel;
  directed: boolean;
  evidence: Anchor[];         // length >= 1 (enforced)
  routes: InferenceSourceTag[];   // which routes contributed
}

export interface MergeDecision {
  docId: string;
  aMentionKey: string;        // stable key: `${type}:${normalizedSurface}`
  bMentionKey: string;
  decision: 'confirmed' | 'split' | 'unsure';
  at: string;
}

export interface RunSummary {
  docId: string;
  chunks: { total: number; local: number; cloud: number; failed: number; pendingCloud: number };
  entities: number; relations: number; ghostNodes: number;
  droppedUnanchored: number;
}

/** Model output shapes; mirror EXTRACTION_SCHEMA, PAIR_LABEL_SCHEMA and VERDICT_SCHEMA in src/ai/schemas.ts. */
export type ExtractionRelationLabel = Exclude<RelationLabel, 'mentioned-together'>;

export interface ExtractionOutput {
  entities: Array<{ name: string; type: EntityType; quote: string }>;
  relations: Array<{ subject: string; object: string; label: ExtractionRelationLabel; quote: string }>;
}

export type PairLabel = RelationLabel | 'none';

export interface PairLabelsOutput {
  pairs: Array<{ pairId: string; label: PairLabel; snippetId: string }>;
}

export interface VerdictOutput {
  verdict: 'same' | 'different' | 'unsure';
}
