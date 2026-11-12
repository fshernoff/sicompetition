// The yard's rail (G5d, D59; Astra's plan review, finding 12 and the sick counts' scopes): a pure function of one
// ReplayFrame, in business words, with every count's scope said ("this week", "this block").
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runEpisode } from '../../src/sim/episode.ts';
import { carefulPolicy, recklessCoveredPolicy, recklessPolicy, stationaryPolicy } from '../../src/sim/policies.ts';
import { mountRail, railModel } from '../../src/ui/rail.ts';
import { formatBonus, formatDollars } from '../../src/ui/report.ts';
import { planWords, replayFrame } from '../../src/ui/replay.ts';
import { episodeSeeds } from '../../src/world/rng.ts';
import type { EpisodeTrace } from '../../src/world/types.ts';
import { config, round1 } from '../helpers.ts';
import { STUDENT_BANS } from './bans.ts';
import { fakeElement } from './fakeDom.ts';
import type { FakeElement } from './fakeDom.ts';

const covered = runEpisode(config, round1, recklessCoveredPolicy, episodeSeeds(1, 0));
const literal = runEpisode(config, round1, recklessPolicy, episodeSeeds(1, 0)); // closes on Thursday
const careful = runEpisode(config, round1, carefulPolicy, episodeSeeds(1, 0));
const walkers = runEpisode(config, round1, stationaryPolicy({ bookings: 'all', rate: 'premium', staff: 2 }, ['walk', 'walk', 'walk']), episodeSeeds(1, 0));
const TRACES: readonly [string, EpisodeTrace][] = [['covered', covered], ['literal', literal], ['careful', careful]];

const frame = (trace: EpisodeTrace, t: number) => replayFrame(trace.steps, t, config);
const rail = (trace: EpisodeTrace, t: number) => railModel(frame(trace, t), config);

describe('railModel: the yard in words', () => {
  it('says when, what the floor runs and what the GM chose, as the frame and planWords say them', () => {
    const r = rail(covered, 9);
    expect(r.when).toBe('Wednesday · late morning');
    expect(r.activity).toBe(frame(covered, 9).activityWords);
    expect(r.choices).toBe(planWords(frame(covered, 9)));
    expect([r.day, r.block]).toEqual([2, 1]);
  });

  it('puts dogs per staffer on the floor against the legal limit from the config', () => {
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.perStaffer.limit).toBe(config.bookings.legalRatio);
        expect(r.perStaffer.dogs).toBe(f.floorDogs);
        expect(r.perStaffer.staff).toBe(f.floorStaff);
        expect(r.perStaffer.now).toBe(Math.round(f.ratio));
        expect(r.perStaffer.over).toBe(f.ratio > config.bookings.legalRatio);
      }
    }
  });

  it('counts incidents and sick dogs in two scopes, this week and this block, from the frame', () => {
    let sawSick = false;
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.incidents.week).toBe(f.incidentsSoFar);
        expect(r.incidents.thisBlock).toBe(f.events.filter((e) => e.type === 'incident').length);
        expect(r.sick.week).toBe(f.sickSoFar);
        const sickNow = f.events.filter((e) => e.type === 'illness').reduce((n, e) => n + (e.amount ?? 0), 0);
        expect(r.sick.thisBlock).toBe(sickNow);
        expect(r.sick.thisBlock).toBeLessThanOrEqual(r.sick.week);
        if (sickNow > 0) sawSick = true;
      }
    }
    expect(sawSick).toBe(true); // the fixtures include a block with dogs found sick at pickup
  });

  it('writes cash as the report writes dollars and says the reputation change since Monday in words', () => {
    const start = config.reputation.weekStart;
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        const r = rail(trace, t);
        expect(r.cash.start).toBe('$2,000');
        // G5d: the page's cash pays the GM as it earns (BRIEF section 5), and the bonus so far stands beside it
        expect(r.cash.now).toBe(formatDollars(f.cash - f.bonusSoFar));
        expect(r.cash.now).toMatch(/^−?\$\d{1,3}(,\d{3})*(\.\d\d)?$/);
        expect(r.bonusSoFar).toBe(formatBonus(f.bonusSoFar));
        expect(r.reputation.now).toBe(Math.round(f.reputation));
        const change = Math.round(f.reputation) - start;
        expect(r.reputation.change).toBe(change < 0 ? `Down ${-change} this week` : change > 0 ? `Up ${change} this week` : 'No change this week');
      }
    }
  });

  it('keeps the meters, tomorrow, the solo days and the captions as the frame has them', () => {
    const f = frame(covered, 9);
    const r = rail(covered, 9);
    expect([r.energy, r.cleanliness, r.fatigue]).toEqual([Math.round(f.energy), Math.round(f.cleanliness), Math.round(f.fatigue)]);
    expect([r.tomorrow, r.soloDays]).toEqual([f.requestsTomorrow, f.soloStreak]);
    expect(r.captions).toEqual(f.captions);
  });

  it('says this block in one bold line: the activity as it ran, the crew and the dogs on the floor (G5d)', () => {
    const r = rail(covered, 9);
    const f = frame(covered, 9);
    expect(r.thisBlock).toBe(`This block: free play · ${f.floorStaff} staffer · ${f.floorDogs} dogs`);
    const closed = Array.from({ length: 20 }, (_, t) => t).find((t) => frame(literal, t).closed) ?? -1;
    expect(rail(literal, closed).thisBlock).toBe('This block: closed');
    const careful2 = rail(careful, 2);
    expect(careful2.thisBlock).toBe(`This block: nap · 2 staffers · ${frame(careful, 2).floorDogs} dogs`); // "staffers" everywhere (round 3)
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) expect(rail(trace, t).thisBlock).not.toMatch(/→/);
    }
  });

  it('on a closed day shows nobody on the floor and nothing over the limit', () => {
    const closed = Array.from({ length: 20 }, (_, t) => t).filter((t) => frame(literal, t).closed);
    expect(closed.length).toBeGreaterThan(0);
    for (const t of closed) {
      const r = rail(literal, t);
      expect(r.closed).toBe(true);
      expect(r.perStaffer.now).toBe(0);
      expect(r.perStaffer.over).toBe(false);
    }
  });

  it('uses no word a student never reads, in any block of any fixture week', () => {
    for (const [, trace] of TRACES) {
      for (let t = 0; t < 20; t++) {
        const text = JSON.stringify(rail(trace, t));
        for (const word of STUDENT_BANS) expect(text, `${String(word)} at t=${t}`).not.toMatch(word);
      }
    }
  });
});

