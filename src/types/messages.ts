export type SwToApp =
  | { type: 'OPEN_DOC'; source: { kind: 'url'; url: string } | { kind: 'none' } };
export type AppToSw =
  | { type: 'REQUEST_HOST_PERMISSION'; origin: string }   // must come from a user gesture
  | { type: 'PING' };
export type SwReply =
  | { ok: true; granted?: boolean }
  | { ok: false; error: string };

