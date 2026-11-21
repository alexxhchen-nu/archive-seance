import { getGenerativeModel } from 'firebase/ai';
import type { AI, GenerativeModel, HybridParams, InferenceMode } from 'firebase/ai';
import type { Config } from '../config/defaults';
import type { HybridKind } from '../types';
import { EXTRACTION_SCHEMA, PROBE_SCHEMA, toSdkSchema } from './schemas';

type ResponseConstraint = NonNullable<
  NonNullable<NonNullable<HybridParams['onDeviceParams']>['promptOptions']>['responseConstraint']
>;

const SCHEMA: Record<HybridKind, object> = { extract: EXTRACTION_SCHEMA, probe: PROBE_SCHEMA };

const cache = new Map<string, GenerativeModel>();

export function makeModel(ai: AI, kind: HybridKind, mode: InferenceMode, cfg: Config): GenerativeModel {
  const key = `${kind}|${mode}|${cfg.cloudModel}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const schema = SCHEMA[kind];
  const model = getGenerativeModel(ai, {
    mode,
    onDeviceParams: {
      createOptions: {
        expectedInputs: [{ type: 'text', languages: ['en'] }],
        expectedOutputs: [{ type: 'text', languages: ['en'] }]
      },
      promptOptions: { responseConstraint: schema as unknown as ResponseConstraint }
    },
    inCloudParams: {
      model: cfg.cloudModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: toSdkSchema(schema),
        temperature: 0
      }
    }
  });
  cache.set(key, model);
  return model;
}

export function clearModelCache(): void {
  cache.clear();
}
