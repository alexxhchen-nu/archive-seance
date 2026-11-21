export type Listener<S> = (state: S) => void;

export interface Store<S> {
  get(): S;
  set(patch: Partial<S>): void;
  subscribe(fn: Listener<S>): () => void;
}

export function createStore<S extends object>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<Listener<S>>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state);
    },
    subscribe(fn) {
      listeners.add(fn);
      fn(state);
      return () => listeners.delete(fn);
    }
  };
}
