import { useState, useCallback } from 'react';
import './App.css';
import { Nav } from './components/Nav';
import { Dashboard } from './screens/Dashboard';
import { AddFood } from './screens/AddFood';
import { DailyLog } from './screens/DailyLog';
import { WeeklySummary } from './screens/WeeklySummary';
import { Profile } from './screens/Profile';
import { SavedFoods } from './screens/SavedFoods';
import {
  loadProfile, saveProfile,
  loadTargets, saveTargets,
  loadFoodLog, saveFoodLog,
  loadSavedFoods, saveSavedFoods,
  loadWeightEntries, saveWeightEntries,
} from './lib/storage';
import { summariseDay, todayDateString } from './lib/nutrition';
import { buildRecommendations } from './lib/recommendations';
import { nanoid } from './lib/nanoid';
import type { FoodLogEntry, FoodItem, UserProfile, NutritionTargets, WeightEntry } from './types';

export type Screen = 'dashboard' | 'add-food' | 'daily-log' | 'weekly' | 'saved-foods' | 'profile';

function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [targets, setTargets] = useState<NutritionTargets>(loadTargets);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>(loadFoodLog);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(loadSavedFoods);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(loadWeightEntries);

  const today = todayDateString();
  const todaySummary = summariseDay(today, foodLog);
  const recommendations = buildRecommendations(todaySummary, targets);

  const handleAddEntry = useCallback((entry: FoodLogEntry) => {
    setFoodLog((prev) => {
      const next = [...prev, entry];
      saveFoodLog(next);
      return next;
    });
  }, []);

  const handleDeleteEntry = useCallback((id: string) => {
    setFoodLog((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveFoodLog(next);
      return next;
    });
  }, []);

  const handleEditEntry = useCallback((updated: FoodLogEntry) => {
    setFoodLog((prev) => {
      const next = prev.map((e) => (e.id === updated.id ? updated : e));
      saveFoodLog(next);
      return next;
    });
  }, []);

  const handleSaveFood = useCallback((food: FoodItem) => {
    setSavedFoods((prev) => {
      const next = [...prev, food];
      saveSavedFoods(next);
      return next;
    });
  }, []);

  const handleDeleteSavedFood = useCallback((id: string) => {
    setSavedFoods((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveSavedFoods(next);
      return next;
    });
  }, []);

  const handleAddSavedFoodToLog = useCallback((food: FoodItem) => {
    const entry: FoodLogEntry = {
      id: nanoid(),
      date: today,
      foodItemId: food.id,
      name: food.name,
      servingSize: food.servingSize,
      servingMultiplier: 1,
      calories: food.calories,
      proteinG: food.proteinG,
      fatG: food.fatG,
      totalCarbsG: food.totalCarbsG,
      fibreG: food.fibreG,
      sugarAlcoholsG: food.sugarAlcoholsG,
      sodiumMg: food.sodiumMg,
      potassiumMg: food.potassiumMg,
      magnesiumMg: food.magnesiumMg,
      loggedAt: new Date().toISOString(),
    };
    handleAddEntry(entry);
    setScreen('dashboard');
  }, [today, handleAddEntry]);

  const handleSaveProfile = useCallback((p: UserProfile) => {
    setProfile(p);
    saveProfile(p);
  }, []);

  const handleSaveTargets = useCallback((t: NutritionTargets) => {
    setTargets(t);
    saveTargets(t);
  }, []);

  const handleAddWeight = useCallback((weight: number, unit: 'kg' | 'lbs') => {
    const entry: WeightEntry = {
      id: nanoid(),
      date: today,
      weight,
      unit,
      loggedAt: new Date().toISOString(),
    };
    setWeightEntries((prev) => {
      const next = [...prev, entry];
      saveWeightEntries(next);
      return next;
    });
  }, [today]);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Keto Tracker</span>
        {profile.name && <span className="app-user">Hi, {profile.name}</span>}
      </header>

      <main className="app-main">
        {screen === 'dashboard' && (
          <Dashboard
            summary={todaySummary}
            targets={targets}
            recommendations={recommendations}
            onAddFood={() => setScreen('add-food')}
          />
        )}
        {screen === 'add-food' && (
          <AddFood
            savedFoods={savedFoods}
            onAdd={(entry) => { handleAddEntry(entry); }}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'daily-log' && (
          <DailyLog
            log={foodLog}
            savedFoods={savedFoods}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
            onSaveFood={handleSaveFood}
          />
        )}
        {screen === 'weekly' && (
          <WeeklySummary
            log={foodLog}
            targets={targets}
            weightEntries={weightEntries}
            onAddWeight={handleAddWeight}
            weightUnit={profile.weightUnit}
          />
        )}
        {screen === 'saved-foods' && (
          <SavedFoods
            foods={savedFoods}
            onDelete={handleDeleteSavedFood}
            onAddToLog={handleAddSavedFoodToLog}
          />
        )}
        {screen === 'profile' && (
          <Profile
            profile={profile}
            targets={targets}
            onSaveProfile={handleSaveProfile}
            onSaveTargets={handleSaveTargets}
          />
        )}
      </main>

      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
