/**
 * Launch uvicorn with the project's own interpreter.
 *
 * Two problems this exists to solve, both of which bit the plain
 * `.venv/Scripts/python -m uvicorn ...` string it replaces:
 *
 * 1. **Path separators.** npm runs scripts through `cmd.exe /d /s /c` on
 *    Windows, and cmd will not accept forward slashes in the executable
 *    position - `.venv/Scripts/python` fails with "'.venv' is not recognized".
 *    Backslashes fix that and break every POSIX shell instead. Resolving the
 *    path in Node sidesteps the choice.
 * 2. **The wrong interpreter.** `python` on PATH here is a bare 3.10 with none
 *    of this project's packages, so falling back to it turns a missing venv
 *    into a confusing `ModuleNotFoundError` several seconds later. This checks
 *    for the venv up front and says so plainly.
 *
 * Extra arguments are forwarded, so `npm run api` adds `--reload` and
 * `npm run serve` does not:
 *
 *     node scripts/run-api.mjs --reload --port 8000
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

// Windows venvs put the interpreter in Scripts/, everything else in bin/.
const python =
  process.platform === 'win32'
    ? join(repoRoot, '.venv', 'Scripts', 'python.exe')
    : join(repoRoot, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.error(
    `\nNo virtualenv interpreter at ${python}\n\n` +
      'Create it from the repo root, then install the pinned dependencies:\n\n' +
      '    python -m venv .venv\n' +
      (process.platform === 'win32'
        ? '    .venv\\Scripts\\activate\n'
        : '    source .venv/bin/activate\n') +
      '    pip install -r requirements.txt\n',
  );
  process.exit(1);
}

// Default to :8000 because that is what frontend/vite.config.ts proxies to.
// A --port in the forwarded args wins, since uvicorn takes the last one.
const args = ['-m', 'uvicorn', 'App.Api:app', '--port', '8000', ...process.argv.slice(2)];

const child = spawn(python, args, {
  cwd: repoRoot, // absolute `App.` and `Src.` imports only resolve from here
  stdio: 'inherit',
});

child.on('error', (error) => {
  console.error(`Could not start uvicorn: ${error.message}`);
  process.exit(1);
});

// Mirror the child's exit so Ctrl-C and a crashed server both surface to npm.
child.on('exit', (code, signal) => {
  process.exit(signal ? 1 : (code ?? 0));
});
