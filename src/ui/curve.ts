// The training curve: one point per training week (episode), the moving average on top, the test weeks as marks.
// A pure drawing function: it reads the curve by index, keeps nothing, and draws at most two points (the lowest and
// the highest) per horizontal pixel, so a redraw costs the same at 40,000 episodes as at 4,000.
import type { CurvePoint, EvalPoint } from '../learn/train.ts';

export interface CurveColors {
  background: string;
  ink: string; // axes, tick labels, legend text
  grid: string;
  raw: string; // each training week, faint
  average: string; // the moving average, bold
  evaluation: string; // the test weeks
}

export interface CurveOptions {
  pixelRatio: number; // backing-store pixels per CSS pixel; the caller sizes the canvas
  colors: CurveColors;
  averageWindow: number; // for the legend: "Average of the last 100 weeks"
  minEpisodes: number; // the x axis spans at least this many episodes, so the first seconds are not a smear
}

const FONT_FAMILY = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** A round step (1, 2, 2.5 or 5 times a power of ten) that cuts `span` into about `ticks` pieces. */
export function niceStep(span: number, ticks: number): number {
  if (!(span > 0)) return 1;
  const raw = span / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const f = raw / magnitude;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * magnitude;
}

const formatNumber = (v: number): string => Math.round(v).toLocaleString('en-US');

/**
 * Draws the whole chart into `ctx`, whose canvas is `width` × `height` CSS pixels at `options.pixelRatio`.
 * x = episode (1-based), y = the week's total under the bonus plan.
 */
