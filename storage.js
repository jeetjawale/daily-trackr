// storage.js - LocalStorage and data templates
import { createAccountDataState, createGuestState } from './state.js';

const GUEST_STATE_KEY = 'dt-v7-guest-state';
const ACCOUNT_CACHE_KEY = 'dt-v7-account-cache';
const LEGACY_STORAGE_KEY = 'dt-v7';

export function blankDay() {
  return {
    slept: '', woke: '', goal: '',
    tasks: [{ text: '', done: false }],
    pinnedDone: {},
    meals: { breakfast: '', lunch: '', dinner: '', snacks: '' },
    habits: {}, notes: '', win: '', tmr: '',
  };
}

export function getDay(db, dateStr) {
  if (!db[dateStr])            db[dateStr] = blankDay();
  if (!db[dateStr].pinnedDone) db[dateStr].pinnedDone = {};
  return db[dateStr];
}

function readStorage(key, label) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Failed to load ${label}`, e);
    return null;
  }
}

function writeStorage(key, payload, label) {
  try {
    localStorage.setItem(key, JSON.stringify(payload));
    return localStorage.getItem(key) !== null;
  } catch (e) {
    console.warn(`Failed to write ${label}`, e);
    return false;
  }
}

function clearStorage(key, label) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Failed to clear ${label}`, e);
  }
}

function normalizeGuestState(savedState = {}) {
  const defaults = createGuestState();
  let reminders = savedState.reminders;
  if (!Array.isArray(reminders)) reminders = defaults.reminders;

  return {
    db: savedState.db ?? defaults.db,
    habits: savedState.habits ?? defaults.habits,
    pinnedTasks: savedState.pinnedTasks ?? defaults.pinnedTasks,
    darkMode: savedState.darkMode ?? defaults.darkMode,
    nextId: savedState.nextId ?? defaults.nextId,
    reminders,
  };
}

function normalizeAccountCache(savedState = {}) {
  const defaults = createAccountDataState();
  let reminders = savedState.reminders;
  if (!Array.isArray(reminders)) reminders = defaults.reminders;

  return {
    habits: savedState.habits ?? defaults.habits,
    pinnedTasks: savedState.pinnedTasks ?? defaults.pinnedTasks,
    db: savedState.db ?? defaults.db,
    profile: savedState.profile ?? defaults.profile,
    darkMode: savedState.darkMode ?? defaults.darkMode,
    nextId: savedState.nextId ?? defaults.nextId,
    reminders,
  };
}

export function loadGuestState() {
  const savedState = readStorage(GUEST_STATE_KEY, 'guest state');
  if (savedState) {
    return normalizeGuestState(savedState);
  }

  const legacyState = readStorage(LEGACY_STORAGE_KEY, 'legacy guest state');
  if (!legacyState) {
    return null;
  }

  const guestState = normalizeGuestState(legacyState);
  const migrated = saveGuestState(guestState);
  if (migrated && readStorage(GUEST_STATE_KEY, 'guest state')) {
    clearStorage(LEGACY_STORAGE_KEY, 'legacy guest state');
  }
  return guestState;
}

export function saveGuestState(state) {
  return writeStorage(GUEST_STATE_KEY, normalizeGuestState(state), 'guest state');
}

export function clearGuestState() {
  clearStorage(GUEST_STATE_KEY, 'guest state');
  clearStorage(LEGACY_STORAGE_KEY, 'legacy guest state');
}

export function loadAccountCache() {
  const savedState = readStorage(ACCOUNT_CACHE_KEY, 'account cache');
  if (!savedState) {
    return null;
  }

  return normalizeAccountCache(savedState);
}

export function saveAccountCache(state) {
  return writeStorage(ACCOUNT_CACHE_KEY, normalizeAccountCache(state), 'account cache');
}

export function clearAccountCache() {
  clearStorage(ACCOUNT_CACHE_KEY, 'account cache');
}

export function hasGuestData() {
  return Boolean(loadGuestState());
}

export function exportGuestPayload(source = loadGuestState()) {
  if (!source) {
    return {
      habits: [],
      pinnedTasks: [],
      db: {},
    };
  }

  const guestState = normalizeGuestState(source);
  return {
    habits: guestState.habits,
    pinnedTasks: guestState.pinnedTasks,
    db: guestState.db,
  };
}
