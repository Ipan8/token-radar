// Token Radar entry (Node 22, standard library only).
//
//   node main.ts [--input <snapshot.json|directory>] [--output <dir>]
//
// Reads the sealed DefiLlama snapshot, ranks every pre-token protocol with the model in
// lib/model.ts, and writes the entry's outputs:
//
//   /output/board.json      the ranked board (rows with rank, implied value, farm steps)
//   /output/data.js         the same board, compact, for the dashboard page
//   /output/dashboard/     the static page (index.html + app.css + app.js)
//   /output/screenshots/   the three screenshots of the page
//   /output/dossier.json   what the judge reads, built by vendor/makefun-board.ts
//
// The value model, in one line (see lib/model.ts for the full derivation):
//
//   implied = round( tvl_usd x categoryMultiple x growthMult x maturityMult x breadthMult )
//
// where categoryMultiple is the median mcap/TVL of the live-token protocols in the row's
// category (shrunk toward the global median, clamped to [0.10, 0.60]), growthMult follows the
// 7-day TVL change, maturityMult follows the protocol's age with no token, and breadthMult
// follows its chain count. No protocol name is special-cased anywhere: the same function scores
// every row, and the live-token protocols are set aside at their market cap, never ranked.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The caps the scorer holds the entry to: the text cap shapes the dossier, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value of `--name <value>` or `--name=<value>`, else the fallback. */
function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

function fail(message: string, code = 1): never {
  process.stderr.write(`token radar: ${message}\n`);
  process.exit(code);
}

const inputArg = flag('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  fail(`no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input`, 2);
}
const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`the model wrote a board the gate refuses: ${issue}`);

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));

// Screenshots: the repository stores them base64-encoded (one line each) because the
// submission channel carries text only; main.ts decodes them back to real PNGs here, so
// /output/screenshots holds the same three renders the judge is shown. A plain .png/.jpg
// in screenshots/ is copied as-is, so either form works.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const shotsDir = join(here, 'screenshots');
const shotsOut = join(out, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
const shots: string[] = [];
for (const name of existsSync(shotsDir) ? readdirSync(shotsDir) : []) {
  if (name.startsWith('.')) continue;
  const from = join(shotsDir, name);
  if (!statSync(from).isFile()) continue;
  if (name.endsWith('.png.b64') || name.endsWith('.jpg.b64') || name.endsWith('.jpeg.b64')) {
    const target = name.slice(0, -4);
    const bytes = Buffer.from(readFileSync(from, 'utf8').replace(/\s+/g, ''), 'base64');
    const isPng = PNG_MAGIC.every((b, i) => bytes[i] === b);
    const isJpeg = JPEG_MAGIC.every((b, i) => bytes[i] === b);
    if (!isPng && !isJpeg) fail(`screenshots/${name}: decoded bytes are neither a PNG nor a JPEG`);
    writeFileSync(join(shotsOut, target), bytes);
    shots.push(target);
  } else {
    copyFileSync(from, join(shotsOut, name));
    shots.push(name);
  }
}
if (shots.length < 3) {
  fail(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) fail(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }),
);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')}, ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
