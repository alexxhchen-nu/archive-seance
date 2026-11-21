export interface Config {
  cloudModel: string;
  localCallTimeoutMs: number;
  cloudEnabled: boolean;
  routeLocalMaxChunkChars: number;
  routeLocalChunkBudget: number;
  routeLongDocPages: number;
  crossPageMode: 'cloud_first' | 'local_only';
}

export const DEFAULTS: Readonly<Config> = Object.freeze({
  cloudModel: 'gemini-3.5-flash-lite',
  localCallTimeoutMs: 45000,
  cloudEnabled: true,
  routeLocalMaxChunkChars: 6000,
  routeLocalChunkBudget: 60,
  routeLongDocPages: 30,
  crossPageMode: 'cloud_first'
});
