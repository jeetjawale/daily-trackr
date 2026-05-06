// app.js - Main Entry Point
import { state, setState, setRenderFn } from './state.js';
import { todayStr, shiftDay, formatDay, esc } from './utils.js';
import { loadFromStorage, saveToStorage, getDay, clearLocalData } from './storage.js';
import { initFirebase, pushToCloud, pullFromCloud, signIn, register, sendPasswordReset, changePassword, signOut, deleteAccount, getAuth } from './firebase.js';
import { render, showToast, setSaveState, applyTheme, setView, updateSyncStatus, openSyncModal, closeSyncModal, showAuthView, updateNotifStatus } from './ui.js';

// --- Boot Sequence ---
function boot() {
  // 1. Load local data
  const saved = loadFromStorage();
  if (saved) {
    state.db = saved.db ?? {};
    state.habits = saved.habits ?? state.habits;
    state.pinnedTasks = saved.pinnedTasks ?? [];
    state.darkMode = saved.darkMode ?? false;
    state.nextId = saved.nextId ?? 100;
    state.reminders = saved.reminders ?? state.reminders;
  }

  // 2. Set render loop
  setRenderFn(render);

  // 3. Initial UI sync
  render();

  // 4. Firebase Init
  if (initFirebase()) {
    const auth = getAuth();
    auth.onAuthStateChanged(async user => {
      setState('fbUser', user);
      if (user) {
        setSaveState('syncing', 'syncing…');
        const pulled = await pullFromCloud();
        saveToStorage(state);
        render();
        setSaveState(pulled ? 'synced' : 'saved', pulled ? 'synced ✓' : 'saved ✓');
        if (!pulled) await pushToCloud();
      } else {
        render();
      }
    });
  } else {
    render();
  }

  updateSyncStatus();
  startClock();

  if (Notification.permission === 'granted') {
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

  // Auth listeners...
  document.getElementById('si-submit').addEventListener('click', handleSignIn);
  document.getElementById('reg-submit').addEventListener('click', handleRegister);
  // ... other auth listeners
}

async function handleSignIn() {
  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;
  try {
    await signIn(email, pass);
    closeSyncModal();
  } catch (e) {
    showToast(e.message);
  }
}

async function handleRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const conf  = document.getElementById('reg-pass-confirm').value;
  try {
    await register(email, pass, conf);
    closeSyncModal();
  } catch (e) {
    showToast(e.message);
  }
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
    saveToStorage(state);
    if (state.fbUser) {
      setSaveState('syncing', 'syncing…');
      await pushToCloud();
      setSaveState('synced', 'synced ✓');
    } else {
      setSaveState('saved', 'saved ✓');
    }
  }, 700);
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
  bindEvents();
});
