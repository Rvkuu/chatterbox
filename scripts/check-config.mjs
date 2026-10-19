// NC6 / NFR-P2: all configuration comes from environment variables, and .env.example lists every
// variable the apps and the Compose files read. Also checks that Compose has no hard-coded
// credentials or ports.
// Run: node scripts/check-config.mjs
import { read, trackedFiles } from './lib.mjs';

const example = read('.env.example');
const documented = new Set([...example.matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]));
const problems = [];

// Variables the code reads.
const sources = trackedFiles().filter(
  (f) =>
    /^apps\/(api|web)\/(src\/.*|prisma\.config)\.tsx?$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !f.includes('/generated/') &&
    !f.includes('/test/'),
);
const read_ = new Map();
for (const f of sources) {
  const text = read(f);
  for (const m of text.matchAll(/(?:process\.env|env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g)) {
    if (!read_.has(m[1])) read_.set(m[1], new Set());
    read_.get(m[1]).add(f);
  }
}
for (const [name, files] of read_) {
  if (name === 'NODE_ENV' || documented.has(name)) continue;
  problems.push(`${name} is read in ${[...files].join(', ')} but is not in .env.example`);
}

// Variables Compose reads.
const composeFiles = trackedFiles().filter((f) => /^docker-compose.*\.ya?ml$/.test(f));
for (const f of composeFiles) {
  const text = read(f);
  for (const m of text.matchAll(/\$\{([A-Z][A-Z0-9_]*)/g)) {
    if (!documented.has(m[1])) problems.push(`${f} uses \${${m[1]}} which is not in .env.example`);
  }
  // A credential or port written directly into a Compose file instead of an environment reference.
  for (const m of text.matchAll(/^\s*(\w*(?:PASSWORD|SECRET|TOKEN)\w*):\s*(\S+)/gim)) {
    if (!m[2].startsWith('${')) problems.push(`${f}: ${m[1]} is hard-coded`);
  }
  // The host side of a port mapping must be an environment reference, not a number.
  for (const m of text.matchAll(/^\s*-\s*['"]?((?:\d+\.\d+\.\d+\.\d+:)?\d+:\d+)['"]?\s*$/gm)) {
    problems.push(`${f}: port mapping ${m[1]} is hard-coded`);
  }
}

console.log(
  `Variables read by the code: ${[...read_.keys()].sort().join(', ')}\n` +
    `Documented in .env.example: ${documented.size}; Compose files checked: ${composeFiles.join(', ')}`,
);
if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('Every variable is documented, and nothing is hard-coded in the Compose files.');
