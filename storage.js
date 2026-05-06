// storage.js - LocalStorage and data templates
import { todayStr } from './utils.js';

const STORAGE_KEY = 'dt-v7';

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

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load local storage', e);
    return null;
  }
}

export function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      db: state.db,
      habits: state.habits,
      pinnedTasks: state.pinnedTasks,
      darkMode: state.darkMode,
      nextId: state.nextId,
      reminders: state.reminders,
    }));
  } catch (e) {
    console.warn('Failed to write local storage', e);
  }
}

export function clearLocalData() {
  localStorage.removeItem(STORAGE_KEY);
}
