// ui.js - Minimal DOM UI boundary for app boot
import { state } from './state.js';
import { formatDay, todayStr, esc } from './utils.js';

let toastTimer = null;

function byId(id) {
  return document.getElementById(id);
}

function updateHTML(el, html) {
  if (el && el.innerHTML !== html) {
    el.innerHTML = html;
  }
}

function getCurrentUser() {
  return state.supabaseUser ?? state.fbUser;
}

function ensureToastEl() {
  let el = byId('app-toast');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'app-toast';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

export function render() {
  const navDay = byId('nav-day');
  if (navDay) {
    navDay.textContent = formatDay(state.currentDay);
  }

  const todayPill = byId('today-pill');
  if (todayPill) {
    todayPill.hidden = state.currentDay !== todayStr();
  }

  applyTheme();
  setSaveState(state.saveState, state.saveText);
  setView(state.activeView, false);
  updateSyncStatus();
  showAuthView(getCurrentUser() ? 'account' : state.authView);
  updateNotifStatus();

  // Render Day View Data
  const day = state.db[state.currentDay] || { tasks: [], habits: {}, pinnedDone: {} };
  
  // Render Tasks
  const tasksList = byId('tasks-list');
  if (tasksList) {
    updateHTML(tasksList, (day.tasks || []).map((t, i) => `
      <div class="task-row">
        <div class="chk ${t.done ? 'on' : ''}" onclick="window.toggleTask(${i})">✓</div>
        <input type="text" class="task-inp ${t.done ? 'done' : ''}" value="${esc(t.text)}" onchange="window.editTask(${i}, this.value)">
        <button class="task-del" onclick="window.deleteTask(${i})">×</button>
      </div>
    `).join(''));
  }

  // Render Pinned Tasks
  const pinnedList = byId('pinned-list');
  if (pinnedList) {
    updateHTML(pinnedList, (state.pinnedTasks || []).map(t => `
      <div class="pinned-row">
        <div class="pin-chk ${day.pinnedDone?.[t.id] ? 'on' : ''}" onclick="window.togglePinnedTask('${t.id}')">✓</div>
        <div class="pin-txt ${day.pinnedDone?.[t.id] ? 'done' : ''}">${esc(t.text)}</div>
        <button class="pin-del" onclick="window.deletePinnedTask('${t.id}')">×</button>
      </div>
    `).join(''));
  }

  // Render Habits
  const habitsList = byId('habits-list');
  if (habitsList) {
    updateHTML(habitsList, (state.habits || []).map(h => `
      <div class="habit-row" onclick="window.toggleHabit('${h.id}')">
        <div class="h-ico">${h.icon}</div>
        <div class="h-lbl ${day.habits?.[h.id] ? 'on' : ''}">${esc(h.label)}</div>
        <button class="habit-del" onclick="event.stopPropagation(); window.deleteHabit('${h.id}')">×</button>
      </div>
    `).join(''));
  }

  // Update Score Strip
  updateScoreStrip(day);

  const modal = byId('sync-modal');
  if (modal) {
    modal.classList.toggle('hidden', !state.syncModalOpen);
  }
}

function updateScoreStrip(day) {
  const tasks = day.tasks || [];
  const pinned = state.pinnedTasks || [];
  const habits = state.habits || [];

  const tDone = tasks.filter(t => t.done).length;
  const pDone = pinned.filter(t => day.pinnedDone?.[t.id]).length;
  const hDone = habits.filter(h => day.habits?.[h.id]).length;

  const total = tasks.length + pinned.length + habits.length;
  const done = tDone + pDone + hDone;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const scPct = byId('sc-pct');
  if (scPct) scPct.textContent = total === 0 ? '—' : pct + '%';
  
  const scT = byId('sc-t');
  if (scT) scT.textContent = `${tDone + pDone}/${tasks.length + pinned.length}`;
  
  const scH = byId('sc-h');
  if (scH) scH.textContent = `${hDone}/${habits.length}`;
}


export function showToast(message) {
  const toast = ensureToastEl();

  state.toastMessage = message;
  state.toastVisible = Boolean(message);
  toast.textContent = message;
  toast.classList.toggle('show', state.toastVisible);

  if (toastTimer) {
    clearTimeout(toastTimer);
  }

  if (!state.toastVisible) return;

  toastTimer = setTimeout(() => {
    state.toastMessage = '';
    state.toastVisible = false;
    toast.classList.remove('show');
  }, 2200);
}

export function setSaveState(nextState, text = nextState) {
  state.saveState = nextState;
  state.saveText = text;

  const saveInd = byId('save-ind');
  const saveTxt = byId('save-txt');
  const syncDot = byId('sync-dot');

  if (saveInd) {
    saveInd.className = `save-ind ${nextState}`;
  }
  if (saveTxt) {
    saveTxt.textContent = text;
  }
  if (syncDot) {
    syncDot.classList.toggle('pulse', nextState === 'saving' || nextState === 'syncing');
  }
}

export function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');

  const darkBtn = byId('dark-btn');
  if (darkBtn) {
    darkBtn.textContent = state.darkMode ? '🌙' : '☀️';
  }
}

