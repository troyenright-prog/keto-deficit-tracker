import { describe, expect, it } from 'vitest';
import { displayNumericValue, parseNumericInput } from '../lib/numeric-field';

describe('parseNumericInput', () => {
  it('parses a valid number and clamps it to the minimum', () => {
    expect(parseNumericInput('5')).toBe(5);
    expect(parseNumericInput('0.5', 1)).toBe(1);
    expect(parseNumericInput('10', 1)).toBe(10);
  });

  // FoodForm and Recipes both had local numeric-parsing helpers that ignored
  // their own `min` argument on invalid/empty input, always returning 0
  // regardless of what minimum was requested - e.g. clearing the recipe
  // servings field (min=1) showed 0 instead of falling back to 1.
  it('falls back to the minimum, not 0, for empty or non-numeric input', () => {
    expect(parseNumericInput('', 1)).toBe(1);
    expect(parseNumericInput('abc', 1)).toBe(1);
    expect(parseNumericInput('', 0)).toBe(0);
  });
});

describe('displayNumericValue', () => {
  it('shows 0 and undefined as an empty string so the placeholder can show through', () => {
    expect(displayNumericValue(0)).toBe('');
    expect(displayNumericValue(undefined)).toBe('');
  });

  it('shows any other value as its string form', () => {
    expect(displayNumericValue(5)).toBe('5');
    expect(displayNumericValue(0.5)).toBe('0.5');
  });
});
