// The built page served for the scripts that drive it outside the Playwright runner (the capture, the shots): vite
// preview on 127.0.0.1, owned by the script that starts it and stopped when it is done.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

export function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when something already answers at `url` (then it is not our server and would be recorded by mistake). */
export async function answers(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

/** Waits for our own server to answer; fails if its process exits first (Astra, G5 diff review: process ownership). */
async function waitForServer(url: string, server: ChildProcess): Promise<void> {
  let exited = false;
  server.once('exit', () => (exited = true));
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error(`the preview server exited before it answered at ${url}`);
    if (await answers(url)) return;
    await pause(250);
  }
  throw new Error(`the preview server did not answer at ${url} within 30 s`);
}

/** Serves dist/ on `port` and returns its address and the process; throws if dist/ is missing or the port is taken. */
export async function serveDist(port: number): Promise<{ url: string; server: ChildProcess }> {
  if (!existsSync('dist/index.html')) throw new Error('run npm run build first');
  const url = `http://127.0.0.1:${port}/`;
  if (await answers(url)) throw new Error(`something already answers at ${url}; stop it, or pass --url`);
  // Vite itself, not an npx wrapper, so the process we hold is the server we stop.
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
  try {
    await waitForServer(url, server);
  } catch (err) {
    await stopServer(server); // never leave a server behind on a failed start
    throw err;
  }
  return { url, server };
}

/** Stops our server and waits for it to go, so no Vite process is left behind (killed outright after 3 s). */
export async function stopServer(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 3000);
    server.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    server.kill();
  });
}

export function stamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
