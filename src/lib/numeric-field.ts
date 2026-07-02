// Shared helpers for text-backed numeric inputs. Binding a numeric <input> to a
// raw number forces a literal "0" the user must delete before typing, which is
// especially painful on mobile (the caret sits after the 0 and backspace is
// fiddly). Backing the input by its raw text instead lets an empty field stay
// empty (showing the placeholder) while still producing a clean number on save.

// Render a numeric model value as input text: 0 and undefined show as empty so
// the field falls back to its placeholder instead of a stuck "0".
export function displayNumericValue(value: number | undefined): string {
  return value === undefined || value === 0 ? '' : String(value);
}

// Parse input text into a clamped number for the model. Empty or non-numeric
// text becomes 0 (or the supplied minimum).
export function parseNumericInput(text: string, min = 0): number {
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return min > 0 ? min : 0;
  return Math.max(min, n);
}
