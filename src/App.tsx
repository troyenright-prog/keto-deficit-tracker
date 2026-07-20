import { useState, useCallback, useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import './App.css';
import { Nav } from './components/Nav';
import { UserPicker } from './components/UserPicker';
import { Dashboard } from './screens/Dashboard';
import { AddFood } from './screens/AddFood';
import { DailyLog } from './screens/DailyLog';
import { Progress } from './screens/Progress';
import { Meals } from './screens/Meals';
import { Recipes } from './screens/Recipes';
import { Planner } from './screens/Planner';
import { Garmin } from './screens/Garmin';
import { Settings } from './screens/Settings';
import { BarcodeScanner } from './screens/BarcodeScanner';
import {
  loadProfile, saveProfile,
  loadTargets, saveTargets,
  loadFoodLog, saveFoodLog,
  loadSavedFoods, saveSavedFoods,
  loadFoodDatabase, saveFoodDatabase,
  loadWeightEntries, saveWeightEntries,
  loadDailyActivity, saveDailyActivity,
  loadSleepEntries, saveSleepEntries,
  loadVitalsEntries, saveVitalsEntries,
  loadMealTemplates, saveMealTemplates,
  loadRecipes, saveRecipes,
  loadShoppingList,
  loadMealPlan, saveMealPlan,
  loadReminders, saveReminders,
  loadNutritionSync, saveNutritionSync,
  saveFoodLogAndMealPlan,
  migrateIfNeeded,
  seedDemoDataIfEmpty,
  configureStorageScope,
  claimLegacyDataForActiveScope,
  subscribeLocalDataChanges,
  exportAppData,
  importAppData,
  hasLocalUserData,
  markLocalDataModified,
  getLocalDataModifiedAt,
  ensureLocalModifiedBaseline,
  ensureTroyMealTemplates,
  remoteBundleShouldReplaceLocal,
} from './lib/storage';
import {
  FIREBASE_AUTH_ACTIVE,
  FIREBASE_DB_CONFIGURED,
  STORAGE_NAMESPACE,
  initAuth,
  saveRemoteAppData,
  subscribeRemoteAppData,
  subscribeSyncQueue,
} from './lib/firebase-db';
import { APP_USERS, clearCurrentUser, loadCurrentUser, saveCurrentUser, type AppUserKey } from './lib/users';
import { savedFoodToLogEntry, summariseDay, todayDateString } from './lib/nutrition';
import { last7Days } from './lib/weekly';
import { buildRecommendations } from './lib/recommendations';
import { templateToLogEntries } from './lib/meal-templates';
import { recipeToLogEntry } from './lib/recipes';
import { nanoid } from './lib/nanoid';
import { inferMealSlot } from './lib/meals';
import { duplicateLogEntry } from './lib/quick-add';
import { barcodeFoodToFoodDatabaseItem, savedFoodToFoodDatabaseItem, upsertFoodDatabaseItem } from './lib/food-database';
import { applyBarcodeNutritionToEntry, entryNeedsNutritionRepair, hasPositiveNutrition, lookupBarcodeFood, repairFailureMessage, type BarcodeFood, type RepairResult } from './lib/barcode';
import { scheduleReminderNotifications } from './lib/reminders';
import {
  isHealthConnectSupported, healthConnectAvailable,
  ensureStepPermissions, ensureWeightPermissions, ensureActivityExtrasPermissions, ensureSleepPermissions, ensureVitalsPermissions,
  fetchStepHistory, fetchWeightHistory, fetchActivityExtrasHistory, fetchSleepHistory, fetchVitalsHistory,
  hasStepPermissions, hasWeightPermissions, hasActivityExtrasPermissions, hasSleepPermissions, hasVitalsPermissions,
  ensureNutritionWritePermission, hasNutritionWritePermission, writeNutritionRecords,
  deleteAllNutritionRecords, deleteNutritionRecordsForDate,
} from './lib/health-connect';
import {
  GARMIN_AUTO_SYNC_HISTORY_DAYS,
  GARMIN_AUTO_SYNC_INTERVAL_MS,
  GARMIN_AUTO_SYNC_STARTUP_DELAY_MS,
  hasImportedGarminData,
  shouldRunGarminAutoSync,
} from './lib/garmin-auto-sync';
import {
  buildDailyNutritionPayloads,
  CURRENT_NUTRITION_SYNC_SCHEMA,
  nutritionDaySignatures,
  nutritionDaysNeedingSync,
  nutritionPayloadDate,
  summarizePush,
} from './lib/nutrition-hc-sync';
import { toGarminReadings, mergeGarminReadings, summarizeMerge } from './lib/garmin-weight-sync';
import {
  mergeGarminStepReadings, summarizeStepMerge, toGarminStepReadings,
  mergeGarminActivityExtras, summarizeActivityExtrasMerge, toGarminActivityExtras,
} from './lib/garmin-activity-sync';
import { mergeGarminSleepReadings, summarizeSleepMerge, toGarminSleepReadings } from './lib/garmin-sleep-sync';
import { mergeGarminVitalsReadings, summarizeVitalsMerge, toGarminVitalsReadings } from './lib/garmin-vitals-sync';
import { pickMicronutrients } from './lib/micronutrients';
import type {
  FoodLogEntry,
  FoodItem,
  FoodDatabaseItem,
  UserProfile,
  NutritionTargets,
  WeightEntry,
  DailyActivityEntry,
  SleepEntry,
  VitalsEntry,
  MealTemplate,
  Recipe,
  ShoppingItem,
  MealPlanEntry,
  ReminderSettings,
  AppStateBundle,
  MealSlot,
  NutritionSyncSettings,
} from './types';

export type Screen =
  | 'dashboard'
  | 'add-food'
  | 'daily-log'
  | 'progress'
  | 'meals'
  | 'recipes'
  | 'planner'
  | 'weight'
  | 'settings'
  | 'barcode';

type SyncStatus = {
  tone: 'idle' | 'syncing' | 'synced' | 'queued' | 'error';
  text: string;
};

type GarminSyncOptions = {
  days?: number;
  requestPermissions?: boolean;
};

// Cloud sync only runs when Firebase credentials and a database URL are present.
// Without them, the app stays local-only instead of polling a database it can't
// reach and showing a misleading "Offline" status.
const SYNC_ENABLED = FIREBASE_AUTH_ACTIVE && FIREBASE_DB_CONFIGURED;
const SYNC_MISCONFIGURED = FIREBASE_AUTH_ACTIVE && !FIREBASE_DB_CONFIGURED;

function initialSyncStatus(hasUser: boolean): SyncStatus {
  if (!hasUser) return { tone: 'idle', text: 'Pick user' };
  if (SYNC_MISCONFIGURED) return { tone: 'error', text: 'Config' };
  return SYNC_ENABLED ? { tone: 'syncing', text: 'Connecting' } : { tone: 'idle', text: 'Local' };
}

function asSentence(value: string): string {
  if (!value) return value;
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

async function canReadGarminGroup(
  requestPermissions: boolean,
  ensurePermissions: () => Promise<boolean>,
  hasPermissions: () => Promise<boolean>,
): Promise<boolean> {
  return requestPermissions ? ensurePermissions() : hasPermissions();
}

function reloadAll() {
  return {
    profile: loadProfile(),
    targets: loadTargets(),
    foodLog: loadFoodLog(),
    savedFoods: loadSavedFoods(),
    foodDatabase: loadFoodDatabase(),
    weightEntries: loadWeightEntries(),
    dailyActivity: loadDailyActivity(),
    sleepEntries: loadSleepEntries(),
    vitalsEntries: loadVitalsEntries(),
    mealTemplates: loadMealTemplates(),
    recipes: loadRecipes(),
    shoppingList: loadShoppingList(),
    mealPlan: loadMealPlan(),
    reminders: loadReminders(),
    nutritionSync: loadNutritionSync(),
  };
}

function prepareStorageForUser(userKey: AppUserKey) {
  configureStorageScope({ environment: STORAGE_NAMESPACE, userKey });
  claimLegacyDataForActiveScope();
  migrateIfNeeded();
  seedDemoDataIfEmpty();
  ensureTroyMealTemplates(userKey);
  ensureLocalModifiedBaseline();
}

const initialUser = loadCurrentUser();
if (initialUser) prepareStorageForUser(initialUser);

function App() {
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [currentUser, setCurrentUser] = useState<AppUserKey | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [targets, setTargets] = useState<NutritionTargets>(loadTargets);
  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>(loadFoodLog);
  const [savedFoods, setSavedFoods] = useState<FoodItem[]>(loadSavedFoods);
  const [foodDatabase, setFoodDatabase] = useState<FoodDatabaseItem[]>(loadFoodDatabase);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(loadWeightEntries);
  const [dailyActivity, setDailyActivity] = useState<DailyActivityEntry[]>(loadDailyActivity);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>(loadSleepEntries);
  const [vitalsEntries, setVitalsEntries] = useState<VitalsEntry[]>(loadVitalsEntries);
  const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>(loadMealTemplates);
  const [recipes, setRecipes] = useState<Recipe[]>(loadRecipes);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(loadShoppingList);
  const [mealPlan, setMealPlan] = useState<MealPlanEntry[]>(loadMealPlan);
  const [reminders, setReminders] = useState<ReminderSettings>(loadReminders);
  const [nutritionSync, setNutritionSync] = useState<NutritionSyncSettings>(loadNutritionSync);
  const [storageError, setStorageError] = useState('');
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => initialSyncStatus(Boolean(initialUser)));
  // Bumped whenever a bulk reload replaces the in-memory data wholesale (user
  // switch, backup import, or an incoming remote-sync bundle) - as opposed to a
  // normal single-field save via `persist`. Settings keeps its own local draft
  // state for the profile/targets/reminders forms, which would otherwise go
  // stale (or clobber a just-applied remote/import bundle on next Save) if the
  // screen stays mounted across one of these bulk reloads. Keying Settings on
  // this value forces it to remount and reseed its drafts from fresh props.
  const [dataVersion, setDataVersion] = useState(0);
  const currentUserRef = useRef(currentUser);
  const applyingRemoteRef = useRef(false);
  const remoteStampRef = useRef<string | null>(null);
  // Outbound writes are unsafe until the first remote read establishes whether
  // this is a fresh device that must hydrate or an existing device that may push.
  const remoteReadReadyRef = useRef(false);
  const pendingSyncRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const garminSyncInFlightRef = useRef(false);
  const lastGarminSyncAttemptRef = useRef(0);
  const nutritionPushInFlightRef = useRef(false);
  const profileRef = useRef(profile);
  const targetsRef = useRef(targets);
  const foodLogRef = useRef(foodLog);
  const savedFoodsRef = useRef(savedFoods);
  const foodDatabaseRef = useRef(foodDatabase);
  const weightEntriesRef = useRef(weightEntries);
  const dailyActivityRef = useRef(dailyActivity);
  const sleepEntriesRef = useRef(sleepEntries);
  const vitalsEntriesRef = useRef(vitalsEntries);
  const mealTemplatesRef = useRef(mealTemplates);
  const recipesRef = useRef(recipes);
  const shoppingListRef = useRef(shoppingList);
  const mealPlanRef = useRef(mealPlan);
  const remindersRef = useRef(reminders);
  const nutritionSyncRef = useRef(nutritionSync);

  const applyLoadedData = useCallback((data: ReturnType<typeof reloadAll>) => {
    setProfile(data.profile);
    setTargets(data.targets);
    setFoodLog(data.foodLog);
    setSavedFoods(data.savedFoods);
    setFoodDatabase(data.foodDatabase);
    setWeightEntries(data.weightEntries);
    setDailyActivity(data.dailyActivity);
    setSleepEntries(data.sleepEntries);
    setVitalsEntries(data.vitalsEntries);
    setMealTemplates(data.mealTemplates);
    setRecipes(data.recipes);
    setShoppingList(data.shoppingList);
    setMealPlan(data.mealPlan);
    setReminders(data.reminders);
    setNutritionSync(data.nutritionSync);
    profileRef.current = data.profile; targetsRef.current = data.targets; foodLogRef.current = data.foodLog;
    savedFoodsRef.current = data.savedFoods; foodDatabaseRef.current = data.foodDatabase; weightEntriesRef.current = data.weightEntries;
    dailyActivityRef.current = data.dailyActivity;
    sleepEntriesRef.current = data.sleepEntries;
    vitalsEntriesRef.current = data.vitalsEntries;
    mealTemplatesRef.current = data.mealTemplates; recipesRef.current = data.recipes;
    shoppingListRef.current = data.shoppingList; mealPlanRef.current = data.mealPlan; remindersRef.current = data.reminders;
    nutritionSyncRef.current = data.nutritionSync;
    setDataVersion((v) => v + 1);
  }, []);

  const syncNow = useCallback(async () => {
    const userKey = currentUserRef.current;
    if (!SYNC_ENABLED || !userKey || applyingRemoteRef.current) return;
    if (!remoteReadReadyRef.current) {
      pendingSyncRef.current = true;
      return;
    }

    pendingSyncRef.current = false;
    const bundle = exportAppData();
    setSyncStatus({ tone: 'syncing', text: 'Syncing' });
    const result = await saveRemoteAppData(userKey, bundle);
    remoteStampRef.current = bundle.exportedAt;
    setSyncStatus(result.queued
      ? { tone: 'queued', text: 'Queued' }
      : { tone: 'synced', text: 'Synced' });
  }, []);

  const scheduleSync = useCallback(() => {
    if (!SYNC_ENABLED || !currentUserRef.current || applyingRemoteRef.current) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      void syncNow();
    }, 350);
  }, [syncNow]);

  const activateUser = useCallback((userKey: AppUserKey) => {
    saveCurrentUser(userKey);
    prepareStorageForUser(userKey);
    currentUserRef.current = userKey;
    remoteStampRef.current = null;
    remoteReadReadyRef.current = false;
    pendingSyncRef.current = false;
    applyLoadedData(reloadAll());
    setCurrentUser(userKey);
    setStorageError('');
    setSyncStatus(initialSyncStatus(true));
  }, [applyLoadedData]);

  const switchUser = useCallback(() => {
    clearCurrentUser();
    configureStorageScope(null);
    currentUserRef.current = null;
    remoteStampRef.current = null;
    remoteReadReadyRef.current = false;
    pendingSyncRef.current = false;
    setCurrentUser(null);
    setSyncStatus({ tone: 'idle', text: 'Pick user' });
  }, []);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeLocalDataChanges(() => {
      // Writes made while applying a remote bundle are not user edits, so they
      // must not bump the local freshness marker or trigger a push-back.
      if (applyingRemoteRef.current) return;
      markLocalDataModified();
      scheduleSync();
    });
  }, [currentUser, scheduleSync]);

  useEffect(() => {
    return subscribeSyncQueue((state) => {
      if (state.pending > 0) setSyncStatus({ tone: state.error ? 'error' : 'queued', text: state.error ? 'Retrying' : 'Queued' });
    });
  }, []);

  useEffect(() => {
    if (!currentUser || !SYNC_ENABLED) return;

    let sawFirstRemoteRead = false;
    let consecutiveFailures = 0;
    // Use the state that existed when sync started for the first conflict
    // decision. A user edit made while the initial GET is in flight must not
    // make a genuinely fresh install overwrite a populated remote bundle.
    const initialLocalModifiedAt = getLocalDataModifiedAt();
    const initialLocalHasData = hasLocalUserData();
    remoteReadReadyRef.current = false;
    void initAuth();

    const applyRemoteBundle = (bundle: AppStateBundle) => {
      applyingRemoteRef.current = true;
      try {
        if (importAppData(bundle)) {
          applyLoadedData(reloadAll());
          remoteStampRef.current = bundle.exportedAt;
          // Local now equals the remote bundle, so anchor the freshness marker to
          // its stamp — later local edits will move past it and push back up.
          markLocalDataModified(bundle.exportedAt);
          setSyncStatus({ tone: 'synced', text: 'Synced' });
        }
      } finally {
        applyingRemoteRef.current = false;
      }
    };

    const stop = subscribeRemoteAppData(currentUser, (bundle) => {
      consecutiveFailures = 0; // a successful read means we're connected again
      const firstRead = !sawFirstRemoteRead;
      sawFirstRemoteRead = true;
      if (!bundle) {
        remoteReadReadyRef.current = true;
        // Remote is empty. On the first read, push local data up; on later reads
        // just confirm we're connected so a stale "Offline" can't stick.
        if (firstRead && (initialLocalHasData || pendingSyncRef.current || hasLocalUserData())) {
          void syncNow();
          return;
        }
        setSyncStatus((prev) => (prev.tone === 'synced' ? prev : { tone: 'synced', text: 'Synced' }));
        return;
      }
      if (bundle.exportedAt === remoteStampRef.current) {
        setSyncStatus({ tone: 'synced', text: 'Synced' });
        return;
      }
      // Only let the remote bundle replace local data when it is provably newer;
      // otherwise keep local (which is newer) and push it up so remote catches
      // up. This prevents an older remote read — on first poll, user switch,
      // reinstall, or queued-sync recovery — from clobbering newer local edits.
      const localModifiedAt = firstRead ? initialLocalModifiedAt : getLocalDataModifiedAt();
      const localHasData = firstRead ? initialLocalHasData : hasLocalUserData();
      if (remoteBundleShouldReplaceLocal(bundle.exportedAt, localModifiedAt, localHasData)) {
        applyRemoteBundle(bundle);
        pendingSyncRef.current = false;
        remoteReadReadyRef.current = true;
      } else {
        remoteStampRef.current = bundle.exportedAt;
        remoteReadReadyRef.current = true;
        void syncNow();
      }
    }, {
      // A single blip (cold-start auth/network hiccup) shouldn't flash a scary red
      // "Offline"; only surface it after repeated consecutive failures.
      onError: () => {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 2) setSyncStatus({ tone: 'error', text: 'Offline' });
      },
    });

    return () => {
      remoteReadReadyRef.current = false;
      stop();
    };
  }, [currentUser, applyLoadedData, syncNow]);

  const persist = useCallback(<T,>(
    next: T,
    ref: { current: T },
    setter: (value: T) => void,
    save: (value: T) => boolean,
  ): boolean => {
    if (!save(next)) {
      setStorageError('Your changes could not be saved. Check browser storage space or privacy settings, then try again.');
      return false;
    }
    ref.current = next;
    setter(next);
    setStorageError('');
    return true;
  }, []);

  const today = todayDateString();
  const todaySummary = summariseDay(today, foodLog);
  const recommendations = buildRecommendations(todaySummary, targets);
  // Last 7 days (including today) for the hint engine's "today vs repeated"
  // check — cheap to recompute since summariseDay is a simple in-memory scan.
  const recentSummaries = last7Days(today).map((date) => summariseDay(date, foodLog));

  // ── Nutrition → Health Connect (write) ──────────────────────────────────────
  // RepIQ reads Nutrition records from Health Connect. Sync v2 keeps one
  // replaceable record per logged day so edits/deletes cannot leave stale
  // macros behind. See lib/nutrition-hc-sync.ts for the aggregation rules.

  const pushNutritionToHealthConnect = useCallback(async (options: { requestPermissions: boolean; forceDates?: string[] }): Promise<string> => {
    if (nutritionPushInFlightRef.current) return 'Push already running.';
    nutritionPushInFlightRef.current = true;
    try {
      if (!(await healthConnectAvailable())) {
        return "Health Connect isn't available on this device.";
      }
      const permitted = await canReadGarminGroup(options.requestPermissions, ensureNutritionWritePermission, hasNutritionWritePermission);
      if (!permitted) {
        return options.requestPermissions ? 'Grant nutrition-write permission in Health Connect, then try again.' : '';
      }

      const importedAt = new Date().toISOString();
      const payloads = buildDailyNutritionPayloads(foodLogRef.current);
      const signatures = nutritionDaySignatures(payloads);
      const legacyRecords = nutritionSyncRef.current.schemaVersion < CURRENT_NUTRITION_SYNC_SCHEMA;
      const changedDates = legacyRecords
        ? Object.keys(signatures)
        : [...new Set([
          ...nutritionDaysNeedingSync(signatures, nutritionSyncRef.current.daySignatures),
          ...(options.forceDates ?? []),
        ])].sort();

      if (legacyRecords) {
        // v1 wrote an immutable record per food entry. That left corrected and
        // deleted foods behind and allowed force-resync to duplicate them. Clear
        // every Nutrition record written by this app once, then replace them
        // with one authoritative daily total per logged date.
        await deleteAllNutritionRecords();
      } else {
        for (const date of changedDates) await deleteNutritionRecordsForDate(date);
      }

      const changed = legacyRecords
        ? payloads
        : payloads.filter((payload) => changedDates.includes(nutritionPayloadDate(payload)));
      const written = await writeNutritionRecords(changed);
      const next: NutritionSyncSettings = {
        enabled: nutritionSyncRef.current.enabled,
        syncedEntryIds: [],
        lastSyncAt: importedAt,
        schemaVersion: CURRENT_NUTRITION_SYNC_SCHEMA,
        daySignatures: signatures,
      };
      persist(next, nutritionSyncRef, setNutritionSync, saveNutritionSync);

      if (!changedDates.length && !legacyRecords) {
        return summarizePush(0);
      }
      return legacyRecords
        ? `Replaced old Health Connect nutrition with ${written} corrected daily ${written === 1 ? 'total' : 'totals'}.`
        : `Updated ${changedDates.length} Health Connect ${changedDates.length === 1 ? 'day' : 'days'}.`;
    } catch (error) {
      if (!options.requestPermissions) return ''; // silent/auto path is best-effort
      throw error instanceof Error ? error : new Error('Could not push nutrition to Health Connect.');
    } finally {
      nutritionPushInFlightRef.current = false;
    }
  }, [persist]);

  const handleSyncNutritionToHealthConnect = useCallback((): Promise<string> => {
    return pushNutritionToHealthConnect({ requestPermissions: true });
  }, [pushNutritionToHealthConnect]);

  const handleToggleNutritionSyncEnabled = useCallback((enabled: boolean) => {
    persist({ ...nutritionSyncRef.current, enabled }, nutritionSyncRef, setNutritionSync, saveNutritionSync);
  }, [persist]);

  // Delete today's prior app-owned record first, then write the current daily
  // total. This now repairs edits/deletes as well as externally removed data.
  const handleForceResyncNutritionToday = useCallback((): Promise<string> => {
    return pushNutritionToHealthConnect({ requestPermissions: true, forceDates: [todayDateString()] });
  }, [pushNutritionToHealthConnect]);

  // Best-effort push right after a new entry is saved - silent, and only does
  // anything if write permission was already granted (never prompts mid-log).
  const autoPushNutrition = useCallback(() => {
    if (!nutritionSyncRef.current.enabled || !isHealthConnectSupported()) return;
    pushNutritionToHealthConnect({ requestPermissions: false }).catch(() => {
      // best-effort; the next Garmin sync and the manual Settings button still cover this.
    });
  }, [pushNutritionToHealthConnect]);

  // Upgrade the old append-only Health Connect records without waiting for a
  // manual Garmin sync. Existing permission is reused; this never prompts.
  useEffect(() => {
    if (!currentUser || !nutritionSync.enabled || nutritionSync.schemaVersion >= CURRENT_NUTRITION_SYNC_SCHEMA || !isHealthConnectSupported()) return;
    const timer = setTimeout(() => {
      void pushNutritionToHealthConnect({ requestPermissions: false });
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentUser, nutritionSync.enabled, nutritionSync.schemaVersion, pushNutritionToHealthConnect]);

  // Note: there's no separate periodic nutrition-push effect - "Sync Garmin"
  // (handleAutoSyncGarmin's effect, further below) now pushes nutrition as
  // part of every Garmin sync, manual or automatic, so a second scheduler
  // here would just be redundant. New entries still push immediately via
  // autoPushNutrition above; this only leaves periodic catch-up (e.g. entries
  // arriving via a remote-sync merge) to whenever Garmin next syncs.

  // ── Food log ───────────────────────────────────────────────────────────────

  const handleAddEntry = useCallback((entry: FoodLogEntry) => {
    const ok = persist([...foodLogRef.current, entry], foodLogRef, setFoodLog, saveFoodLog);
    if (ok) autoPushNutrition();
    return ok;
  }, [persist, autoPushNutrition]);

  const handleAddEntries = useCallback((entries: FoodLogEntry[]) => {
    const ok = persist([...foodLogRef.current, ...entries], foodLogRef, setFoodLog, saveFoodLog);
    if (ok) autoPushNutrition();
    return ok;
  }, [persist, autoPushNutrition]);

  const handleDeleteEntry = useCallback((id: string) => {
    const ok = persist(foodLogRef.current.filter((e) => e.id !== id), foodLogRef, setFoodLog, saveFoodLog);
    if (ok) autoPushNutrition();
    return ok;
  }, [persist, autoPushNutrition]);

  const handleEditEntry = useCallback((updated: FoodLogEntry) => {
    const ok = persist(foodLogRef.current.map((e) => e.id === updated.id ? updated : e), foodLogRef, setFoodLog, saveFoodLog);
    if (ok) autoPushNutrition();
    return ok;
  }, [persist, autoPushNutrition]);

  // ── Saved foods ────────────────────────────────────────────────────────────

  const handleSaveFood = useCallback((food: FoodItem) => {
    const current = savedFoodsRef.current;
    const exists = current.findIndex((f) => f.id === food.id);
    const next = exists >= 0 ? current.map((f) => f.id === food.id ? food : f) : [...current, food];
    if (!persist(next, savedFoodsRef, setSavedFoods, saveSavedFoods)) return false;
    const existingDbFood = food.barcode
      ? foodDatabaseRef.current.find((item) => item.barcode === food.barcode)
      : foodDatabaseRef.current.find((item) => item.name === food.name && item.servingSize === food.servingSize);
    const nextDatabase = upsertFoodDatabaseItem(foodDatabaseRef.current, savedFoodToFoodDatabaseItem(food, existingDbFood));
    return persist(nextDatabase, foodDatabaseRef, setFoodDatabase, saveFoodDatabase);
  }, [persist]);

  const handleSaveFoodDatabaseItem = useCallback((item: FoodDatabaseItem) => {
    const nextDatabase = upsertFoodDatabaseItem(foodDatabaseRef.current, item);
    return persist(nextDatabase, foodDatabaseRef, setFoodDatabase, saveFoodDatabase);
  }, [persist]);

  // Re-fetch nutrition for barcode entries logged with no calories (the Open Food
  // Facts v3 empty-nutriments bug). Each entry's serving size is preserved.
  const handleRepairScannedNutrition = useCallback(async (): Promise<RepairResult> => {
    const targets = foodLogRef.current.filter(entryNeedsNutritionRepair);
    if (targets.length === 0) return { ok: true, message: 'No scanned foods need fixing.' };
    const cache = new Map<string, BarcodeFood>();
    let fixed = 0;
    let failed = 0;
    let failReason = '';
    for (const entry of targets) {
      const code = entry.barcode as string;
      try {
        let food = cache.get(code);
        if (!food) {
          food = await lookupBarcodeFood(code);
          cache.set(code, food);
          handleSaveFoodDatabaseItem(barcodeFoodToFoodDatabaseItem(food));
        }
        handleEditEntry(applyBarcodeNutritionToEntry(entry, food));
        if (hasPositiveNutrition(food)) fixed += 1;
      } catch (error) {
        failed += 1;
        failReason = repairFailureMessage(error) || failReason;
      }
    }
    if (fixed === 0) {
      if (failed === 0) return { ok: false, message: 'The food database has no nutrition for those barcodes — edit the entries to fill it in manually.' };
      return { ok: false, message: failReason || 'Could not fetch nutrition — try again shortly.' };
    }
    return {
      ok: true,
      message: `Updated ${fixed} scanned food${fixed === 1 ? '' : 's'}${failed > 0 ? `; ${failed} could not be fetched` : ''}.`,
    };
  }, [handleEditEntry, handleSaveFoodDatabaseItem]);

  const handleDeleteSavedFood = useCallback((id: string) => {
    return persist(savedFoodsRef.current.filter((f) => f.id !== id), savedFoodsRef, setSavedFoods, saveSavedFoods);
  }, [persist]);

  const handleAddSavedFoodToLog = useCallback((food: FoodItem) => {
    const entry = savedFoodToLogEntry(food, today, 1, inferMealSlot());
    if (handleAddEntry(entry)) setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Profile / targets ──────────────────────────────────────────────────────

  const handleSaveProfile = useCallback((p: UserProfile) => persist(p, profileRef, setProfile, saveProfile), [persist]);
  const handleSaveTargets = useCallback((t: NutritionTargets) => persist(t, targetsRef, setTargets, saveTargets), [persist]);

  const handleSaveReminders = useCallback(async (r: ReminderSettings) => {
    if (!persist(r, remindersRef, setReminders, saveReminders)) {
      return { ok: false, native: false, permission: 'unsupported' as const, scheduled: 0, message: 'Reminder settings could not be saved.' };
    }
    return scheduleReminderNotifications(r);
  }, [persist]);

  // ── Weight ─────────────────────────────────────────────────────────────────

  const handleSaveWeightEntries = useCallback((entries: WeightEntry[]) => {
    return persist(entries, weightEntriesRef, setWeightEntries, saveWeightEntries);
  }, [persist]);

  const handleSaveDailyActivity = useCallback((entries: DailyActivityEntry[]) => {
    return persist(entries, dailyActivityRef, setDailyActivity, saveDailyActivity);
  }, [persist]);

  const handleSaveSleepEntries = useCallback((entries: SleepEntry[]) => {
    return persist(entries, sleepEntriesRef, setSleepEntries, saveSleepEntries);
  }, [persist]);

  const handleSaveVitalsEntries = useCallback((entries: VitalsEntry[]) => {
    return persist(entries, vitalsEntriesRef, setVitalsEntries, saveVitalsEntries);
  }, [persist]);

  // Garmin → Health Connect import (native Android only). One button, one
  // combined summary — each metric group is independently fault-tolerant so a
  // device missing one data type (e.g. no floors sensor) doesn't block the rest.
  const runGarminSync = useCallback(async (options: GarminSyncOptions = {}): Promise<string> => {
    if (garminSyncInFlightRef.current) return 'Garmin sync already running.';
    garminSyncInFlightRef.current = true;
    lastGarminSyncAttemptRef.current = Date.now();

    const days = options.days;
    const requestPermissions = options.requestPermissions ?? true;
    const activityParts: string[] = [];
    let weightMessage: string;

    try {
      if (!(await healthConnectAvailable())) {
        return "Health Connect isn't available on this device. Install it and connect Garmin Connect first.";
      }

      try {
        const canReadWeight = await canReadGarminGroup(requestPermissions, ensureWeightPermissions, hasWeightPermissions);
        if (canReadWeight) {
          const raw = await fetchWeightHistory(days);
          if (raw.length > 0) {
            const unit = profileRef.current.weightUnit;
            const readings = toGarminReadings(raw, unit);
            const result = mergeGarminReadings(weightEntriesRef.current, readings, unit, new Date().toISOString(), nanoid);
            if (!handleSaveWeightEntries(result.entries)) return 'Could not save the imported weight entries.';
            weightMessage = summarizeMerge(result);
          } else {
            weightMessage = 'No weight data found in Health Connect yet.';
          }
        } else {
          weightMessage = 'Weight permission is not granted yet.';
        }
      } catch (error) {
        weightMessage = error instanceof Error ? `Weight unavailable: ${error.message}` : 'Weight unavailable.';
      }

      try {
        const canReadSteps = await canReadGarminGroup(requestPermissions, ensureStepPermissions, hasStepPermissions);
        if (canReadSteps) {
          const stepReadings = toGarminStepReadings(await fetchStepHistory(days));
          if (stepReadings.length > 0) {
            const importedAt = new Date().toISOString();
            const stepResult = mergeGarminStepReadings(dailyActivityRef.current, stepReadings, importedAt, nanoid);
            if (!handleSaveDailyActivity(stepResult.entries)) return 'Could not save the imported step entries.';
            const stepSummary = summarizeStepMerge(stepResult);
            if (stepSummary) activityParts.push(stepSummary);
          } else {
            activityParts.push('no Garmin step records found');
          }
        } else if (requestPermissions) {
          activityParts.push('steps unavailable: permission not granted');
        }
      } catch (error) {
        activityParts.push(error instanceof Error ? `steps unavailable: ${error.message}` : 'steps unavailable');
      }

      try {
        const canReadActivityExtras = await canReadGarminGroup(
          requestPermissions,
          ensureActivityExtrasPermissions,
          hasActivityExtrasPermissions,
        );
        if (canReadActivityExtras) {
          const extras = toGarminActivityExtras(await fetchActivityExtrasHistory(days));
          if (extras.length > 0) {
            const importedAt = new Date().toISOString();
            const extrasResult = mergeGarminActivityExtras(dailyActivityRef.current, extras, importedAt, nanoid);
            if (!handleSaveDailyActivity(extrasResult.entries)) return 'Could not save the imported activity data.';
            const extrasSummary = summarizeActivityExtrasMerge(extrasResult);
            if (extrasSummary) activityParts.push(extrasSummary);
          }
        } else if (requestPermissions) {
          activityParts.push('activity data unavailable: permission not granted');
        }
      } catch (error) {
        activityParts.push(error instanceof Error ? `activity data unavailable: ${error.message}` : 'activity data unavailable');
      }

      try {
        const canReadSleep = await canReadGarminGroup(requestPermissions, ensureSleepPermissions, hasSleepPermissions);
        if (canReadSleep) {
          const sleepReadings = toGarminSleepReadings(await fetchSleepHistory(days));
          if (sleepReadings.length > 0) {
            const importedAt = new Date().toISOString();
            const sleepResult = mergeGarminSleepReadings(sleepEntriesRef.current, sleepReadings, importedAt, nanoid);
            if (!handleSaveSleepEntries(sleepResult.entries)) return 'Could not save the imported sleep entries.';
            const sleepSummary = summarizeSleepMerge(sleepResult);
            if (sleepSummary) activityParts.push(`sleep: ${sleepSummary}`);
          } else {
            activityParts.push('no Garmin sleep records found');
          }
        } else if (requestPermissions) {
          activityParts.push('sleep unavailable: permission not granted');
        }
      } catch (error) {
        activityParts.push(error instanceof Error ? `sleep unavailable: ${error.message}` : 'sleep unavailable');
      }

      try {
        const canReadVitals = await canReadGarminGroup(requestPermissions, ensureVitalsPermissions, hasVitalsPermissions);
        if (canReadVitals) {
          const vitalsReadings = toGarminVitalsReadings(await fetchVitalsHistory(days));
          if (vitalsReadings.length > 0) {
            const importedAt = new Date().toISOString();
            const vitalsResult = mergeGarminVitalsReadings(vitalsEntriesRef.current, vitalsReadings, importedAt, nanoid);
            if (!handleSaveVitalsEntries(vitalsResult.entries)) return 'Could not save the imported vitals.';
            const vitalsSummary = summarizeVitalsMerge(vitalsResult);
            if (vitalsSummary) activityParts.push(`vitals: ${vitalsSummary}`);
          }
        } else if (requestPermissions) {
          activityParts.push('vitals unavailable: permission not granted');
        }
      } catch (error) {
        activityParts.push(error instanceof Error ? `vitals unavailable: ${error.message}` : 'vitals unavailable');
      }

      // Push side: share the food log out to Health Connect too, so one sync
      // action covers both directions (pull Garmin data in, push nutrition out).
      try {
        const nutritionSummary = await pushNutritionToHealthConnect({ requestPermissions });
        if (nutritionSummary) activityParts.push(`nutrition: ${nutritionSummary.replace(/\.$/, '')}`);
      } catch (error) {
        activityParts.push(error instanceof Error ? `nutrition push failed: ${error.message}` : 'nutrition push failed');
      }

      const weightPart = weightMessage ? asSentence(weightMessage) : 'No weight data found in Health Connect yet.';
      return activityParts.length > 0 ? `${weightPart} Activity: ${activityParts.join('; ')}.` : weightPart;
    } finally {
      garminSyncInFlightRef.current = false;
    }
  }, [handleSaveDailyActivity, handleSaveSleepEntries, handleSaveVitalsEntries, handleSaveWeightEntries, pushNutritionToHealthConnect]);

  const handleSyncGarmin = useCallback((): Promise<string> => {
    return runGarminSync({ requestPermissions: true });
  }, [runGarminSync]);

  const hasGarminDataForAutoSync = useCallback(() => hasImportedGarminData({
    weightEntries: weightEntriesRef.current,
    dailyActivity: dailyActivityRef.current,
    sleepEntries: sleepEntriesRef.current,
    vitalsEntries: vitalsEntriesRef.current,
  }), []);

  const handleAutoSyncGarmin = useCallback(async () => {
    const now = Date.now();
    if (!shouldRunGarminAutoSync({
      currentUserPresent: Boolean(currentUserRef.current),
      healthConnectSupported: isHealthConnectSupported(),
      importedGarminData: hasGarminDataForAutoSync(),
      now,
      lastAttemptAt: lastGarminSyncAttemptRef.current,
    })) {
      return;
    }
    try {
      await runGarminSync({ days: GARMIN_AUTO_SYNC_HISTORY_DAYS, requestPermissions: false });
    } catch {
      // Auto-sync is best-effort; manual sync still surfaces detailed errors.
    }
  }, [hasGarminDataForAutoSync, runGarminSync]);

  useEffect(() => {
    if (!currentUser || !isHealthConnectSupported() || typeof document === 'undefined') return;

    let cancelled = false;
    let removeAppStateListener: (() => void) | undefined;
    const runIfActive = () => {
      if (cancelled || document.visibilityState === 'hidden') return;
      void handleAutoSyncGarmin();
    };

    const startupTimer = setTimeout(runIfActive, GARMIN_AUTO_SYNC_STARTUP_DELAY_MS);
    const interval = setInterval(runIfActive, GARMIN_AUTO_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', runIfActive);
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) runIfActive();
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
      } else {
        removeAppStateListener = () => { void handle.remove(); };
      }
    }).catch(() => {
      // The visibility listener and interval still cover native fallbacks.
    });

    return () => {
      cancelled = true;
      clearTimeout(startupTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', runIfActive);
      removeAppStateListener?.();
    };
  }, [currentUser, handleAutoSyncGarmin]);

  // ── Meal templates ─────────────────────────────────────────────────────────

  const handleSaveTemplate = useCallback((template: MealTemplate) => {
    const current = mealTemplatesRef.current;
    const exists = current.findIndex((t) => t.id === template.id);
    const next = exists >= 0 ? current.map((t) => t.id === template.id ? template : t) : [...current, template];
    return persist(next, mealTemplatesRef, setMealTemplates, saveMealTemplates);
  }, [persist]);

  const handleDeleteTemplate = useCallback((id: string) => {
    return persist(mealTemplatesRef.current.filter((t) => t.id !== id), mealTemplatesRef, setMealTemplates, saveMealTemplates);
  }, [persist]);

  const handleAddTemplateToLog = useCallback((template: MealTemplate, meal?: MealSlot) => {
    if (handleAddEntries(templateToLogEntries(template, today, 1, meal ?? template.mealType ?? inferMealSlot()))) setScreen('dashboard');
  }, [today, handleAddEntries]);

  // ── Recipes ────────────────────────────────────────────────────────────────

  const handleSaveRecipe = useCallback((recipe: Recipe) => {
    const current = recipesRef.current;
    const exists = current.findIndex((r) => r.id === recipe.id);
    const next = exists >= 0 ? current.map((r) => r.id === recipe.id ? recipe : r) : [...current, recipe];
    return persist(next, recipesRef, setRecipes, saveRecipes);
  }, [persist]);

  const handleDeleteRecipe = useCallback((id: string) => {
    return persist(recipesRef.current.filter((r) => r.id !== id), recipesRef, setRecipes, saveRecipes);
  }, [persist]);

  const handleAddRecipeToLog = useCallback((recipe: Recipe, servings: number) => {
    if (handleAddEntry(recipeToLogEntry(recipe, servings, today, inferMealSlot()))) setScreen('dashboard');
  }, [today, handleAddEntry]);

  // ── Meal plan ──────────────────────────────────────────────────────────────

  const handleSaveMealPlan = useCallback((plan: MealPlanEntry[]) => {
    return persist(plan, mealPlanRef, setMealPlan, saveMealPlan);
  }, [persist]);

  const handleConvertPlanToLog = useCallback((entries: MealPlanEntry[], nextPlan: MealPlanEntry[]) => {
    const logEntries: FoodLogEntry[] = entries.map((e) => ({
      id: nanoid(),
      date: e.date,
      source: 'plan' as const,
      name: e.name,
      servingSize: `${e.servings} serving(s)`,
      servingMultiplier: e.servings,
      calories: e.calories,
      proteinG: e.proteinG,
      fatG: e.fatG,
      totalCarbsG: e.totalCarbsG,
      fibreG: e.fibreG,
      sugarAlcoholsG: e.sugarAlcoholsG,
      sodiumMg: e.sodiumMg,
      potassiumMg: e.potassiumMg,
      magnesiumMg: e.magnesiumMg,
      ...pickMicronutrients(e),
      loggedAt: new Date().toISOString(),
    }));
    const nextLog = [...foodLogRef.current, ...logEntries];
    if (!saveFoodLogAndMealPlan(nextLog, nextPlan)) {
      setStorageError('The planned meals could not be logged. Nothing was changed; check browser storage and try again.');
      return false;
    }
    foodLogRef.current = nextLog; mealPlanRef.current = nextPlan;
    setFoodLog(nextLog); setMealPlan(nextPlan); setStorageError('');
    return true;
  }, []);

  // ── Import complete ────────────────────────────────────────────────────────

  const handleImportComplete = useCallback(() => {
    applyLoadedData(reloadAll());
  }, [applyLoadedData]);

  if (!currentUser) {
    return <UserPicker onPick={activateUser} />;
  }

  const user = APP_USERS[currentUser];

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Health Tracker</span>
        <div className="app-header-meta">
          <span className={`sync-pill sync-pill--${syncStatus.tone}`}>{syncStatus.text}</span>
          <button type="button" className="app-user" onClick={switchUser} title="Switch user">
            {profile.name ? `Hi, ${profile.name}` : user.label}
          </button>
        </div>
      </header>

      <main className="app-main">
        {storageError && <div className="storage-error" role="alert">{storageError}</div>}
        {screen === 'dashboard' && (
          <Dashboard
            summary={todaySummary}
            entries={foodLog.filter((entry) => entry.date === today)}
            activity={dailyActivity.find((entry) => entry.date === today) ?? [...dailyActivity].sort((a, b) => b.date.localeCompare(a.date))[0]}
            targets={targets}
            recommendations={recommendations}
            profile={profile}
            recentSummaries={recentSummaries}
            mealPlan={mealPlan}
            onAddFood={() => setScreen('barcode')}
            onSyncGarmin={isHealthConnectSupported() ? handleSyncGarmin : undefined}
          />
        )}
        {screen === 'add-food' && (
          <AddFood
            savedFoods={savedFoods}
            foodDatabase={foodDatabase}
            log={foodLog}
            recipes={recipes}
            templates={mealTemplates}
            onAdd={handleAddEntry}
            onAddEntries={handleAddEntries}
            onSaveFood={handleSaveFood}
            onSaveFoodDatabaseItem={handleSaveFoodDatabaseItem}
            onScanBarcode={() => setScreen('barcode')}
          />
        )}
        {screen === 'barcode' && (
          <BarcodeScanner
            foodDatabase={foodDatabase}
            savedFoods={savedFoods}
            onAdd={handleAddEntry}
            onSaveFood={handleSaveFood}
            onSaveFoodDatabaseItem={handleSaveFoodDatabaseItem}
            onAddManually={() => setScreen('add-food')}
            autoStart
          />
        )}
        {screen === 'daily-log' && (
          <DailyLog
            log={foodLog}
            savedFoods={savedFoods}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
            onDuplicate={(entry, targetDate) => handleAddEntry(duplicateLogEntry(entry, targetDate))}
            onSaveFood={handleSaveFood}
            onRepairScannedNutrition={handleRepairScannedNutrition}
            onAddFood={() => setScreen('barcode')}
          />
        )}
        {screen === 'progress' && (
          <Progress log={foodLog} targets={targets} />
        )}
        {screen === 'meals' && (
          <Meals
            templates={mealTemplates}
            savedFoods={savedFoods}
            foodDatabase={foodDatabase}
            onSave={handleSaveTemplate}
            onDelete={handleDeleteTemplate}
            onAddToLog={handleAddTemplateToLog}
          />
        )}
        {screen === 'recipes' && (
          <Recipes
            recipes={recipes}
            onSave={handleSaveRecipe}
            onDelete={handleDeleteRecipe}
            onAddToLog={handleAddRecipeToLog}
          />
        )}
        {screen === 'planner' && (
          <Planner
            plan={mealPlan}
            savedFoods={savedFoods}
            templates={mealTemplates}
            recipes={recipes}
            onSavePlan={handleSaveMealPlan}
            onConvertToLog={handleConvertPlanToLog}
          />
        )}
        {screen === 'weight' && (
          <Garmin
            entries={weightEntries}
            weightUnit={profile.weightUnit}
            dailyActivity={dailyActivity}
            sleepEntries={sleepEntries}
            vitalsEntries={vitalsEntries}
            caloriesEatenToday={todaySummary.calories}
            onSyncGarmin={isHealthConnectSupported() ? handleSyncGarmin : undefined}
          />
        )}
        {screen === 'settings' && (
          <Settings
            key={dataVersion}
            profile={profile}
            targets={targets}
            reminders={reminders}
            templates={mealTemplates}
            savedFoods={savedFoods}
            foodDatabase={foodDatabase}
            weightEntries={weightEntries}
            onSaveProfile={handleSaveProfile}
            onSaveTargets={handleSaveTargets}
            onSaveReminders={handleSaveReminders}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onAddTemplateToLog={handleAddTemplateToLog}
            onSaveFood={handleSaveFood}
            onDeleteSavedFood={handleDeleteSavedFood}
            onAddSavedFoodToLog={handleAddSavedFoodToLog}
            onImportComplete={handleImportComplete}
            nutritionSyncSupported={isHealthConnectSupported()}
            nutritionSyncEnabled={nutritionSync.enabled}
            nutritionSyncLastAt={nutritionSync.lastSyncAt}
            onToggleNutritionSync={handleToggleNutritionSyncEnabled}
            onSyncNutritionToHealthConnect={handleSyncNutritionToHealthConnect}
            onForceResyncNutritionToday={handleForceResyncNutritionToday}
          />
        )}
      </main>

      <Nav current={screen} onChange={setScreen} />
    </div>
  );
}

export default App;
