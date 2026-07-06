import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// How many patch values are allowed (0..PATCH_CAP-1) before a release rolls
// over into the next minor version instead of letting patch climb forever
// (e.g. v1.2.9 -> v1.3.0, not v1.2.10). Major and minor are the numbers meant
// to actually move release-to-release; patch is just "how many small fixes
// since the last minor", so it's kept single-digit.
export const PATCH_CAP = 10;

export function parseVersion(version) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (![major, minor, patch].every(Number.isInteger)) {
    throw new Error(`Not a valid major.minor.patch version: ${version}`);
  }
  return { major, minor, patch };
}

export function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

// Conventional-commit-ish detection, scanning full commit messages (not just
// subjects) so a "BREAKING CHANGE:" footer is caught too. Case-insensitive
// since commit authors are inconsistent about casing.
export function determineBumpType(commitMessages) {
  const breaking = /breaking change/i.test(commitMessages) || /^\s*\w+(\([^)]*\))?!:/im.test(commitMessages);
  if (breaking) return 'major';
  if (/^\s*feat(\([^)]*\))?:/im.test(commitMessages)) return 'minor';
  return 'patch';
}

export function computeNextVersion(current, bumpType) {
  if (bumpType === 'major') return { major: current.major + 1, minor: 0, patch: 0 };
  if (bumpType === 'minor') return { major: current.major, minor: current.minor + 1, patch: 0 };
  const nextPatch = current.patch + 1;
  // Patch bump rolls into a minor bump once it would hit the cap, rather than
  // producing a double-digit (or larger) patch number.
  return nextPatch >= PATCH_CAP
    ? { major: current.major, minor: current.minor + 1, patch: 0 }
    : { major: current.major, minor: current.minor, patch: nextPatch };
}

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

function lastReleaseTag() {
  try {
    return sh('git describe --tags --abbrev=0 --match "v*"');
  } catch {
    return ''; // no release tag yet
  }
}

function commitMessagesSinceLastRelease() {
  const tag = lastReleaseTag();
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  try {
    return sh(`git log ${range} --pretty=%B`);
  } catch {
    return '';
  }
}

function readPackageVersion(packageJsonPath) {
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  return parseVersion(pkg.version);
}

function main() {
  const packageJsonPath = new URL('../package.json', import.meta.url);
  const current = readPackageVersion(packageJsonPath);
  const bumpType = determineBumpType(commitMessagesSinceLastRelease());
  const next = computeNextVersion(current, bumpType);
  // Consumed by the deploy workflow via $GITHUB_OUTPUT.
  process.stdout.write(formatVersion(next));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
