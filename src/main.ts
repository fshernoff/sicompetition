// Entry point: the stylesheets (style.css declares the one bundled face, Archivo, Latin only, from
// @fontsource-variable/archivo: no font is fetched from anywhere but the page's own origin, D2), then mount the page
// and start the pilot run if the address asks for one (?pilot=N).
import { mountApp, showError } from './ui/app.ts';
import { pilotCount, runPilot } from './ui/pilot.ts';
import './style.css';
import './report.css';

const page = mountApp();
const pilotSeeds = pilotCount(window.location.search);
if (pilotSeeds !== null) {
  runPilot(page, pilotSeeds).catch((err: unknown) => showError(page, err));
}
