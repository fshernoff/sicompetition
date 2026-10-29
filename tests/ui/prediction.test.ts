// The prediction as five picks (G5c, D56): the five things the readout's sentence reports, so each pick can be
// checked against the week the GM ran. The words are the page's and the paper briefs' (D54).
import { describe, expect, it } from 'vitest';
import { Trainer } from '../../src/learn/train.ts';
import { loadPreset } from '../../src/world/config.ts';
import type { Rate, WeekReport } from '../../src/world/types.ts';
import { PICKS, actualValue, calledLine, checkPrediction, emptyPicks, picksComplete } from '../../src/ui/prediction.ts';
import type { Picks } from '../../src/ui/prediction.ts';
import { runEpisode } from '../../src/sim/episode.ts';
import { recklessPolicy } from '../../src/sim/policies.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import { config } from '../helpers.ts';

/**
 * A week with the totals and day rates given; everything else zero. A closed day keeps the rate the GM planned, as a
 * real report does (the plan is stored before the call-out closes the day; Astra, G5c plan review): `closed` lists
 * the closed days' indexes.
 */
function week(t: Partial<WeekReport['totals']>, rates: Rate[] = ['premium', 'premium', 'premium', 'premium', 'premium'], closed: number[] = []): WeekReport {
  const days = rates.map((rate, day) => ({ day, rate, closed: closed.includes(day) }) as unknown as WeekReport['days'][number]);
  return { seeds: { world: 0, policy: 0 }, days, totals: { daysAcceptedAll: 0, daysOneStaffer: 0, napBlocks: 0, incidents: 0, ...t } } as unknown as WeekReport;
}

function picks(p: Partial<Picks>): Picks {
  return { ...emptyPicks(), ...p };
}