// The meters as the page renders them (G6, row 1; D70, amending D65): a meter at the bad end of its own scale shows it,
// its number in the warning ink and its track outlined; the ends of a scale are public, so nothing shows at a threshold
// the rules hide (H3, H6), and crew fatigue keeps its warning past the plan's 70%. On the rendered meter (the fake DOM),
// one rail reused block after block, as the page reuses it.
describe('the rail as rendered: a meter at the end of its scale (D70)', () => {
  const base = rail(covered, 9);
  const mount = (): { root: FakeElement; view: (energy: number, cleanliness: number, fatigue: number) => void } => {
    const { el, as } = fakeElement<HTMLElement>('div');
    const view = mountRail(as, config.requests.max, () => '');
    return { root: el, view: (energy, cleanliness, fatigue) => view({ ...base, energy, cleanliness, fatigue }) };
  };
  /** Each meter, in order (energy, cleanliness, fatigue): whether its number and its track show the end of the scale. */
  const ends = (root: FakeElement): { num: boolean; track: boolean }[] => {
    const tracks = root.find('span', 'meter');
    const nums = root.find('b', 'meter-num');
    expect(tracks).toHaveLength(3);
    expect(nums).toHaveLength(3);
    return nums.map((num, i) => ({ num: num.classList.contains('at-end'), track: (tracks[i] as FakeElement).classList.contains('at-end') }));
  };
  const none = [
    { num: false, track: false },
    { num: false, track: false },
    { num: false, track: false },
  ];
  const all = [
    { num: true, track: true },
    { num: true, track: true },
    { num: true, track: true },
  ];

  it("enters the end of each scale (dogs' energy 0%, cleanliness 0%, crew fatigue 100%) and leaves it on the same meter", () => {
    const { root, view } = mount();
    view(40, 55, 30);
    expect(ends(root)).toEqual(none);
    view(0, 0, 100);
    expect(ends(root)).toEqual(all);
    expect(root.find('b', 'meter-num').map((n) => n.textContent)).toEqual(['0%', '0%', '100%']);
    view(1, 1, 99);
    expect(ends(root)).toEqual(none);
    view(0, 63, 50); // one meter at its end, the others plain
    expect(ends(root)).toEqual([{ num: true, track: true }, ...none.slice(1)]);
  });

  it('shows nothing at a threshold the rules hide: energy and cleanliness are plain at every value off the end', () => {
    const { root, view } = mount();
    for (let v = 1; v <= 100; v++) {
      view(v, v, 50);
      const [energy, clean] = ends(root);
      expect([energy, clean], `at ${v}%`).toEqual(none.slice(0, 2));
      const [eNum, cNum] = root.find('b', 'meter-num');
      expect(eNum?.className, `energy's number at ${v}%`).toBe('meter-num');
      expect(cNum?.className, `cleanliness's number at ${v}%`).toBe('meter-num');
    }
  });

  it("keeps crew fatigue's warning past the plan's 70%, and at 100% shows the end of the scale as well", () => {
    const { root, view } = mount();
    const fatigue = (): { high: boolean; end: boolean } => {
      const num = root.find('b', 'meter-num')[2] as FakeElement;
      return { high: num.classList.contains('high'), end: num.classList.contains('at-end') };
    };
    view(50, 50, 70);
    expect(fatigue()).toEqual({ high: false, end: false });
    view(50, 50, 71);
    expect(fatigue()).toEqual({ high: true, end: false });
    view(50, 50, 100);
    expect(fatigue()).toEqual({ high: true, end: true });
    view(50, 50, 85);
    expect(fatigue()).toEqual({ high: true, end: false });
  });

  it('draws the end of a scale in the stylesheet: the number in --red-ink, the track outlined in --line-strong', () => {
    const css = readFileSync('src/style.css', 'utf8');
    const rule = (selector: string): string => {
      const at = css.indexOf(`${selector} {`);
      expect(at, `a rule for ${selector}`).toBeGreaterThanOrEqual(0);
      return css.slice(at, css.indexOf('}', at));
    };
    expect(rule('.meter-num.at-end')).toMatch(/color:\s*var\(--red-ink\)/);
    expect(rule('.live-meters .meter.at-end')).toMatch(/outline:[^;]*var\(--line-strong\)/);
  });
});

