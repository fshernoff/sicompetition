import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Pins the no-network rule at the page level: the shipped HTML references nothing off the origin.
describe('scaffold', () => {
  it('index.html loads no remote scripts, styles or fonts', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain('<title>Reward the Pack</title>');
  });
});