export function drawCurve(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  curve: readonly CurvePoint[],
  evals: readonly EvalPoint[],
  options: CurveOptions,
): void {
  const { colors } = options;
  const n = curve.length;
  ctx.setTransform(options.pixelRatio, 0, 0, options.pixelRatio, 0, 0);
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // Text scales with the canvas so the back row of a classroom can read it.
  const fontPx = Math.round(Math.min(18, Math.max(11, width / 55)));
  ctx.font = `${fontPx}px ${FONT_FAMILY}`;

  // The plot area, inside room for the tick labels and the axis titles.
  const left = Math.round(fontPx * 5);
  const right = Math.round(fontPx * 2.4); // room for half of the last x tick label
  const top = Math.round(fontPx * 1);
  const bottom = Math.round(fontPx * 3.4);
  const plotW = Math.max(1, Math.floor(width - left - right));
  const plotH = Math.max(1, Math.floor(height - top - bottom));

  // x range: 0 to a round number at or above the episodes trained.
  const lastEpisode = n > 0 ? (curve[n - 1] as CurvePoint).episode : 0;
  const xSpan = Math.max(lastEpisode, options.minEpisodes);
  const xStep = niceStep(xSpan, 5);
  const xMax = Math.ceil(xSpan / xStep) * xStep;

  // y range: every week and every test week fits, padded to round numbers.
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = (curve[i] as CurvePoint).reward;
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  for (let i = 0; i < evals.length; i++) {
    const r = (evals[i] as EvalPoint).reward;
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  if (lo === Infinity) {
    lo = 0;
    hi = 600;
  }
  if (lo > 0) lo = 0; // the zero line is always on the chart: below it the GM lost money
  if (hi - lo < 1) hi = lo + 1;
  const yStep = niceStep(hi - lo, 5);
  const yMin = Math.floor(lo / yStep) * yStep;
  const yMax = Math.ceil(hi / yStep) * yStep;

  const xOf = (episode: number): number => left + (episode / xMax) * plotW;
  const yOf = (value: number): number => top + ((yMax - value) / (yMax - yMin)) * plotH;

  // Grid and tick labels.
  ctx.lineWidth = 1;
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.beginPath();
  for (let v = yMin; v <= yMax + yStep / 2; v += yStep) {
    const y = Math.round(yOf(v)) + 0.5;
    ctx.moveTo(left, y);
    ctx.lineTo(left + plotW, y);
    ctx.fillText(formatNumber(v), left - fontPx * 0.5, y);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let v = 0; v <= xMax + xStep / 2; v += xStep) {
    const x = Math.round(xOf(v)) + 0.5;
    ctx.moveTo(x, top);
    ctx.lineTo(x, top + plotH);
    ctx.fillText(formatNumber(v), x, top + plotH + fontPx * 0.4);
  }
  ctx.stroke();

  // Axes, with the zero line drawn as firmly as the axes.
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, top + plotH);
  ctx.lineTo(left + plotW, top + plotH);
  if (yMin < 0) {
    const y0 = Math.round(yOf(0)) + 0.5;
    ctx.moveTo(left, y0);
    ctx.lineTo(left + plotW, y0);
  }
  ctx.stroke();

  // Axis titles.
  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Training weeks (episodes)', left + plotW / 2, height - fontPx * 0.2);
  ctx.save();
  ctx.translate(fontPx * 0.2, top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'top';
  ctx.fillText('Bonus points per week', 0, 0);
  ctx.restore();

  if (n === 0) {
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('The curve appears here when the GM trains.', left + plotW / 2, top + plotH / 2);
    return;
  }

  // Everything below stays inside the plot area.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, plotW, plotH);
  ctx.clip();

  // Each training week, faint: one bar per pixel column from that column's lowest week to its highest.
  ctx.fillStyle = colors.raw;
  let column = -1;
  let colMin = 0;
  let colMax = 0;
  const flushRaw = (): void => {
    const yTop = yOf(colMax);
    const yBottom = yOf(colMin);
    ctx.fillRect(left + column, yTop, 1, Math.max(1.5, yBottom - yTop));
  };
  for (let i = 0; i < n; i++) {
    const p = curve[i] as CurvePoint;
    const c = Math.min(plotW - 1, Math.floor((p.episode / xMax) * plotW));
    if (c !== column) {
      if (column >= 0) flushRaw();
      column = c;
      colMin = p.reward;
      colMax = p.reward;
    } else {
      if (p.reward < colMin) colMin = p.reward;
      if (p.reward > colMax) colMax = p.reward;
    }
  }
  flushRaw();

  // The moving average, bold: per pixel column its lowest and highest value, in the order they came.
  ctx.strokeStyle = colors.average;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  column = -1;
  let minFirst = true;
  let minAt = 0; // the indices of the column's lowest and highest value, for their order
  let maxAt = 0;
  let started = false;
  const flushAverage = (): void => {
    const x = left + column + 0.5;
    // The column's two extremes in the order they happened, so the line never doubles back in time.
    const first = minFirst ? colMin : colMax;
    const second = minFirst ? colMax : colMin;
    if (started) ctx.lineTo(x, yOf(first));
    else ctx.moveTo(x, yOf(first));
    started = true;
    if (second !== first) ctx.lineTo(x, yOf(second));
  };
  for (let i = 0; i < n; i++) {
    const p = curve[i] as CurvePoint;
    const v = p.movingAverage;
    const c = Math.min(plotW - 1, Math.floor((p.episode / xMax) * plotW));
    if (c !== column) {
      if (column >= 0) flushAverage();
      column = c;
      colMin = v;
      colMax = v;
      minAt = i;
      maxAt = i;
      minFirst = true;
    } else {
      if (v < colMin) {
        colMin = v;
        minAt = i;
      }
      if (v > colMax) {
        colMax = v;
        maxAt = i;
      }
      minFirst = minAt <= maxAt;
    }
  }
  flushAverage();
  ctx.stroke();

  // The test weeks: one mark per evaluation.
  const radius = Math.max(4, fontPx * 0.32);
  ctx.fillStyle = colors.evaluation;
  ctx.strokeStyle = colors.background;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < evals.length; i++) {
    const e = evals[i] as EvalPoint;
    ctx.beginPath();
    ctx.arc(xOf(e.episode), yOf(e.reward), radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // The legend sits bottom right, where a climbing curve leaves room.
  drawLegend(ctx, left + plotW - fontPx * 0.8, top + plotH - fontPx * 0.8, fontPx, radius, options);
}

/** Draws the legend box with its bottom-right corner at (right, bottom). */
function drawLegend(
  ctx: CanvasRenderingContext2D,
  right: number,
  bottom: number,
  fontPx: number,
  radius: number,
  options: CurveOptions,
): void {
  const { colors } = options;
  const labels = ['Each training week', `Average of the last ${options.averageWindow} weeks`, 'Test week (no exploring)'];
  const swatch = fontPx * 1.8;
  const row = fontPx * 1.5;
  let textWidth = 0;
  for (const label of labels) textWidth = Math.max(textWidth, ctx.measureText(label).width);
  const boxW = swatch + fontPx * 0.6 + textWidth + fontPx;
  const boxH = row * labels.length + fontPx * 0.5;
  const x = right - boxW;
  const y = bottom - boxH;

  ctx.globalAlpha = 0.88;
  ctx.fillStyle = colors.background;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, boxW, boxH);

  const sx = x + fontPx * 0.5;
  const tx = sx + swatch + fontPx * 0.6;
  const mid = (i: number): number => y + fontPx * 0.25 + row * i + row / 2;

  ctx.fillStyle = colors.raw;
  ctx.fillRect(sx, mid(0) - fontPx * 0.45, swatch, fontPx * 0.9);

  ctx.strokeStyle = colors.average;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, mid(1));
  ctx.lineTo(sx + swatch, mid(1));
  ctx.stroke();

  ctx.fillStyle = colors.evaluation;
  ctx.beginPath();
  ctx.arc(sx + swatch / 2, mid(2), radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  labels.forEach((label, i) => ctx.fillText(label, tx, mid(i)));
}