// A walk block names both groups (G6, R2; BRIEF 10.2): one staffer with 13 dogs on the floor would otherwise read as a
// day with one staffer on the floor, and the scorecard's "No days" as wrong.
describe('the block line in a walk', () => {
  const walks = Array.from({ length: 20 }, (_, t) => t).filter((t) => frame(walkers, t).walkingStaff > 0);

  it('names the floor and the walking group, each with its crew and its dogs, from the block\'s state', () => {
    expect(walks.length).toBeGreaterThan(0);
    for (const t of walks) {
      const f = frame(walkers, t);
      const staff = (n: number): string => `${n} ${n === 1 ? 'staffer' : 'staffers'}`;
      const dogs = (n: number): string => `${n} ${n === 1 ? 'dog' : 'dogs'}`;
      expect(rail(walkers, t).thisBlock, `t=${t}`).toBe(`This block: walk · on the floor: ${staff(f.floorStaff)}, ${dogs(f.floorDogs)} · out walking: ${staff(f.walkingStaff)}, ${dogs(f.walkingDogs)}`);
    }
  });

  it('keeps every other block\'s line', () => {
    for (const [, trace] of [...TRACES, ['walkers', walkers] as const]) {
      for (let t = 0; t < 20; t++) {
        const f = frame(trace, t);
        if (f.walkingStaff > 0) continue;
        expect(rail(trace, t).thisBlock).not.toMatch(/on the floor|out walking/);
      }
    }
  });

  it('renders each part between the dots unbroken, so the line breaks only at a "·"', () => {
    const { el, as } = fakeElement<HTMLElement>('div');
    const view = mountRail(as, config.requests.max, () => '');
    const t = walks[0] as number;
    view(rail(walkers, t));
    const line = el.find('p', 'this-block')[0] as FakeElement;
    const parts = line.find('span', 'phrase').map((p) => p.textContent);
    expect(parts).toEqual(rail(walkers, t).thisBlock.split(' · '));
    expect(line.textContent).toBe(rail(walkers, t).thisBlock);
  });
});
