// Entry point: mount the page, then start the pilot run if the address asks for one (?pilot=N).
import { mountApp, showError } from './ui/app.ts';
import { pilotCount, runPilot } from './ui/pilot.ts';
import './style.css';

const page = mountApp();
const pilotSeeds = pilotCount(window.location.search);
if (pilotSeeds !== null) {
  runPilot(page, pilotSeeds).catch((err: unknown) => showError(page, err));
}
