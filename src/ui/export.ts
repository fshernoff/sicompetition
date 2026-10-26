// The export of one run (BRIEF section 11, D47): one JSON document built from what the page holds at the end of a
// run, never re-evaluated: the config name, the round, the seed, the speed, the bonus plan and its sentence, the
// prediction as it stood at the click, the readout (the sentence and the run's final week report, the same trace
// the replay and the table show), the bonus curve, the evaluations and the learner's numbers. No names, no
// identifiers: the keys are fixed and the only free text is the prediction. buildExport and exportFilename are
// pure; downloadJson is the one browser call (a Blob and a download link, never a request). WP3 (Sonnet).
import type { CurvePoint, EvalPoint, TrainingSnapshot } from '../learn/train.ts';
import type { PresetName } from '../world/config.ts';
import type { EpisodeTrace, RewardSpec, WeekReport } from '../world/types.ts';
import type { SpeedName } from './speed.ts';
import { describeWeek } from '../sim/readout.ts';

export interface RunExportInput {
  configName: string;
  round: PresetName;
  seed: number;
  speed: SpeedName;
  spec: RewardSpec;
  planWords: string;
  prediction: string;
  trace: EpisodeTrace;
  curve: readonly CurvePoint[];
  evals: readonly EvalPoint[];
  snapshot: TrainingSnapshot;
  ms: number;
  outOfBudget: boolean;
  exportedAt: Date;
}

export interface RunExport {
  version: 1;
  app: 'Reward the Pack';
  exportedAt: string; // ISO 8601
  config: string;
  round: PresetName;
  seed: number;
  speed: SpeedName;
  plan: RewardSpec;
  planWords: string;
  prediction: string;
  readout: { sentence: string; report: WeekReport };
  /** Three arrays of the trainer's length: the week (1-based), the bonus that week and the moving average, in cents. */
  curve: { weeks: number[]; bonus: number[]; average: number[] };
  evaluations: { week: number; bonus: number; key: string }[];
  learner: {
    weeksTrained: number;
    epsilon: number; // four decimals
    evaluations: number;
    stable: boolean;
    hasTarget: boolean;
    targetMet: boolean;
    seconds: number; // ms / 1000, three decimals
    outOfBudget: boolean;
  };
}

/** The document: a deep copy (mutating it never touches the page's trace or plan); money rounded to cents. */
export function buildExport(input: RunExportInput): RunExport {
  const cents = (x: number): number => Math.round(x * 100) / 100;
  const { snapshot } = input;
  return {
    version: 1,
    app: 'Reward the Pack',
    exportedAt: input.exportedAt.toISOString(),
    config: input.configName,
    round: input.round,
    seed: input.seed,
    speed: input.speed,
    plan: structuredClone(input.spec),
    planWords: input.planWords,
    prediction: input.prediction,
    readout: { sentence: describeWeek(input.trace.report), report: structuredClone(input.trace.report) },
    curve: {
      weeks: input.curve.map((p) => p.episode),
      bonus: input.curve.map((p) => cents(p.reward)),
      average: input.curve.map((p) => cents(p.movingAverage)),
    },
    evaluations: input.evals.map((e) => ({ week: e.episode, bonus: cents(e.reward), key: e.key })),
    learner: {
      weeksTrained: snapshot.episodes,
      epsilon: Math.round(snapshot.epsilon * 10_000) / 10_000,
      evaluations: snapshot.evaluations,
      stable: snapshot.stable,
      hasTarget: snapshot.hasTarget,
      targetMet: snapshot.targetMet,
      seconds: Math.round(input.ms) / 1000,
      outOfBudget: input.outOfBudget,
    },
  };
}

/** "reward-the-pack-round1-seed1-20261109-1012.json": the round, the seed, then exportedAt as local yyyymmdd-hhmm. */
export function exportFilename(input: RunExportInput): string {
  const d = input.exportedAt;
  const p = (n: number): string => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  return `reward-the-pack-${input.round}-seed${input.seed}-${date}-${p(d.getHours())}${p(d.getMinutes())}.json`;
}

/**
 * Browser only: serialises `data` as compact JSON (a 150,000-week curve is 450,000 numbers; indented, each would sit
 * on its own line and the file would double), offers it as a download named `filename`, revokes the URL.
 */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
