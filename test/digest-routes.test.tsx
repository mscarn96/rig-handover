import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Fixtures live in a temp dir; runs/ is read-only and never touched.
const GOOD_LINES = [
  '{"at":"2026-10-28T01:10:00+01:00","job":"rig/rotate-logs","status":"ok","owner":"rook"}',
  '{"at":"2026-10-28T01:00:00+01:00","job":"digest/render","status":"ok","owner":null}',
  '{"at":"2026-10-28T01:20:00+01:00","job":"notes/backup","status":"fail","owner":"rook","error":"quota exceeded"}',
  '{"at":"2026-10-28T01:05:00+01:00","job":"lane/sync","status":"retry","owner":"rook"}',
  '{"at":"2026-10-28T01:06:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
];
const JOBS_IN_ORDER = ['digest/render', 'lane/sync', 'notes/backup', 'rig/rotate-logs'];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, '2026-10-28.jsonl'), GOOD_LINES.join('\n') + '\n');
  writeFileSync(
    join(runsDir, '2026-10-29.jsonl'),
    [GOOD_LINES[0], 'not json', ...GOOD_LINES.slice(1)].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-10-30.jsonl'), '');
  // 2026-10-31 has no file on purpose.
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

type JsonRow = { job: string };
type DigestJson = {
  night: string;
  rows: JsonRow[];
  badLines: number;
  counts: Record<'ok' | 'retry' | 'fail', number>;
};

describe('digest page GET /digest/:night', () => {
  it('returns 200 and renders the job names for a night with a file', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of JOBS_IN_ORDER) expect(html).toContain(job);
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/digest/2026-10-31');
    expect(res.status).toBe(404);
  });

  it('renders "nothing ran" for an empty file', async () => {
    const res = await app.request('/digest/2026-10-30');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('still returns 200 with a bad line and shows the good jobs', async () => {
    const res = await app.request('/digest/2026-10-29');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of JOBS_IN_ORDER) expect(html).toContain(job);
  });
});

describe('digest JSON GET /api/digest/:night', () => {
  it('returns 200 with night, rows, badLines and counts; rows in job order', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.night).toBe('2026-10-28');
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_IN_ORDER);
    expect(body.badLines).toBe(0);
    expect(body.counts).toEqual({ ok: 3, retry: 1, fail: 1 });
    expect(body.rows.find((r) => r.job === 'lane/sync')).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 2,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-28T01:05:00+01:00',
      lastAt: '2026-10-28T01:06:00+01:00',
    });
  });

  it('returns 404 for a night with no file', async () => {
    const res = await app.request('/api/digest/2026-10-31');
    expect(res.status).toBe(404);
  });

  it('returns rows [] for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-30');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.rows).toEqual([]);
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-10-29');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestJson;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(JOBS_IN_ORDER);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    for (const night of ['2026-10-28', '2026-10-29']) {
      const html = await (await app.request(`/digest/${night}`)).text();
      const body = (await (await app.request(`/api/digest/${night}`)).json()) as DigestJson;
      const positions = body.rows.map((r) => html.indexOf(r.job));
      expect(positions.every((p) => p >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });
});