export function setView(view, shouldRender = true) {
  state.activeView = view;
  const isDayView = view === 'day';

  const sections = [
    ['day', byId('day-view')],
    ['week', byId('week-view')],
    ['trends', byId('trends-view')],
  ];

  sections.forEach(([name, el]) => {
    if (!el) return;
    if (name === 'day') {
      el.classList.toggle('hidden', view !== 'day');
      return;
    }
    el.classList.toggle('active', view === name);
  });

  document.querySelectorAll('.vt-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  const copyBtn = byId('copy-btn');
  if (copyBtn) {
    copyBtn.classList.toggle('hidden', !isDayView);
  }

  if (shouldRender) {
    render();
  }
}

export function updateSyncStatus() {
  const syncStatus = byId('sync-status-display');
  const authMsg = byId('auth-msg');
  const user = getCurrentUser();

  state.authMode = user ? 'account' : 'guest';

  if (syncStatus) {
    syncStatus.textContent = user
      ? `Signed in as ${user.email ?? 'account'}`
      : 'Using this device only. Sign in to sync.';
  }

  if (authMsg) {
    authMsg.textContent = user ? 'Cloud sync is available.' : 'You can keep using the app as a guest.';
  }
}

export function openSyncModal() {
  state.syncModalOpen = true;
  updateSyncStatus();
  showAuthView(getCurrentUser() ? 'account' : state.authView);

  const modal = byId('sync-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

export function closeSyncModal() {
  state.syncModalOpen = false;

  const modal = byId('sync-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

export function showAuthView(view = state.authView) {
  state.authView = view;

  ['signin', 'register', 'forgot', 'account', 'change-pass', 'delete'].forEach(name => {
    const panel = byId(`auth-view-${name}`);
    if (panel) {
      panel.classList.toggle('hidden', name !== view);
    }
  });

  const backBtn = byId('auth-back-btn');
  if (backBtn) {
    backBtn.classList.toggle('hidden', view === 'signin' || view === 'account');
  }

  const accountEmail = byId('account-email');
  if (accountEmail) {
    accountEmail.textContent = getCurrentUser()?.email ?? '';
  }
}

export function updateNotifStatus() {
  const notifStatus = byId('notif-status');
  if (!notifStatus || typeof Notification === 'undefined') return;

  notifStatus.classList.remove('ok', 'warn');
  if (Notification.permission === 'granted') {
    notifStatus.textContent = 'Notifications are enabled.';
    notifStatus.classList.add('ok');
    return;
  }

  notifStatus.textContent = 'Notifications are off.';
  notifStatus.classList.add('warn');
}