describe('the five picks', () => {
  it('are the readout sentence\'s five, with the page\'s words', () => {
    expect(PICKS.map((p) => p.label)).toEqual(['Days it accepts every booking', 'Day rate', 'Days with 1 staffer on the floor', 'Nap blocks this week', 'Incidents this week']);
    expect(PICKS.map((p) => p.options.map((o) => o.label))).toEqual([
      ['None', '1 to 4', 'All 5'],
      ['Low', 'Standard', 'Premium', 'A mix'],
      ['None', '1 or 2', '3 or 4', 'All 5'],
      ['None', '1 to 5', '6 or more'],
      ['0 to 2', '3 to 6', '7 or more'],
    ]);
  });

  it('are complete only when all five are picked', () => {
    expect(picksComplete(emptyPicks())).toBe(false);
    expect(picksComplete(picks({ acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0' }))).toBe(false);
    expect(picksComplete(picks({ acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0', incidents: '7plus' }))).toBe(true);
  });
});

describe('where a week falls', () => {
  it('buckets every count at its edges', () => {
    const a = (n: number) => actualValue('acceptAll', week({ daysAcceptedAll: n }));
    expect([0, 1, 4, 5].map(a)).toEqual(['none', 'some', 'some', 'all']);
    const s = (n: number) => actualValue('solo', week({ daysOneStaffer: n }));
    expect([0, 1, 2, 3, 4, 5].map(s)).toEqual(['0', '1-2', '1-2', '3-4', '3-4', '5']);
    const n = (k: number) => actualValue('naps', week({ napBlocks: k }));
    expect([0, 1, 5, 6, 15].map(n)).toEqual(['0', '1-5', '1-5', '6plus', '6plus']);
    const i = (k: number) => actualValue('incidents', week({ incidents: k }));
    expect([0, 2, 3, 6, 7, 20].map(i)).toEqual(['0-2', '0-2', '3-6', '3-6', '7plus', '7plus']);
  });

  it('reads the rate off the open days only: one rate, a mix, or none when every day closed', () => {
    expect(actualValue('rate', week({}))).toBe('premium');
    expect(actualValue('rate', week({}, ['standard', 'standard', 'standard', 'standard', 'standard']))).toBe('standard');
    // A closed day's planned rate is not a rate charged: low on the open days is Low, not a mix.
    expect(actualValue('rate', week({}, ['low', 'low', 'premium', 'low', 'low'], [2]))).toBe('low');
    expect(actualValue('rate', week({}, ['low', 'premium', 'premium', 'premium', 'premium']))).toBe('mix');
    expect(actualValue('rate', week({}, ['low', 'standard', 'premium', 'premium', 'premium']))).toBe('mix');
    expect(actualValue('rate', week({}, ['premium', 'premium', 'premium', 'premium', 'premium'], [0, 1, 2, 3, 4]))).toBeNull();
  });

  it('reads a real week with a closed day: the reckless week closes Thursday and still charged premium', () => {
    const r = runEpisode(config, loadPreset('round1').spec, recklessPolicy, episodeSeeds(1, 0)).report;
    expect(r.days[3]?.closed).toBe(true);
    expect(r.days[3]?.rate).not.toBeNull(); // the closed day keeps its planned rate in the report
    expect(actualValue('rate', r)).toBe('premium');
    expect(actualValue('solo', r)).toBe('3-4'); // four solo days: Thursday closed, so the floor never ran
    expect(actualValue('acceptAll', r)).toBe('some'); // a closed day never counts as accepting every booking
    const scored = checkPrediction(picks({ rate: 'premium' }), r);
    expect(scored.find((x) => x.field === 'rate')?.actual).toBe('Premium');
  });
});

describe('the scorecard', () => {
  it('checks each pick against the week, saying what the GM did in plain words, never the bucket again (G5d)', () => {
    const w = week({ daysAcceptedAll: 3, daysOneStaffer: 4, napBlocks: 0, incidents: 7 }, ['low', 'premium', 'premium', 'premium', 'premium']);
    // (in a real report a closed day keeps its rate; the mix counts open days only, as below)
    const r = checkPrediction(picks({ acceptAll: 'all', rate: 'mix', solo: '3-4', naps: '0', incidents: '3-6' }), w);
    expect(r.map((x) => [x.field, x.picked, x.actual, x.called])).toEqual([
      ['acceptAll', 'All 5', '3 days', false],
      ['rate', 'A mix', 'A mix: low × 1, premium × 4', true],
      ['solo', '3 or 4', '4 days', true],
      ['naps', 'None', 'No naps', true],
      ['incidents', '3 to 6', '7 incidents', false],
    ]);
    const words = (t: Parameters<typeof week>[0]) =>
      checkPrediction(picks({}), week(t, ['premium', 'premium', 'premium', 'premium', 'premium'])).map((x) => x.actual);
    expect(words({ daysAcceptedAll: 5, daysOneStaffer: 0, napBlocks: 1, incidents: 1 })).toEqual(['Every day', 'Premium', 'No days', '1 nap block', '1 incident']);
    expect(words({ daysAcceptedAll: 0, daysOneStaffer: 1, napBlocks: 9, incidents: 0 })).toEqual(['No days', 'Premium', '1 day', '9 nap blocks', 'No incidents']);
    expect(r[0]?.label).toBe('Days it accepts every booking');
    expect(calledLine(r)).toBe('You called 3 of 5.');
  });

  it('never calls a missing pick, and says so when the week closed every day', () => {
    const r = checkPrediction(picks({ rate: 'premium' }), week({}, ['premium', 'premium', 'premium', 'premium', 'premium'], [0, 1, 2, 3, 4]));
    expect(r.find((x) => x.field === 'rate')).toMatchObject({ picked: 'Premium', actual: 'Closed all week', actualValue: null, called: false });
    expect(r.find((x) => x.field === 'naps')).toMatchObject({ picked: null, called: false });
    expect(calledLine(r)).toBe('You called 0 of 5.');
    expect(calledLine(r.slice(0, 1).map((x) => ({ ...x, called: true })))).toBe('You called 1 of 5.');
  });

  it('calls Round 1 on seed 1 for the team that predicted the packed yard', () => {
    const trainer = new Trainer(config, loadPreset('round1').spec, 1);
    trainer.runEpisodes(trainer.config.maxEpisodes);
    const r = checkPrediction(picks({ acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0', incidents: '7plus' }), trainer.evaluate());
    expect(r.every((x) => x.called)).toBe(true);
    expect(calledLine(r)).toBe('You called 5 of 5.');
  });
});
