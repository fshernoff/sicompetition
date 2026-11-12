// How the business did, the scorecard's other half (BRIEF 1.1; G6, row 4): the profit after the GM's bonus as a small
// label over the amount alone, so the headline reads in three short lines and never wraps mid-clause; then the
// incidents and the reputation as before.
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { recklessCoveredPolicy } from '../../src/sim/policies.ts';
import { businessClauses } from '../../src/ui/app.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import { config, round1 } from '../helpers.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0)).report.totals;

describe('businessClauses', () => {
  it("labels the profit after the GM's bonus and gives the amount alone, then the incidents and the reputation", () => {
    expect(businessClauses(covered)).toEqual([
      { label: "Profit after the GM's bonus", text: '$4,392.90', hurt: false },
      { text: '9 incidents', hurt: true },
      { text: 'reputation down 29', hurt: true },
    ]);
  });

  it('marks a loss after the bonus as a hurt, with its cents and a typographic minus', () => {
    const [profit] = businessClauses({ ...covered, reward: covered.profit + 120.5 }); // a bonus larger than the profit
    expect(profit).toEqual({ label: "Profit after the GM's bonus", text: '−$120.50', hurt: true });
  });
});
