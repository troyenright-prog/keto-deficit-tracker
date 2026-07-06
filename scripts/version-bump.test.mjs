import { describe, expect, it } from 'vitest';
import { computeNextVersion, determineBumpType, formatVersion, parseVersion } from './version-bump.mjs';

describe('parseVersion / formatVersion', () => {
  it('round-trips a major.minor.patch string', () => {
    expect(formatVersion(parseVersion('1.2.9'))).toBe('1.2.9');
  });

  it('rejects a non-numeric version', () => {
    expect(() => parseVersion('1.2.x')).toThrow();
  });
});

describe('determineBumpType', () => {
  it('treats fix/chore/refactor commits as a patch bump', () => {
    expect(determineBumpType('fix: correct rounding\n')).toBe('patch');
    expect(determineBumpType('chore: release v1.0.0 [skip ci]\n')).toBe('patch');
    expect(determineBumpType('refactor: simplify food form\n')).toBe('patch');
  });

  it('treats a feat commit as a minor bump', () => {
    expect(determineBumpType('feat: add recipe scaling\n')).toBe('minor');
    expect(determineBumpType('feat(planner): add drag reorder\n')).toBe('minor');
  });

  it('treats a BREAKING CHANGE footer as a major bump even on a fix commit', () => {
    expect(determineBumpType('fix: change storage schema\n\nBREAKING CHANGE: renames the food log key\n')).toBe('major');
  });

  it('treats a "!" breaking marker as a major bump', () => {
    expect(determineBumpType('feat!: drop legacy import format\n')).toBe('major');
  });

  it('picks the highest-priority bump across multiple commits since the last tag', () => {
    const messages = 'fix: small tweak\n\nfeat: add shopping list sharing\n\nchore: release v1.0.0 [skip ci]\n';
    expect(determineBumpType(messages)).toBe('minor');
  });

  it('defaults an unconventional message to a patch bump', () => {
    expect(determineBumpType('Move Save settings button to the bottom\n')).toBe('patch');
  });
});

describe('computeNextVersion', () => {
  it('bumps patch and keeps major/minor when under the cap', () => {
    expect(computeNextVersion({ major: 1, minor: 2, patch: 3 }, 'patch')).toEqual({ major: 1, minor: 2, patch: 4 });
  });

  it('rolls a patch bump into the next minor once patch would reach the cap', () => {
    expect(computeNextVersion({ major: 1, minor: 2, patch: 9 }, 'patch')).toEqual({ major: 1, minor: 3, patch: 0 });
  });

  it('bumps minor and resets patch to 0', () => {
    expect(computeNextVersion({ major: 1, minor: 2, patch: 7 }, 'minor')).toEqual({ major: 1, minor: 3, patch: 0 });
  });

  it('bumps major and resets minor/patch to 0', () => {
    expect(computeNextVersion({ major: 1, minor: 9, patch: 5 }, 'major')).toEqual({ major: 2, minor: 0, patch: 0 });
  });
});
