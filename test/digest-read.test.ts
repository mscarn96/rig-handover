import { describe, expect, it } from 'vitest';
import { digest, readNight } from '../src/digest/read.js';

describe('run log reader', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n!.badLines).toBe(1);
    const fx = n!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(fx).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null, owner: 'rook' });
    expect(fx.firstAt).toBe('2026-10-29T01:30:00+01:00');
    const backup = n!.rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(n!.rows.find((r) => r.job === 'digest/render')!.owner).toBeNull();
    expect(n!.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('returns null for a night with no file or a bad night name', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('renders an empty night and never throws on garbage', () => {
    expect(digest('2026-10-30', '').rows).toEqual([]);
    const n = digest('2026-10-30', '{"at":1}\nnot json\n[]\n{"at":"x","job":"a","status":"weird","owner":"o"}\n');
    expect(n.badLines).toBe(4);
    expect(n.rows).toEqual([]);
  });
});
