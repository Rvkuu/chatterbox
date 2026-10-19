// Checks docs/acceptance-tests.md against the tests (section 1 and 7 of that document):
//  - every scenario (AT-...) and every security case (SEC-T...) has at least one test whose
//    name starts with its ID, and
//  - a scenario has a test in each layer that the document lists for it.
// Run: node scripts/check-traceability.mjs   (add --verbose to see every ID)
import { read, trackedFiles } from './lib.mjs';

const verbose = process.argv.includes('--verbose');

// ID -> layers, from the scenario tables in docs/acceptance-tests.md.
const scenarios = new Map();
for (const line of read('docs/acceptance-tests.md').split('\n')) {
  // | ID | Scenario | Layers | Covers |
  const cells = line.split('|').map((c) => c.trim());
  if (cells.length >= 6 && /^AT-[A-Z]\d+$/.test(cells[1] ?? '')) {
    scenarios.set(
      cells[1],
      (cells[cells.length - 3] ?? '').split(',').map((l) => l.trim()),
    );
  }
}
// Security cases are defined in docs/security.md section 13.
const security = [...read('docs/security.md').matchAll(/^\| (SEC-T\d+) \|/gm)].map((m) => m[1]);

// Where tests live, by layer. Unit tests may be in either app.
const LAYER_DIRS = {
  U: ['apps/api', 'apps/web'],
  I: ['apps/api'],
  F: ['apps/web'],
  E: ['apps/e2e'],
};

const testFiles = trackedFiles().filter((f) => /\.(test\.tsx?|spec\.ts)$/.test(f));
const found = new Map(); // ID -> Set of app folders
for (const file of testFiles) {
  const app = file.split('/').slice(0, 2).join('/');
  // A test name starts with its ID. A name may also cite security cases, as in
  // "AT-R2: stores only a hash (SEC-T1)", and then it counts for those too.
  for (const m of read(file).matchAll(/['"`]((?:AT-[A-Z]\d+|SEC-T\d+)):([^\n]*)/g)) {
    for (const id of [m[1], ...[...m[2].matchAll(/SEC-T\d+/g)].map((s) => s[0])]) {
      if (!found.has(id)) found.set(id, new Set());
      found.get(id).add(app);
    }
  }
}

// Evidence that is not a test with the ID in its name.
const OTHER_EVIDENCE = {
  // Layer R: checked by reading the README (AT-D9).
  'AT-D9': () => {
    const readme = read('README.md');
    return ['down -v', 'DELETED', 'does **not** delete data'].every((s) => readme.includes(s));
  },
  // SEC-T14: a script searches the repository for committed secrets and .env files.
  'SEC-T14': () => trackedFiles().includes('scripts/check-secrets.mjs'),
};

const problems = [];
const rows = [];

for (const [id, layers] of scenarios) {
  const apps = found.get(id) ?? new Set();
  const missingLayers = [];
  for (const layer of layers) {
    if (layer === 'R') continue;
    if (!LAYER_DIRS[layer].some((dir) => apps.has(dir))) missingLayers.push(layer);
  }
  const review = layers.includes('R') ? (OTHER_EVIDENCE[id]?.() ?? false) : true;
  const ok = missingLayers.length === 0 && review && (apps.size > 0 || layers.includes('R'));
  if (!ok) {
    problems.push(
      `${id}: ${layers.includes('R') && !review ? 'the README check failed' : `no test in layer(s) ${missingLayers.join(', ')}`}`,
    );
  }
  rows.push(
    `${ok ? 'ok     ' : 'MISSING'} ${id.padEnd(7)} layers ${layers.join(',').padEnd(8)} tests in: ${[...apps].join(', ') || '-'}`,
  );
}

for (const id of security) {
  const covered = (found.get(id)?.size ?? 0) > 0 || (OTHER_EVIDENCE[id]?.() ?? false);
  if (!covered) problems.push(`${id}: no test and no other evidence`);
  rows.push(
    `${covered ? 'ok     ' : 'MISSING'} ${id.padEnd(7)} security case  tests in: ${[...(found.get(id) ?? [])].join(', ') || (OTHER_EVIDENCE[id] ? 'script' : '-')}`,
  );
}

// Tests that name an ID that the documents do not define are a typo or stale.
const known = new Set([...scenarios.keys(), ...security]);
for (const id of found.keys()) {
  if (!known.has(id)) problems.push(`${id}: used in a test name but not defined in the documents`);
}

if (verbose) console.log(rows.join('\n'));
console.log(
  `Scenarios: ${scenarios.size}, security cases: ${security.length}, test files scanned: ${testFiles.length}`,
);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(
  'Every scenario and security case has a test in each layer it names (or other evidence).',
);
