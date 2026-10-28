// The export of one run (BRIEF section 11, D47): a pure function of what the page holds at the end of a run. The
// readout is the run's trace report (never re-evaluated), the curve is the trainer's in cents, the prediction passes
// verbatim, the keys are fixed, nothing identifies a student, and the document survives JSON.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Trainer } from '../../src/learn/train.ts';
import { describeWeek } from '../../src/sim/readout.ts';
import { describeBonusPlan } from '../../src/world/bonusPlan.ts';
import { loadDefaultConfig, loadPreset } from '../../src/world/config.ts';
import { buildExport, exportFilename } from '../../src/ui/export.ts';
import type { RunExportInput } from '../../src/ui/export.ts';
import type { Picks } from '../../src/ui/prediction.ts';

const world = loadDefaultConfig();
const spec = loadPreset('round1').spec;
const trainer = new Trainer(world, spec, 1);
const snapshot = trainer.runEpisodes(600); // two evaluations: the untrained GM and episode 500
const trace = trainer.evaluateTrace();
const prediction = 'Every dog it can take, "one staffer",\nlots of incidents.';
const exportedAt = new Date(2026, 10, 9, 10, 12, 30); // local time: 9 Nov 2026, 10:12:30
const picks: Picks = { acceptAll: 'all', rate: 'premium', solo: '3-4', naps: '0', incidents: null };

function input(over: Partial<RunExportInput> = {}): RunExportInput {
  return {
    configName: world.name,
    round: 'round1',
    seed: 1,
    spec,
    planWords: describeBonusPlan(spec, world),
    prediction,
    picks,
    trace,
    curve: trainer.curve(),
    evals: trainer.evals(),
    snapshot,
    ms: 12_345,
    outOfBudget: false,
    exportedAt,
    ...over,
  };
}

const cents = (x: number): number => Math.round(x * 100) / 100;

/** Every key name in a document, at any depth. */
function keysDeep(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) for (const v of value) keysDeep(v, out);
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysDeep(v, out);
    }
  }
  return out;
}

