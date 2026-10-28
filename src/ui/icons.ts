// The measures' icons (G5c): one shape per measure everywhere on the page (the bonus plan's rows, the report's tiles,
// the yard's HUD). Each is the inner markup of an SVG on a 24-unit grid, drawn with strokes in currentColor: wrap it
// with measureIconSvg, or in your own <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
// stroke-linecap="round" stroke-linejoin="round">, or draw it on a canvas with Path2D (every shape is a path, circle,
// ellipse or rect). Decoration only: the measure's name is always the label beside it. The colours are the CSS
// tokens --m-profit, --m-dogs, --m-incidents, --m-reputation, --m-fatigue and --m-ratio in style.css.
import type { KpiKey } from '../world/types.ts';

/** The inner markup of each measure's icon (viewBox 0 0 24 24, stroked). */
export const MEASURE_ICON_PATHS: Readonly<Record<KpiKey, string>> = {
  // A trend line with its arrowhead: profit.
  profit: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  // A paw: dogs served.
  dogsServed:
    '<ellipse cx="12" cy="16" rx="4.6" ry="3.6"/><circle cx="6" cy="10.5" r="1.9"/><circle cx="9.6" cy="6.4" r="1.9"/><circle cx="14.4" cy="6.4" r="1.9"/><circle cx="18" cy="10.5" r="1.9"/>',
  // A warning triangle: incidents.
  incidents: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5"/><path d="M12 17.4v.1"/>',
  // A star: reputation.
  reputation: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/>',
  // A battery running low: staff fatigue.
  fatigue: '<rect x="3" y="7.5" width="16" height="9" rx="2"/><path d="M21.5 10.5v3"/><path d="M6.5 10.5v3"/>',
  // A group of three: the crew against the legal ratio.
  overRatio:
    '<circle cx="12" cy="8" r="3"/><path d="M6.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="5.2" cy="10" r="2.1"/><path d="M1.8 18c.4-2.1 1.7-3.4 3.4-3.6"/><circle cx="18.8" cy="10" r="2.1"/><path d="M22.2 18c-.4-2.1-1.7-3.4-3.4-3.6"/>',
};

/** A money bag: the GM's bonus (the plan in words, the report's bonus tile). Same grid and stroke as the measures. */
export const BONUS_ICON_PATHS =
  '<path d="M9 3.5h6l-1.6 3.2h-2.8z"/><path d="M10.6 6.7C6.5 8.6 4.5 12.2 4.5 15.4c0 3.1 2.6 5.1 7.5 5.1s7.5-2 7.5-5.1c0-3.2-2-6.8-6.1-8.7"/><path d="M13.9 11.2c-.5-.6-1.2-.9-2-.9-1.1 0-1.9.6-1.9 1.4 0 1.9 4 1 4 3 0 .8-.9 1.5-2.1 1.5-.8 0-1.6-.3-2.1-.9"/><path d="M12 9.4v1"/><path d="M12 16.3v1"/>';

/** The CSS token of each measure's accent colour (style.css). */
export const MEASURE_COLOR_TOKENS: Readonly<Record<KpiKey, string>> = {
  profit: '--m-profit',
  dogsServed: '--m-dogs',
  incidents: '--m-incidents',
  reputation: '--m-reputation',
  fatigue: '--m-fatigue',
  overRatio: '--m-ratio',
};

/** An icon's paths as a whole inline SVG string, aria-hidden, `size` CSS pixels square. */
export function iconSvg(paths: string, size = 22, strokeWidth = 2): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
}

/** A measure's icon as an inline SVG string. */
export function measureIconSvg(key: KpiKey, size = 22, strokeWidth = 2): string {
  return iconSvg(MEASURE_ICON_PATHS[key], size, strokeWidth);
}
