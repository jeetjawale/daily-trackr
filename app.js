// app.js - Main Entry Point
import { state, setState, setRenderFn } from './state.js';
import { todayStr, shiftDay } from './utils.js';
import { loadGuestState, saveGuestState, loadAccountCache, saveAccountCache, getDay, clearGuestState, clearAccountCache, hasGuestData } from './storage.js';
import { 
  initSupabase, 
  getCurrentSession, 
  signIn, 
  signUp, 
  signOut, 
  sendPasswordReset, 
  changePassword, 
  loadRemoteBootstrap, 
  upsertEntry, 
  replaceAllUserDataFromLocal, 
  deleteAllUserData 
} from './supabase.js';
import { render, showToast, setSaveState, applyTheme, setView, updateSyncStatus, openSyncModal, closeSyncModal, showAuthView } from './ui.js';

let syncConfigured = false;

function showUnsupportedSyncToast() {
  showToast(syncConfigured
    ? 'Sync wiring is present, but auth actions are not available yet in this build.'
    : 'Sync is not configured in this build.');
}

function clearLocalAndNotify() {
  clearGuestState();
  clearAccountCache();
  window.location.reload();
}

async function loadLocalState() {
  const accountCache = loadAccountCache();
  if (accountCache && syncConfigured) {
    try {
      const session = await getCurrentSession();
      if (session?.user) {
        state.authMode = 'account';
        return accountCache;
      }
    } catch (e) {
      console.warn('Failed to validate cached account session:', e);
    }
  }

  if (accountCache) {
    clearAccountCache();
  }

  state.authMode = 'guest';
  return loadGuestState();
}

function saveLocalState() {
  return state.authMode === 'account'
    ? saveAccountCache(state)
    : saveGuestState(state);
}

// --- Boot Sequence ---
async function boot() {
  syncConfigured = initSupabase();

  // 1. Load local data
  const saved = await loadLocalState();
  if (saved) {
    state.db = saved.db ?? {};
    state.habits = saved.habits ?? state.habits;
    state.pinnedTasks = saved.pinnedTasks ?? [];
    state.darkMode = saved.darkMode ?? false;
    state.nextId = saved.nextId ?? 100;
    state.reminders = saved.reminders ?? state.reminders;
    state.profile = saved.profile ?? state.profile;
  }

  // 2. Set render loop
  setRenderFn(render);

  // 3. Initial UI sync
  applyTheme();
  setSaveState(state.saveState, state.saveText);
  showAuthView(state.authView);
  render();

  updateSyncStatus();
  startClock();

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    scheduleReminders();
  }
}

// --- Clock & Reminders ---
function startClock() {
  setInterval(() => {
    const now = new Date();
    const el = document.getElementById('nav-clock');
    if (!el) return;
    if (state.currentDay !== todayStr()) { el.textContent = ''; return; }
    el.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  }, 1000);
}

function scheduleReminders() {
  // Migration of scheduleReminders logic from original app.js
  // uses state.reminders
}

// --- Event Bindings ---
function bindEvents() {
  document.getElementById('prev-btn').addEventListener('click', () => {
    const next = shiftDay(state.currentDay, -1);
    if (next <= todayStr()) setState('currentDay', next);
  });

  document.getElementById('next-btn').addEventListener('click', () => {
    const next = shiftDay(state.currentDay, 1);
    if (next <= todayStr()) setState('currentDay', next);
  });

  document.getElementById('copy-btn').addEventListener('click', copyYesterday);
  document.getElementById('dark-btn').addEventListener('click', () => setState('darkMode', !state.darkMode));
  document.getElementById('sync-btn').addEventListener('click', openSyncModal);

  document.querySelectorAll('.vt-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('add-task-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  document.getElementById('add-habit-btn').addEventListener('click', addHabit);
  document.getElementById('add-habit-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
  document.getElementById('add-pin-btn').addEventListener('click', addPinnedTask);
  document.getElementById('add-pin-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addPinnedTask(); });

  document.getElementById('emoji-pick-btn').addEventListener('click', () => {
    // logic for emoji picker
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeSyncModal);

  document.getElementById('si-to-forgot').addEventListener('click', () => showAuthView('forgot'));
  document.getElementById('si-to-register').addEventListener('click', () => showAuthView('register'));
  document.getElementById('auth-back-btn').addEventListener('click', () => {
    showAuthView(state.authMode === 'account' ? 'account' : 'signin');
  });
  document.getElementById('si-clear-local').addEventListener('click', clearLocalAndNotify);
  document.getElementById('acc-clear-local').addEventListener('click', clearLocalAndNotify);
  document.getElementById('si-submit').addEventListener('click', handleSignIn);
  document.getElementById('reg-submit').addEventListener('click', handleRegister);
  document.getElementById('fp-submit').addEventListener('click', showUnsupportedSyncToast);
  document.getElementById('acc-change-pass').addEventListener('click', () => showAuthView('change-pass'));
  document.getElementById('acc-signout').addEventListener('click', showUnsupportedSyncToast);
  document.getElementById('acc-delete').addEventListener('click', () => showAuthView('delete'));
  document.getElementById('cp-submit').addEventListener('click', showUnsupportedSyncToast);
  document.getElementById('del-submit').addEventListener('click', showUnsupportedSyncToast);
}

function bindWindowEvents() {
  window.addEventListener('app-toast', e => {
    showToast(typeof e.detail === 'string' ? e.detail : 'Something went wrong.');
  });
}

async function handleSignIn() {
  showUnsupportedSyncToast();
}

async function handleRegister() {
  showUnsupportedSyncToast();
}

function addTask() {
  const inp = document.getElementById('add-task-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  const d = getDay(state.db, state.currentDay);
  d.tasks.push({ text: txt, done: false });
  inp.value = '';
  setState('db', state.db);
  touch();
}

function addHabit() {
  const inp = document.getElementById('add-habit-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  state.habits.push({ id: 'h_' + (++state.nextId), icon: state.pickedEmoji, label: txt });
  inp.value = '';
  setState('habits', state.habits);
  touch();
}

function addPinnedTask() {
  const inp = document.getElementById('add-pin-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  state.pinnedTasks.push({ id: 'pin_' + (++state.nextId), text: txt });
  inp.value = '';
  setState('pinnedTasks', state.pinnedTasks);
  touch();
}

function copyYesterday() {
  const src = state.db[shiftDay(todayStr(), -1)];
  if (!src) { showToast('No data from yesterday.'); return; }
  const d = getDay(state.db, state.currentDay);
  const copied = (src.tasks ?? []).filter(t => t.text?.trim()).map(t => ({ text: t.text, done: false }));
  d.tasks = copied.length ? copied : [{ text: '', done: false }];
  d.meals = { ...(src.meals ?? {}) };
  d.goal = src.goal ?? '';
  setState('db', state.db);
  touch();
}

function touch() {
  setSaveState('saving', 'saving…');
  setTimeout(async () => {
    saveLocalState();
    setSaveState('saved', 'saved ✓');
  }, 700);
}

// --- Execution ---
let started = false;

async function startApp() {
  if (started) return;
  started = true;
  bindWindowEvents();
  bindEvents();
  await boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp, { once: true });
} else {
  startApp();
}
