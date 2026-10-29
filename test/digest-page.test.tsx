import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

describe('digest page', () => {
  it('renders a night', async () => {
    const res = await createApp(config).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<h1>2026-10-28</h1>');
    expect(html).toContain('lane/sync');
    expect(html).toContain('2026-10-28T23:00:02+01:00');
    expect(html).not.toContain('<td></td>');
  });

  it('404s with the layout when there is no log', async () => {
    const res = await createApp(config).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
    expect(await res.text()).toContain('no run log for 2026-01-01');
  });
});
