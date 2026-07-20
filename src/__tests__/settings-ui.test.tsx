import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Settings pulls in app-update, which imports the PWA virtual module that isn't
// available under vitest; stub it so we can render the screen in isolation.
vi.mock('../lib/app-update', () => ({ hardRefreshApp: vi.fn(), enableFreshAppUpdates: vi.fn() }));

import { Settings } from '../screens/Settings';
import { DEFAULT_PROFILE, DEFAULT_TARGETS } from '../lib/storage';
import { DEFAULT_REMINDERS } from '../lib/reminders';
import type { NutritionTargets } from '../types';

function renderSettings(overrides: Partial<NutritionTargets> = {}, onSaveTargets = vi.fn(() => true)) {
  const targets = { ...DEFAULT_TARGETS, ...overrides };
  render(
    <Settings
      profile={{ ...DEFAULT_PROFILE, name: 'Troy' }}
      targets={targets}
      reminders={DEFAULT_REMINDERS}
      templates={[]}
      savedFoods={[]}
      foodDatabase={[]}
      weightEntries={[]}
      onSaveProfile={vi.fn(() => true)}
      onSaveTargets={onSaveTargets}
      onSaveReminders={vi.fn(async () => ({ ok: true, native: false, permission: 'granted' as const, scheduled: 0, message: 'ok' }))}
      onSaveTemplate={vi.fn(() => true)}
      onDeleteTemplate={vi.fn()}
      onAddTemplateToLog={vi.fn()}
      onSaveFood={vi.fn(() => true)}
      onDeleteSavedFood={vi.fn(() => true)}
      onAddSavedFoodToLog={vi.fn()}
      onImportComplete={vi.fn()}
      nutritionSyncSupported={false}
      nutritionSyncEnabled={true}
      nutritionSyncLastAt=""
      onToggleNutritionSync={vi.fn()}
      onSyncNutritionToHealthConnect={vi.fn(async () => '')}
      onForceResyncNutritionToday={vi.fn(async () => '')}
    />,
  );
  return { onSaveTargets };
}

describe('Settings collapsible sections', () => {
  it('renders every settings section closed by default, expandable on click', () => {
    renderSettings();
    const dailyTargets = screen.getByText('Daily targets').closest('details');
    expect(dailyTargets).not.toBeNull();
    expect(dailyTargets?.hasAttribute('open')).toBe(false);

    fireEvent.click(screen.getByText('Daily targets'));
    expect(dailyTargets?.hasAttribute('open')).toBe(true);
  });

  it('keeps every top-level section collapsed on first render', () => {
    renderSettings();
    const allSections = document.querySelectorAll('details.settings-section');
    expect(allSections.length).toBeGreaterThan(5);
    allSections.forEach((section) => expect(section.hasAttribute('open')).toBe(false));
  });
});

describe('Settings numeric input UX', () => {
  it('renders a zero micronutrient target as an empty field, not a literal 0', () => {
    // iodineMcg defaults to 0 in DEFAULT_TARGETS.
    renderSettings();
    const iodine = screen.getByLabelText(/Iodine/) as HTMLInputElement;
    expect(iodine.value).toBe('');
  });

  it('lets a user type into a zero field without first deleting a 0, and saves the value', () => {
    const { onSaveTargets } = renderSettings();
    const iodine = screen.getByLabelText(/Iodine/) as HTMLInputElement;
    // The user taps in and types straight away — no stuck 0 to backspace.
    fireEvent.change(iodine, { target: { value: '150' } });
    expect(iodine.value).toBe('150');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSaveTargets).toHaveBeenCalledWith(expect.objectContaining({ iodineMcg: 150 }));
  });

  it('shows an existing non-zero target and can be cleared then retyped', () => {
    const { onSaveTargets } = renderSettings({ calories: 1800 });
    const calories = screen.getByLabelText('Calories (kcal)') as HTMLInputElement;
    expect(calories.value).toBe('1800');
    // Clear it fully (empty stays empty rather than snapping back to 0)...
    fireEvent.change(calories, { target: { value: '' } });
    expect(calories.value).toBe('');
    // ...then type a new value.
    fireEvent.change(calories, { target: { value: '2000' } });
    expect(calories.value).toBe('2000');
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSaveTargets).toHaveBeenCalledWith(expect.objectContaining({ calories: 2000 }));
  });

  it('rejects a required target left empty (treated as zero) with a validation message', () => {
    const { onSaveTargets } = renderSettings({ calories: 1800 });
    const calories = screen.getByLabelText('Calories (kcal)') as HTMLInputElement;
    fireEvent.change(calories, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(onSaveTargets).not.toHaveBeenCalled();
    expect(screen.getByText(/must be greater than zero/)).toBeTruthy();
  });

  it('renders day selection controls for all reminders', () => {
    renderSettings();

    expect(screen.getByRole('group', { name: 'Meal logging days' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Weigh-in days' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Electrolytes days' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Shopping list days' })).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Every day' })).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: 'Weekdays' })).toHaveLength(4);
  });
});