describe('buildExport', () => {
  const doc = buildExport(input());

  it('has the fixed keys and the run\'s setup', () => {
    expect(Object.keys(doc).sort()).toEqual(
      ['app', 'config', 'curve', 'evaluations', 'exportedAt', 'learner', 'plan', 'planWords', 'prediction', 'predictionCheck', 'predictionPicks', 'readout', 'round', 'seed', 'version'].sort(),
    );
    expect(doc.version).toBe(1);
    expect(doc.app).toBe('Reward the Pack');
    expect(doc.exportedAt).toBe(exportedAt.toISOString());
    expect(doc.config).toBe('default');
    expect(doc.round).toBe('round1');
    expect(doc.seed).toBe(1);
    expect(doc).not.toHaveProperty('speed'); // no speed control since D52
    expect(doc.plan).toEqual(spec);
    expect(doc.planWords).toBe('Each day, the GM earns $10 per $100 of profit.');
  });

  it('carries the five picks as at the click and each beside what the GM did (D56)', () => {
    expect(doc.predictionPicks).toEqual(picks);
    expect(doc.predictionCheck.map((c) => c.field)).toEqual(['acceptAll', 'rate', 'solo', 'naps', 'incidents']);
    expect(doc.predictionCheck[4]).toMatchObject({ field: 'incidents', picked: null, called: false });
    expect(Object.keys(doc.predictionCheck[0] ?? {}).sort()).toEqual(['actual', 'called', 'field', 'picked']);
  });

  it('carries the prediction verbatim', () => {
    expect(doc.prediction).toBe(prediction);
    expect(buildExport(input({ prediction: '' })).prediction).toBe('');
  });

  it("is the run's final week: the trace's report and its sentence, never re-evaluated", () => {
    expect(doc.readout.report).toEqual(trace.report);
    expect(doc.readout.sentence).toBe(describeWeek(trace.report));
    expect(doc.readout.sentence).toMatch(/^The GM accepted every booking on \d of 5 days/);
  });

  it("is the trainer's curve in cents, three arrays of one length", () => {
    const points = trainer.curve();
    expect(points.length).toBe(600);
    expect(doc.curve.weeks.length).toBe(600);
    expect(doc.curve.bonus.length).toBe(600);
    expect(doc.curve.average.length).toBe(600);
    expect(doc.curve.weeks[0]).toBe(1);
    expect(doc.curve.weeks[599]).toBe(600);
    for (let i = 0; i < points.length; i += 37) {
      const p = points[i] as (typeof points)[number];
      expect(doc.curve.weeks[i]).toBe(p.episode);
      expect(doc.curve.bonus[i]).toBe(cents(p.reward));
      expect(doc.curve.average[i]).toBe(cents(p.movingAverage));
    }
  });

  it('lists the evaluations as the week, the bonus and the outcome key', () => {
    const evals = trainer.evals();
    expect(evals.length).toBe(2);
    expect(doc.evaluations).toEqual(evals.map((e) => ({ week: e.episode, bonus: cents(e.reward), key: e.key })));
    expect(doc.evaluations[1]?.week).toBe(500);
  });

  it("carries the learner's numbers from the snapshot and the run's clock", () => {
    expect(doc.learner).toEqual({
      weeksTrained: 600,
      epsilon: Math.round(snapshot.epsilon * 10_000) / 10_000,
      evaluations: 2,
      stable: false,
      hasTarget: true,
      targetMet: false,
      seconds: 12.345,
      outOfBudget: false,
    });
    const late = buildExport(input({ ms: 60_120.4, outOfBudget: true }));
    expect(late.learner.seconds).toBe(60.12);
    expect(late.learner.outOfBudget).toBe(true);
  });

  it('is a deep copy: changing it never touches the page\'s trace or plan', () => {
    const copy = buildExport(input());
    copy.readout.report.totals.profit = -1;
    copy.plan.kpis.profit.weight = 0;
    (copy.readout.report.days[0] as { requests: number }).requests = 99;
    expect(trace.report.totals.profit).not.toBe(-1);
    expect(spec.kpis.profit.weight).toBe(10);
    expect(trace.report.days[0]?.requests).not.toBe(99);
  });

  it('survives JSON and names no student: no key is a name, team, email or user', () => {
    const text = JSON.stringify(doc);
    expect(JSON.parse(text)).toEqual(doc);
    // JSON writes NaN and Infinity as null, so the numbers are checked before serialising (Astra, diff review).
    const numbers = (value: unknown, out: number[] = []): number[] => {
      if (typeof value === 'number') out.push(value);
      else if (Array.isArray(value)) for (const v of value) numbers(v, out);
      else if (typeof value === 'object' && value !== null) for (const v of Object.values(value)) numbers(v, out);
      return out;
    };
    const all = numbers(doc);
    expect(all.length).toBeGreaterThan(1800); // three curve arrays of 600, the report, the learner block
    for (const n of all) expect(Number.isFinite(n)).toBe(true);
    for (const key of keysDeep(doc)) expect(key, key).not.toMatch(/student|team|email|user|author|name$/i);
  });
});

describe('the size of an export', () => {
  it('serialises a run at the 150,000-week cap under 4 MB as the download writes it, compact (Astra, plan review)', () => {
    const n = 150_000;
    const curve = Array.from({ length: n }, (_, i) => ({ episode: i + 1, reward: 300 + ((i * 7919) % 1000) / 7 - 50, movingAverage: 320 + ((i * 104729) % 1000) / 9 }));
    const evals = trainer.evals();
    const doc = buildExport(input({ curve, evals, snapshot: { ...snapshot, episodes: n, done: true } }));
    const bytes = Buffer.byteLength(JSON.stringify(doc), 'utf8');
    expect(doc.curve.weeks.length).toBe(n);
    expect(bytes).toBeLessThan(4_000_000);
    console.log(`[export] a 150,000-week run serialises to ${(bytes / 1_000_000).toFixed(2)} MB compact (downloadJson writes it compact)`);
  });
});

describe('the export handler', () => {
  it('builds the file from what the page holds and never re-evaluates (Astra, plan review)', () => {
    const source = readFileSync('src/ui/teacher.ts', 'utf8');
    expect(source).toMatch(/buildExport\(/);
    expect(source).toMatch(/downloadJson\(/);
    expect(source).not.toMatch(/evaluate/);
    expect(source).not.toMatch(/runEpisodes|runFor/);
  });
});

describe('exportFilename', () => {
  it('names the round, the seed and the local date and time, with no spaces', () => {
    expect(exportFilename(input())).toBe('reward-the-pack-round1-seed1-20261109-1012.json');
    expect(exportFilename(input({ round: 'round3', seed: 4_294_967_295, exportedAt: new Date(2026, 0, 5, 9, 7) }))).toBe(
      'reward-the-pack-round3-seed4294967295-20260105-0907.json',
    );
  });
});
