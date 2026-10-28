// Entry point: the two bundled faces (Latin only, from @fontsource: no font is fetched from anywhere but the page's
// own origin, D2), the stylesheets, then mount the page and start the pilot run if the address asks for one
// (?pilot=N).
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import { mountApp, showError } from './ui/app.ts';
import { pilotCount, runPilot } from './ui/pilot.ts';
import './style.css';
import './report.css';

const page = mountApp();
const pilotSeeds = pilotCount(window.location.search);
if (pilotSeeds !== null) {
  runPilot(page, pilotSeeds).catch((err: unknown) => showError(page, err));
}
