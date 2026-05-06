// state.js - Centralized state management
import { todayStr } from './utils.js';

const DEFAULT_HABITS = [
  { id: 'study',   icon: '📚', label: 'Studied' },
  { id: 'workout', icon: '💪', label: 'Worked out' },
  { id: 'walk',    icon: '🚶', label: 'Walked' },
  { id: 'water',   icon: '💧', label: 'Drank enough water' },
  { id: 'sleep',   icon: '😴', label: 'Slept okay' },
];

export const state = {
  currentDay: todayStr(),
  db: {},
  habits: structuredClone(DEFAULT_HABITS),
  pinnedTasks: [],
  darkMode: false,
  activeView: 'day',
  pickedEmoji: '⭐',
  nextId: 100,
  reminders: { morningOn: false, morningTime: '08:00', eveningOn: false, eveningTime: '21:00' },
  fbUser: null,
  isSyncing: false,
  authView: 'signin'
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
