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

  const morning = state.reminders?.find(r => r.id === 'morning');
  if (morning) {
    document.getElementById('rem-morning-time').value = morning.time;
    document.getElementById('rem-morning-on').checked = morning.enabled;
  }
  const evening = state.reminders?.find(r => r.id === 'evening');
  if (evening) {
    document.getElementById('rem-evening-time').value = evening.time;
    document.getElementById('rem-evening-on').checked = evening.enabled;
  }

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
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const checkReminders = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    const morning = state.reminders?.find(r => r.id === 'morning');
    const evening = state.reminders?.find(r => r.id === 'evening');

    if (morning?.enabled && morning.time === timeStr && now.getSeconds() === 0) {
      new Notification("Morning check-in", { body: "Time to plan your day!" });
    }
    
    if (evening?.enabled && evening.time === timeStr && now.getSeconds() === 0) {
      new Notification("Evening reflection", { body: "How did today go?" });
    }
  };

  // Check every second to hit the 00 second mark exactly
  setInterval(checkReminders, 1000);
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
  document.getElementById('fp-submit').addEventListener('click', async () => {
    const email = document.getElementById('fp-email').value;
    if (!email) return showToast('Email required');
    try { await sendPasswordReset(email); showToast('Reset email sent'); document.getElementById('fp-email').value = ''; } 
    catch (err) { showToast(err.message); }
  });
  document.getElementById('acc-change-pass').addEventListener('click', () => showAuthView('change-pass'));
  document.getElementById('acc-signout').addEventListener('click', async () => {
    try {
      await signOut();
      clearLocalAndNotify();
    } catch (err) { showToast(err.message); }
  });
  document.getElementById('acc-delete').addEventListener('click', () => showAuthView('delete'));
  document.getElementById('cp-submit').addEventListener('click', async () => {
    const current = document.getElementById('cp-current').value;
    const newPass = document.getElementById('cp-new').value;
    const confirm = document.getElementById('cp-confirm').value;
    try {
      await changePassword(current, newPass, confirm);
      showToast('Password updated');
      showAuthView('account');
    } catch (err) { showToast(err.message); }
  });
  document.getElementById('del-submit').addEventListener('click', async () => {
    const pass = document.getElementById('del-pass').value;
    if (!pass) return showToast('Password required');
    try {
      const session = await getCurrentSession();
      if (session) await signIn(session.user.email, pass);
      await deleteAllUserData();
      clearLocalAndNotify();
    } catch (err) { showToast(err.message); }
  });

  document.getElementById('rem-morning-time').addEventListener('change', e => {
    updateReminder('morning', { time: e.target.value });
  });
  document.getElementById('rem-morning-on').addEventListener('change', e => {
    updateReminder('morning', { enabled: e.target.checked });
  });
  document.getElementById('rem-evening-time').addEventListener('change', e => {
    updateReminder('evening', { time: e.target.value });
  });
  document.getElementById('rem-evening-on').addEventListener('change', e => {
    updateReminder('evening', { enabled: e.target.checked });
  });
}

function bindWindowEvents() {
  window.addEventListener('app-toast', e => {
    showToast(typeof e.detail === 'string' ? e.detail : 'Something went wrong.');
  });
}

async function handleSignIn() {
  const emailInp = document.getElementById('si-email');
  const passInp = document.getElementById('si-pass');
  const btn = document.getElementById('si-submit');
  
  if (!emailInp.value || !passInp.value) return showToast('Email and password required');
  
  const originalText = btn.textContent;
  btn.textContent = 'Signing In...';
  btn.disabled = true;

  try {
    const authData = await signIn(emailInp.value, passInp.value);
    
    if (hasGuestData() && confirm('We found guest data on this device. Do you want to import it into your account? This will overwrite your cloud data.')) {
      const newState = await replaceAllUserDataFromLocal(state);
      Object.assign(state, newState);
    } else {
      const newState = await loadRemoteBootstrap();
      Object.assign(state, newState);
    }
    
    state.authMode = 'account';
    state.authView = 'account';
    saveLocalState();
    
    emailInp.value = '';
    passInp.value = '';
    showToast('Signed in successfully');
    window.location.reload();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

async function handleRegister() {
  const emailInp = document.getElementById('reg-email');
  const passInp = document.getElementById('reg-pass');
  const confirmInp = document.getElementById('reg-pass-confirm');
  const btn = document.getElementById('reg-submit');
  
  if (!emailInp.value || !passInp.value || !confirmInp.value) return showToast('All fields required');
  
  const originalText = btn.textContent;
  btn.textContent = 'Creating Account...';
  btn.disabled = true;

  try {
    await signUp(emailInp.value, passInp.value, confirmInp.value);
    
    if (hasGuestData()) {
      const newState = await replaceAllUserDataFromLocal(state);
      Object.assign(state, newState);
    }
    
    state.authMode = 'account';
    state.authView = 'account';
    saveLocalState();
    
    emailInp.value = '';
    passInp.value = '';
    confirmInp.value = '';
    showToast('Account created successfully');
    window.location.reload();
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
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

function updateReminder(id, patch) {
  if (!state.reminders) state.reminders = [];
  let rem = state.reminders.find(r => r.id === id);
  if (!rem) {
    rem = { id, enabled: false, time: id === 'morning' ? '08:00' : '21:00' };
    state.reminders.push(rem);
  }
  Object.assign(rem, patch);
  setState('reminders', state.reminders);
  touch();
  
  if (typeof Notification !== 'undefined' && Notification.permission !== 'granted' && patch.enabled) {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') scheduleReminders();
    });
  }
}

function touch() {
  setSaveState('saving', 'saving…');
  setTimeout(async () => {
    saveLocalState();
    
    if (state.authMode === 'account') {
      try {
        const currentEntry = getDay(state.db, state.currentDay);
        await upsertEntry(state.currentDay, currentEntry);
        setSaveState('saved', 'saved ✓');
      } catch (err) {
        console.error('Sync failed', err);
        setSaveState('error', 'sync error');
        showToast('Cloud sync failed');
      }
    } else {
      setSaveState('saved', 'saved ✓');
    }
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
