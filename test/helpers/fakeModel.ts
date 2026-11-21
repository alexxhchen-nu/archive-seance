import type { GenerateLike } from '../../src/ai/call';

export type FakeStep =
  | { text: string; source?: string }
  | { error: Error }
  | { hang: true };

export type FakeScript = readonly FakeStep[] | ((prompt: string, call: number) => FakeStep);

export interface FakeModel extends GenerateLike {
  prompts: string[];
}

/** Scripted GenerateLike: a list (last step repeats) or a function of (prompt, call index). */
export function fakeModel(script: FakeScript): FakeModel {
  const prompts: string[] = [];
  return {
    prompts,
    generateContent(prompt: string) {
      const n = prompts.length;
      prompts.push(prompt);
      const step = typeof script === 'function' ? script(prompt, n) : script[Math.min(n, script.length - 1)];
      if (!step) return Promise.reject(new Error('fake model: empty script'));
      if ('hang' in step) return new Promise(() => undefined);
      if ('error' in step) return Promise.reject(step.error);
      const { text, source } = step;
      return Promise.resolve({ response: { text: () => text, inferenceSource: source } });
    }
  };
}

/** Chunk text between the <<< >>> markers of an extraction prompt. */
export function chunkOf(prompt: string): string {
  const a = prompt.indexOf('\n<<<\n');
  const b = prompt.lastIndexOf('\n>>>');
  return a >= 0 && b > a ? prompt.slice(a + 5, b) : '';
}
