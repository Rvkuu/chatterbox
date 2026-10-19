// SEC-T14 / NC8: search the repository for committed secrets and .env files.
// Run: node scripts/check-secrets.mjs [--history]   (--history also searches every past commit)
import { execFileSync } from 'node:child_process';
import { read, root, trackedFiles } from './lib.mjs';

const history = process.argv.includes('--history');
const findings = [];

// Patterns that are a secret wherever they appear.
const TOKEN_PATTERNS = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
  ['generic API key', /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
];

// A line such as SESSION_SECRET=value or password: value is only fine when the value is a
// placeholder or a reference to another variable.
const SENSITIVE =
  /\b([A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[=:]\s*['"]?([^\s'"#]*)/g;
const SAFE_VALUE =
  /^(?:|\$\{?.*|.*\$[({].*|<.*>|.*(?:change-me|replace-with|placeholder|e2e-only|ci-only|test-only|example|not-used|not-a-real|for-tests|x{4,}).*)$/i;

function scanText(name, text) {
  for (const [label, pattern] of TOKEN_PATTERNS) {
    if (pattern.test(text)) findings.push(`${name}: looks like a ${label}`);
  }
  // Only configuration-style files are searched for assignments, to avoid noise in source code.
  if (/(^|\/)(\.env[^/]*|docker-compose[^/]*\.ya?ml|[^/]+\.ya?ml)$/.test(name)) {
    for (const m of text.matchAll(SENSITIVE)) {
      if (!SAFE_VALUE.test(m[2]))
        findings.push(`${name}: ${m[1]} has a value that is not a placeholder`);
    }
  }
}

const files = trackedFiles();

// 1. No .env file is tracked (only .env.example is allowed).
for (const f of files) {
  if (/(^|\/)\.env(\.[^/]*)?$/.test(f) && !f.endsWith('.env.example'))
    findings.push(`${f}: an environment file is tracked`);
}
// 2. The current files.
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|ico|woff2?|lock)$/.test(f) || f === 'package-lock.json') continue;
  let text;
  try {
    text = read(f);
  } catch {
    continue;
  }
  scanText(f, text);
}
// 3. .gitignore must keep .env out.
if (!/^\.env$/m.test(read('.gitignore'))) findings.push('.gitignore does not ignore .env');

// 4. Optionally, every past commit.
if (history) {
  const names = execFileSync('git', ['log', '--all', '--name-only', '--pretty=format:'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  })
    .split('\n')
    .filter((n) => /(^|\/)\.env(\.[^/]*)?$/.test(n) && !n.endsWith('.env.example'));
  for (const n of new Set(names)) findings.push(`history: ${n} was committed at some point`);
  const patch = execFileSync('git', ['log', '--all', '-p', '--no-color', '--pretty=format:'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 29,
  });
  for (const [label, pattern] of TOKEN_PATTERNS) {
    if (pattern.test(patch))
      findings.push(`history: a past commit contains something that looks like a ${label}`);
  }
}

console.log(
  `Searched ${files.length} tracked files${history ? ' and the whole Git history' : ''}.`,
);
if (findings.length > 0) {
  console.error(`\n${findings.length} finding(s):\n- ${[...new Set(findings)].join('\n- ')}`);
  process.exit(1);
}
console.log('No committed secrets and no tracked .env file found.');
