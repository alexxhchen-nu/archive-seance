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
