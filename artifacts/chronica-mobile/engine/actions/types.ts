export type ActionStep =
  | { kind: 'goto'; locationId: string }
  | { kind: 'set'; flag: string }
  | { kind: 'clear'; flag: string }
  | { kind: 'assign'; path: string; rawValue: string }
  | { kind: 'increment'; path: string; amount: number }
  | { kind: 'decrement'; path: string; amount: number };

export type ParseActionResult =
  | { ok: true; steps: ActionStep[] }
  | { ok: false; error: string };
