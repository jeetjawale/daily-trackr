// state.js - Centralized state management
import { todayStr } from './utils.js';

const DEFAULT_HABITS = [];

const DEFAULT_REMINDERS = [
  { id: 'morning', enabled: false, time: '08:00' },
  { id: 'evening', enabled: false, time: '21:00' },
];

const DEFAULT_PROFILE = {
  initialized: false,
};

export function createGuestState() {
  return {
    db: {},
    habits: structuredClone(DEFAULT_HABITS),
    pinnedTasks: [],
    darkMode: window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches,
    nextId: 100,
    reminders: structuredClone(DEFAULT_REMINDERS),
  };
}

export function createAccountDataState() {
  return {
    habits: [],
    pinnedTasks: [],
    db: {},
    profile: structuredClone(DEFAULT_PROFILE),
    darkMode: false,
    nextId: 100,
    reminders: structuredClone(DEFAULT_REMINDERS),
  };
}

export const state = {
  currentDay: todayStr(),
  ...createGuestState(),
  profile: structuredClone(DEFAULT_PROFILE),
  activeView: 'day',
  pickedEmoji: '⭐',
  authView: 'signin',
  authMode: 'guest',
  saveState: 'saved',
  saveText: 'saved ✓',
  toastMessage: '',
  toastVisible: false,
  importPromptOpen: false,
  pendingImportDecision: false,
  supabaseUser: null,
  isSyncing: false,
  syncModalOpen: false,
};

let renderFn = null;

export function setRenderFn(fn) {
  renderFn = fn;
}

export function setState(key, value) {
  state[key] = value;
  if (renderFn) {
    renderFn(key);
  }
}

export function getState() {
  return state;
}
