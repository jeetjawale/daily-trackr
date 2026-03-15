// Daily Tracker — app.js

// ─── Config ────────────────────────────────────────────────

const DEFAULT_HABITS = [
  { id: 'study',   icon: '📚', label: 'Studied' },
  { id: 'workout', icon: '💪', label: 'Worked out' },
  { id: 'walk',    icon: '🚶', label: 'Walked' },
  { id: 'water',   icon: '💧', label: 'Drank enough water' },
  { id: 'sleep',   icon: '😴', label: 'Slept okay' },
];

const EMOJI_OPTIONS = [
  '⭐','🎯','📚','💪','🚶','💧','😴','🥦','🧘','✍️',
  '🎨','🎵','🏃','🛏','🧹','💊','🧠','❤️','🌿','☀️',
  '🍎','💼','🔥','✅',
];

const STORAGE_KEY = 'dt-v7';

// Firebase config injected at build time — see build.js and netlify.toml
const FIREBASE_CONFIG = window.FIREBASE_CONFIG || null;


// ─── App state ─────────────────────────────────────────────

let currentDay  = todayStr();
let db          = {};
let habits      = structuredClone(DEFAULT_HABITS);
let pinnedTasks = [];
let darkMode    = false;
let activeView  = 'day';
let pickedEmoji = '⭐';
let nextId      = 100;
let reminders   = { morningOn: false, morningTime: '08:00', eveningOn: false, eveningTime: '21:00' };

// Firebase
let fbApp  = null;
let fbAuth = null;
let fbDb   = null;
let fbUser = null;

// Charts
let scoreChart = null;
let sleepChart = null;
let habitChart = null;

// Reminder timers
let remTimers = [];


// ─── Date helpers ──────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDay(dateStr) {
  const diff = Math.round(
    (new Date(dateStr + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 86400000
  );
  if (diff === 0)  return 'Today';
  if (diff === -1) return 'Yesterday';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short',
  });
}

function getLast30() {
  return Array.from({ length: 30 }, (_, i) => shiftDay(todayStr(), i - 29));
}

function getWeekDates(dateStr) {
  const dt  = new Date(dateStr + 'T12:00:00');
  const mon = new Date(dt);
  mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}


// ─── Storage ───────────────────────────────────────────────

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    db          = saved.db          ?? {};
    habits      = saved.habits      ?? structuredClone(DEFAULT_HABITS);
    pinnedTasks = saved.pinnedTasks ?? [];
    darkMode    = saved.darkMode    ?? false;
    nextId      = saved.nextId      ?? 100;
    reminders   = saved.reminders   ?? reminders;
  } catch (e) {
    console.warn('Failed to load local storage', e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      db, habits, pinnedTasks, darkMode, nextId, reminders,
    }));
  } catch (e) {
    console.warn('Failed to write local storage', e);
  }
}

function blankDay() {
  return {
    slept: '', woke: '', goal: '',
    tasks: [{ text: '', done: false }],
    pinnedDone: {},
    meals: { breakfast: '', lunch: '', dinner: '', snacks: '' },
    habits: {}, notes: '', win: '', tmr: '',
  };
}

function getDay(dateStr) {
  if (!db[dateStr])            db[dateStr] = blankDay();
  if (!db[dateStr].pinnedDone) db[dateStr].pinnedDone = {};
  return db[dateStr];
}


// ─── Firebase auth & sync ──────────────────────────────────

function initFirebase() {
  if (!FIREBASE_CONFIG) return false;
  try {
    fbApp  = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth(fbApp);
    fbDb   = firebase.database(fbApp);
    return true;
  } catch (e) {
    fbApp  = firebase.app();
    fbAuth = firebase.auth();
    fbDb   = firebase.database();
    return true;
  }
}

async function pushToCloud() {
  if (!fbDb || !fbUser) return;
  try {
    await fbDb.ref('users/' + fbUser.uid + '/tracker').set({
      db, habits, pinnedTasks, nextId, reminders,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firebase push failed:', e);
  }
}

async function pullFromCloud() {
  if (!fbDb || !fbUser) return false;
  try {
    const snap = await fbDb.ref('users/' + fbUser.uid + '/tracker').get();
    if (!snap.exists()) return false;
    const d     = snap.val();
    db          = d.db          ?? db;
    habits      = d.habits      ?? habits;
    pinnedTasks = d.pinnedTasks ?? pinnedTasks;
    nextId      = d.nextId      ?? nextId;
    reminders   = d.reminders   ?? reminders;
    return true;
  } catch (e) {
    console.warn('Firebase pull failed:', e);
    return false;
  }
}


// ─── Save indicator ────────────────────────────────────────

let saveTimer = null;

function setSaveState(state, label) {
  const el  = document.getElementById('save-ind');
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('save-txt');
  el.className    = 'save-ind ' + state;
  txt.textContent = label;
  dot.className   = 'sync-dot' + (state === 'syncing' ? ' pulse' : '');
  if (state === 'saved' || state === 'synced') {
    setTimeout(() => { el.className = 'save-ind'; }, 2500);
  }
}

function touch() {
  setSaveState('saving', 'saving…');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    saveToStorage();
    if (fbUser) {
      setSaveState('syncing', 'syncing…');
      await pushToCloud();
      setSaveState('synced', 'synced ✓');
    } else {
      setSaveState('saved', 'saved ✓');
    }
  }, 700);
}


// ─── Dark mode ─────────────────────────────────────────────

function applyTheme() {
  document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  document.getElementById('dark-btn').textContent = darkMode ? '🌙' : '☀️';
}

function toggleDark() {
  darkMode = !darkMode;
  applyTheme();
  touch();
}


// ─── View switching ────────────────────────────────────────

function setView(name) {
  activeView = name;
  ['day', 'week', 'trends'].forEach(v => {
    document.getElementById('vt-' + v).classList.toggle('active', v === name);
  });
  document.getElementById('day-view').classList.toggle('hidden', name !== 'day');
  document.getElementById('week-view').classList.toggle('active', name === 'week');
  document.getElementById('trends-view').classList.toggle('active', name === 'trends');
  const isToday = currentDay === todayStr();
  document.getElementById('copy-btn').style.display = (name === 'day' && isToday) ? '' : 'none';
  if (name === 'week')   renderWeek();
  if (name === 'trends') { renderTrends(); applyReminderUI(); }
}


// ─── Score calculation ─────────────────────────────────────

function calcScore(dateStr) {
  const d = db[dateStr];
  if (!d) return 0;
  const habitsDone  = habits.filter(h => d.habits?.[h.id]).length;
  const tasks       = d.tasks ?? [];
  const tasksFilled = tasks.filter(t => t.text?.trim()).length;
  const tasksDone   = tasks.filter(t => t.text?.trim() && t.done).length;
  const pinnedDone  = pinnedTasks.filter(p => d.pinnedDone?.[p.id]).length;
  const denom = habits.length + (tasksFilled || 0) + pinnedTasks.length;
  return denom > 0 ? Math.round((habitsDone + tasksDone + pinnedDone) / denom * 100) : 0;
}

function hasData(dateStr) {
  const d = db[dateStr];
  if (!d) return false;
  const hasTasks   = (d.tasks ?? []).some(t => t.text?.trim());
  const hasHabits  = habits.some(h => d.habits?.[h.id]);
  const hasSleep   = d.slept?.trim() || d.woke?.trim();
  const hasMeals   = Object.values(d.meals ?? {}).some(v => v?.trim());
  const hasContent = d.goal?.trim() || d.notes?.trim() || d.win?.trim() || d.tmr?.trim();
  return !!(hasTasks || hasHabits || hasSleep || hasMeals || hasContent);
}


// ─── Day render ────────────────────────────────────────────

function render() {
  const d       = getDay(currentDay);
  const isToday = currentDay === todayStr();
  document.getElementById('nav-day').textContent   = formatDay(currentDay);
  document.getElementById('today-pill').hidden      = !isToday;
  document.getElementById('copy-btn').style.display = (isToday && activeView === 'day') ? '' : 'none';
  document.getElementById('slept').value     = d.slept ?? '';
  document.getElementById('woke').value      = d.woke  ?? '';
  document.getElementById('main-goal').value = d.goal  ?? '';
  document.getElementById('eod-win').value   = d.win   ?? '';
  document.getElementById('eod-tmr').value   = d.tmr   ?? '';
  document.getElementById('notes-ta').value  = d.notes ?? '';
  renderSleepDuration();
  renderPinned();
  renderTasks();
  renderMeals();
  renderHabits();
  updateScoreStrip();
  wireInputs();
}


// ─── Pinned tasks ──────────────────────────────────────────

function renderPinned() {
  const d   = getDay(currentDay);
  const sec = document.getElementById('pinned-section');
  sec.style.display = pinnedTasks.length ? '' : 'none';
  if (!pinnedTasks.length) return;
  document.getElementById('pinned-list').innerHTML = pinnedTasks.map((p, i) => {
    const checked = !!d.pinnedDone[p.id];
    const sep = i < pinnedTasks.length - 1
      ? '<div style="height:1px;background:var(--pin-border);margin:0 var(--cp)"></div>' : '';
    return `
      <div class="pinned-row">
        <div class="pin-chk ${checked ? 'on' : ''}" data-pin="${p.id}">${checked ? '✓' : ''}</div>
        <span class="pin-txt ${checked ? 'done' : ''}">${esc(p.text)}</span>
        <span class="pin-badge">daily</span>
        <button class="pin-del" data-pin-del="${p.id}">×</button>
      </div>${sep}`;
  }).join('');
  document.querySelectorAll('[data-pin]').forEach(el => {
    el.addEventListener('click', () => togglePinned(el.dataset.pin));
  });
  document.querySelectorAll('[data-pin-del]').forEach(el => {
    el.addEventListener('click', () => deletePinned(el.dataset.pinDel));
  });
}

function togglePinned(id) {
  const d = getDay(currentDay);
  d.pinnedDone[id] = !d.pinnedDone[id];
  touch(); renderPinned(); updateScoreStrip();
}

function addPinnedTask() {
  const inp = document.getElementById('add-pin-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  pinnedTasks.push({ id: 'pin_' + (++nextId), text: txt });
  inp.value = '';
  touch(); renderPinned(); updateScoreStrip();
}

function deletePinned(id) {
  pinnedTasks = pinnedTasks.filter(p => p.id !== id);
  touch(); renderPinned(); updateScoreStrip();
}


// ─── Tasks ─────────────────────────────────────────────────

function renderTasks() {
  const d = getDay(currentDay);
  if (!d.tasks?.length) d.tasks = [{ text: '', done: false }];
  const list = document.getElementById('tasks-list');
  list.innerHTML = d.tasks.map((t, i) => `
    <div class="task-row">
      <div class="chk ${t.done ? 'on' : ''}" data-ti="${i}">${t.done ? '✓' : ''}</div>
      <input class="task-inp ${t.done ? 'done' : ''}" data-ti="${i}"
        placeholder="Task…" value="${esc(t.text ?? '')}" />
      <button class="task-del" data-di="${i}">×</button>
    </div>
    ${i < d.tasks.length - 1 ? '<div class="divider"></div>' : ''}
  `).join('');
  list.querySelectorAll('.chk[data-ti]').forEach(el => {
    el.addEventListener('click', () => {
      collectTaskText();
      getDay(currentDay).tasks[+el.dataset.ti].done ^= true;
      touch(); renderTasks(); updateScoreStrip();
    });
  });
  list.querySelectorAll('.task-inp[data-ti]').forEach(el => {
    el.addEventListener('input', () => {
      getDay(currentDay).tasks[+el.dataset.ti].text = el.value;
      touch(); updateScoreStrip();
    });
  });
  list.querySelectorAll('.task-del[data-di]').forEach(el => {
    el.addEventListener('click', () => {
      collectTaskText();
      const tasks = getDay(currentDay).tasks;
      if (tasks.length <= 1) tasks[0] = { text: '', done: false };
      else tasks.splice(+el.dataset.di, 1);
      touch(); renderTasks(); updateScoreStrip();
    });
  });
}

function collectTaskText() {
  document.querySelectorAll('.task-inp[data-ti]').forEach(el => {
    const tasks = getDay(currentDay).tasks;
    if (tasks[+el.dataset.ti] !== undefined) tasks[+el.dataset.ti].text = el.value;
  });
}

function addTask() {
  const inp = document.getElementById('add-task-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  collectTaskText();
  getDay(currentDay).tasks.push({ text: txt, done: false });
  inp.value = '';
  touch(); renderTasks(); updateScoreStrip();
  const rows = document.querySelectorAll('.task-inp[data-ti]');
  if (rows.length) rows[rows.length - 1].focus();
}


// ─── Meals ─────────────────────────────────────────────────

function renderMeals() {
  const d = getDay(currentDay);
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(m => {
    document.getElementById('m-' + m).value = d.meals[m] ?? '';
  });
}


// ─── Habits ────────────────────────────────────────────────

function renderHabits() {
  const d = getDay(currentDay);
  document.getElementById('habits-list').innerHTML = habits.map((h, i) => {
    const checked = !!d.habits[h.id];
    const s       = calcStreak(h.id);
    const streak  = s > 0
      ? `<span class="streak ${s >= 3 ? 'hot' : ''}">${s >= 3 ? '🔥 ' : ''}${s}d</span>` : '';
    const sep = i < habits.length - 1 ? '<div class="divider"></div>' : '';
    return `
      <div class="habit-row" data-habit="${h.id}">
        <div class="chk ${checked ? 'on' : ''}">${checked ? '✓' : ''}</div>
        <span class="h-ico">${h.icon}</span>
        <span class="h-lbl ${checked ? 'on' : ''}">${h.label}</span>
        ${streak}
        <button class="habit-del" data-habit-del="${h.id}">×</button>
      </div>${sep}`;
  }).join('');
  document.querySelectorAll('.habit-row[data-habit]').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.closest('[data-habit-del]')) return;
      toggleHabit(el.dataset.habit);
    });
  });
  document.querySelectorAll('[data-habit-del]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      deleteHabit(el.dataset.habitDel);
    });
  });
}

function toggleHabit(id) {
  getDay(currentDay).habits[id] = !getDay(currentDay).habits[id];
  touch(); renderHabits(); updateScoreStrip();
  if (activeView === 'week') renderWeek();
}

function deleteHabit(id) {
  if (habits.length <= 1) { alert('Keep at least one habit!'); return; }
  habits = habits.filter(h => h.id !== id);
  touch(); renderHabits(); updateScoreStrip();
}

function addHabit() {
  const inp = document.getElementById('add-habit-inp');
  const txt = inp.value.trim();
  if (!txt) return;
  habits.push({ id: 'h_' + (++nextId), icon: pickedEmoji, label: txt });
  inp.value = '';
  touch(); renderHabits(); updateScoreStrip();
}

function calcStreak(habitId) {
  let count = 0;
  const dt  = new Date(todayStr() + 'T12:00:00');
  while (true) {
    const key = dt.toISOString().slice(0, 10);
    if (db[key]?.habits?.[habitId]) { count++; dt.setDate(dt.getDate() - 1); }
    else break;
  }
  return count;
}


// ─── Emoji picker ──────────────────────────────────────────

function openEmojiPicker() {
  document.getElementById('emoji-box').innerHTML = EMOJI_OPTIONS
    .map(e => `<button class="emoji-opt" data-emoji="${e}">${e}</button>`).join('');
  document.getElementById('emoji-popup').classList.remove('hidden');
}

function closeEmojiPicker() {
  document.getElementById('emoji-popup').classList.add('hidden');
}


// ─── Sleep parsing ─────────────────────────────────────────

function parseFuzzyTime(raw) {
  if (!raw) return null;
  const s   = raw.trim().toLowerCase().replace(/\s/g, '');
  const pm  = s.includes('pm');
  const am  = s.includes('am');
  const clean = s.replace('am', '').replace('pm', '');
  const parts = clean.includes(':') ? clean.split(':') : [clean, '0'];
  let h = parseInt(parts[0]);
  let m = parseInt(parts[1]) || 0;
  if (isNaN(h)) return null;
  if (h > 23 || m > 59) return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return h * 60 + m;
}

function renderSleepDuration() {
  const s  = parseFuzzyTime(document.getElementById('slept').value);
  const w  = parseFuzzyTime(document.getElementById('woke').value);
  const el = document.getElementById('sleep-dur');
  if (s === null || w === null) { el.style.display = 'none'; return; }
  let mins = w - s; if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  const label = mins >= 420 ? '😴 Well rested' : mins >= 300 ? '🌙 Okay' : '😵 Short night';
  el.textContent = `${h}h${m ? ' ' + m + 'm' : ''} · ${label}`;
  el.style.display = 'block';
}


// ─── Score strip ───────────────────────────────────────────

function updateScoreStrip() {
  const d          = getDay(currentDay);
  const habitsDone = habits.filter(h => d.habits[h.id]).length;
  const tasks      = d.tasks ?? [];
  const filled     = tasks.filter(t => t.text?.trim()).length;
  const tasksDone  = tasks.filter(t => t.text?.trim() && t.done).length;
  const pinnedDone = pinnedTasks.filter(p => d.pinnedDone?.[p.id]).length;
  const denom      = habits.length + (filled || 0) + pinnedTasks.length;
  const pct        = denom > 0 ? Math.round((habitsDone + tasksDone + pinnedDone) / denom * 100) : 0;
  document.getElementById('sc-pct').textContent = hasData(currentDay) ? pct + '%' : '—';
  document.getElementById('sc-h').textContent   = habitsDone + '/' + habits.length;
  document.getElementById('sc-t').textContent   = (tasksDone + pinnedDone) + '/' + (filled + pinnedTasks.length || 0);
  const sv = parseFuzzyTime(d.slept), wv = parseFuzzyTime(d.woke);
  let sleep = '—';
  if (sv !== null && wv !== null) {
    let m = wv - sv; if (m < 0) m += 1440;
    sleep = m >= 420 ? '😴' : m >= 300 ? '🌙' : '😵';
  }
  document.getElementById('sc-s').textContent = sleep;
}


// ─── Week view ─────────────────────────────────────────────

function renderWeek() {
  const dates = getWeekDates(currentDay);
  const DOW   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  document.getElementById('week-grid').innerHTML = dates.map((d, i) => {
    const data = db[d], score = calcScore(d);
    const dots = habits.map(h =>
      `<div class="wdc-dot ${data?.habits?.[h.id] ? 'done' : ''}"></div>`).join('');
    return `
      <div class="week-day-card ${d === todayStr() ? 'today-card' : ''} ${d === currentDay ? 'selected-card' : ''}"
           data-jump="${d}" style="animation-delay:${i * 0.04}s">
        <div class="wdc-dow">${DOW[i]}</div>
        <div class="wdc-date">${new Date(d + 'T12:00:00').getDate()}</div>
        <div class="wdc-score">${hasData(d) ? score + '%' : '—'}</div>
        <div class="wdc-dots">${dots}</div>
      </div>`;
  }).join('');
  document.querySelectorAll('[data-jump]').forEach(el => {
    el.addEventListener('click', () => jumpToDay(el.dataset.jump));
  });
  const loggedDates = dates.filter(d => hasData(d));
  const avgScore    = loggedDates.length
    ? Math.round(loggedDates.reduce((a, d) => a + calcScore(d), 0) / loggedDates.length) : 0;
  const bestStreak  = habits.length ? Math.max(...habits.map(h => calcStreak(h.id))) : 0;
  document.getElementById('week-summary').innerHTML = `
    <div class="ws-stat"><div class="ws-val">${loggedDates.length ? avgScore + '%' : '—'}</div><div class="ws-key">avg score</div></div>
    <div class="ws-stat"><div class="ws-val">${loggedDates.length}/7</div><div class="ws-key">days logged</div></div>
    <div class="ws-stat"><div class="ws-val">${bestStreak > 0 ? '🔥 ' : ''}${bestStreak}d</div><div class="ws-key">best streak</div></div>
  `;
  const colTemplate = 'grid-template-columns: 1fr repeat(7, minmax(17px, 22px)) 40px';
  document.getElementById('habit-week-table').innerHTML = `
    <div class="hwt-head" style="${colTemplate}">
      <div>Habit</div>
      ${DOW.map(d => `<div style="text-align:center;font-size:9px">${d[0]}</div>`).join('')}
      <div style="text-align:right">Streak</div>
    </div>
    ${habits.map(h => {
      const dots = dates.map(d => `<div class="hwt-dot ${db[d]?.habits?.[h.id] ? 'done' : ''}"></div>`).join('');
      const s    = calcStreak(h.id);
      return `
        <div class="hwt-row" style="${colTemplate}">
          <div class="hwt-habit"><span>${h.icon}</span><span>${h.label}</span></div>
          <div style="display:contents">${dots}</div>
          <div class="hwt-streak">${s > 0 ? (s >= 3 ? '🔥 ' : '') + s + 'd' : '—'}</div>
        </div>`;
    }).join('')}
  `;
}

function jumpToDay(dateStr) {
  if (dateStr > todayStr()) return;
  currentDay = dateStr;
  if (activeView === 'week') renderWeek();
  render();
}


// ─── Trends view ───────────────────────────────────────────

function renderTrends() {
  const days       = getLast30();
  const scores     = days.map(d => hasData(d) ? calcScore(d) : null);
  const sleepHours = days.map(d => {
    if (!hasData(d)) return null;
    const data = db[d]; if (!data) return null;
    const s = parseFuzzyTime(data.slept), w = parseFuzzyTime(data.woke);
    if (s === null || w === null) return null;
    let m = w - s; if (m < 0) m += 1440;
    return +(m / 60).toFixed(1);
  });
  const habitCounts = days.map(d => {
    if (!hasData(d)) return null;
    const data = db[d]; if (!data) return null;
    return habits.filter(h => data.habits?.[h.id]).length;
  });
  const labels   = days.map(d =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
  const logged   = days.filter(d => hasData(d)).length;
  const avgScore = logged
    ? Math.round(scores.filter((_, i) => hasData(days[i])).reduce((a, b) => a + b, 0) / logged) : 0;
  const bestIdx  = days.reduce((bi, d, i) => {
    if (!hasData(d)) return bi;
    return (bi === -1 || scores[i] > scores[bi]) ? i : bi;
  }, -1);
  const totalH   = habitCounts.reduce((a, b) => (a ?? 0) + (b ?? 0), 0);

  document.getElementById('trend-stats').innerHTML = `
    <div class="trend-stat" style="animation-delay:.04s">
      <div class="ts-val">${logged ? avgScore + '%' : '—'}</div><div class="ts-key">avg score</div>
    </div>
    <div class="trend-stat" style="animation-delay:.08s">
      <div class="ts-val">${logged}/30</div><div class="ts-key">days logged</div>
    </div>
    <div class="trend-stat" style="animation-delay:.12s">
      <div class="ts-val">${logged ? totalH : '—'}</div><div class="ts-key">habits done</div>
    </div>
    <div class="trend-stat" style="animation-delay:.16s">
      <div class="ts-val">${bestIdx >= 0 ? labels[bestIdx] : '—'}</div><div class="ts-key">best day</div>
    </div>
  `;

  const isDark    = darkMode;
  const gridColor = isDark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)';
  const tickColor = isDark ? '#9a9180' : '#7a7165';
  Chart.defaults.color = tickColor;
  Chart.defaults.font.family = 'DM Mono, monospace';
  Chart.defaults.font.size   = 10;

  const scoreColor = isDark ? '#f0ead8' : '#18160f';
  const scoreAlpha = isDark ? 'rgba(240,234,216,.07)' : 'rgba(24,22,15,.05)';
  if (scoreChart) { scoreChart.destroy(); scoreChart = null; }
  scoreChart = new Chart(document.getElementById('score-chart'), {
    type: 'line',
    data: { labels, datasets: [{ data: scores, borderColor: scoreColor, backgroundColor: scoreAlpha,
      borderWidth: 2, pointRadius: 2.5, tension: 0.35, fill: true, spanGaps: true }] },
    options: { responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + '%' } } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 7 } },
        y: { min: 0, max: 100, grid: { color: gridColor }, ticks: { callback: v => v + '%' } },
      }
    },
  });

  const sleepColors = days.map((_, i) => {
    const h = sleepHours[i]; if (h === null) return 'rgba(0,0,0,0)';
    if (h >= 7) return isDark ? 'rgba(74,222,128,.5)'  : 'rgba(22,101,52,.4)';
    if (h >= 5) return isDark ? 'rgba(251,191,36,.5)'  : 'rgba(217,119,6,.4)';
    return isDark ? 'rgba(255,107,107,.5)' : 'rgba(192,57,43,.4)';
  });
  if (sleepChart) { sleepChart.destroy(); sleepChart = null; }
  sleepChart = new Chart(document.getElementById('sleep-chart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: sleepHours, backgroundColor: sleepColors, borderRadius: 3, borderSkipped: false }] },
    options: { responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 6 } },
        y: { min: 0, max: 12, grid: { color: gridColor }, ticks: { callback: v => v + 'h' } },
      }
    },
  });

  const barColor = isDark ? 'rgba(240,234,216,.2)' : 'rgba(24,22,15,.12)';
  if (habitChart) { habitChart.destroy(); habitChart = null; }
  habitChart = new Chart(document.getElementById('habit-chart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: habitCounts, backgroundColor: barColor,
      borderRadius: 3, borderSkipped: false, spanGaps: true }] },
    options: { responsive: true, plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: gridColor }, ticks: { maxTicksLimit: 6 } },
        y: { min: 0, max: habits.length, grid: { color: gridColor }, ticks: { stepSize: 1 } },
      }
    },
  });
}


// ─── Reminders ─────────────────────────────────────────────

function applyReminderUI() {
  document.getElementById('rem-morning-on').checked  = reminders.morningOn;
  document.getElementById('rem-evening-on').checked  = reminders.eveningOn;
  document.getElementById('rem-morning-time').value  = reminders.morningTime;
  document.getElementById('rem-evening-time').value  = reminders.eveningTime;
  updateNotifStatus();
}

function updateNotifStatus() {
  const el = document.getElementById('notif-status');
  if (!('Notification' in window)) {
    el.textContent = 'Notifications not supported.'; el.className = 'notif-status warn'; return;
  }
  if (Notification.permission === 'granted') {
    el.textContent = '✓ Notifications enabled'; el.className = 'notif-status ok';
  } else if (Notification.permission === 'denied') {
    el.textContent = '⚠ Blocked — allow in browser settings'; el.className = 'notif-status warn';
  } else {
    el.textContent = 'Toggle on to enable notifications'; el.className = 'notif-status';
  }
}

function saveReminders() {
  reminders.morningOn   = document.getElementById('rem-morning-on').checked;
  reminders.eveningOn   = document.getElementById('rem-evening-on').checked;
  reminders.morningTime = document.getElementById('rem-morning-time').value;
  reminders.eveningTime = document.getElementById('rem-evening-time').value;
  if ((reminders.morningOn || reminders.eveningOn) && Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      updateNotifStatus();
      if (p === 'granted') scheduleReminders();
    });
  } else if (Notification.permission === 'granted') {
    scheduleReminders();
  }
  touch(); updateNotifStatus();
}

function scheduleReminders() {
  remTimers.forEach(clearTimeout); remTimers = [];
  if (Notification.permission !== 'granted') return;
  function msUntil(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    const target = new Date(); target.setHours(h, m, 0, 0);
    if (target <= new Date()) target.setDate(target.getDate() + 1);
    return target - new Date();
  }
  function schedule(title, body, timeStr, enabled) {
    if (!enabled) return;
    const t = setTimeout(() => { new Notification(title, { body }); schedule(title, body, timeStr, true); }, msUntil(timeStr));
    remTimers.push(t);
  }
  schedule('🌅 Morning check-in',   'Time to set your goals!',  reminders.morningTime, reminders.morningOn);
  schedule('🌙 Evening reflection', 'Fill in your end of day.', reminders.eveningTime, reminders.eveningOn);
}


// ─── Auth modal ────────────────────────────────────────────

function openSyncModal() {
  showAuthView(fbUser ? 'account' : 'signin');
  document.getElementById('sync-modal').classList.remove('hidden');
}

function closeSyncModal() {
  document.getElementById('sync-modal').classList.add('hidden');
}

function showAuthView(view) {
  const views = ['signin', 'register', 'forgot', 'change-pass', 'delete', 'account'];
  views.forEach(v => {
    document.getElementById('auth-view-' + v).classList.toggle('hidden', v !== view);
  });
  // Show back button on sub-views
  document.getElementById('auth-back-btn').classList.toggle('hidden',
    view === 'signin' || view === 'account');
  setAuthMsg('');
}

function updateSyncStatus() {
  const signedIn = !!fbUser;
  document.getElementById('sync-btn').className = 'btn btn-sq' + (signedIn ? ' btn-sync-on' : '');
  document.getElementById('sync-btn').title     = signedIn ? fbUser.email : 'Sign in to sync';
  document.getElementById('sync-status-display').innerHTML = signedIn
    ? `<div class="sync-status-badge connected"><div class="status-dot"></div>Signed in as ${esc(fbUser.email)}</div>`
    : `<div class="sync-status-badge disconnected"><div class="status-dot"></div>Not signed in — local only</div>`;
  if (signedIn) document.getElementById('account-email').textContent = fbUser.email;
}

function setAuthMsg(msg, type = '') {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className   = 'auth-msg' + (type ? ' ' + type : '');
}

// ── Sign In ──
async function signIn() {
  if (!fbAuth) { setAuthMsg('Sync not configured.', 'warn'); return; }
  const email = document.getElementById('si-email').value.trim();
  const pass  = document.getElementById('si-pass').value;
  if (!email || !pass) { setAuthMsg('Please fill in both fields.', 'warn'); return; }
  setAuthMsg('Signing in…');
  try {
    await fbAuth.signInWithEmailAndPassword(email, pass);
    closeSyncModal();
  } catch (e) {
    const msg = ['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(e.code)
      ? 'Wrong email or password.' : e.message;
    setAuthMsg(msg, 'warn');
  }
}

// ── Register ──
async function register() {
  if (!fbAuth) { setAuthMsg('Sync not configured.', 'warn'); return; }
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const conf  = document.getElementById('reg-pass-confirm').value;
  if (!email || !pass) { setAuthMsg('Please fill in all fields.', 'warn'); return; }
  if (pass.length < 6) { setAuthMsg('Password must be at least 6 characters.', 'warn'); return; }
  if (pass !== conf)   { setAuthMsg('Passwords do not match.', 'warn'); return; }
  setAuthMsg('Creating account…');
  try {
    await fbAuth.createUserWithEmailAndPassword(email, pass);
    closeSyncModal();
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use'
      ? 'Email already in use — try signing in.' : e.message;
    setAuthMsg(msg, 'warn');
  }
}

// ── Forgot password ──
async function sendPasswordReset() {
  if (!fbAuth) { setAuthMsg('Sync not configured.', 'warn'); return; }
  const email = document.getElementById('fp-email').value.trim();
  if (!email) { setAuthMsg('Please enter your email.', 'warn'); return; }
  setAuthMsg('Sending reset email…');
  try {
    await fbAuth.sendPasswordResetEmail(email);
    setAuthMsg('✓ Reset email sent — check your inbox.', 'ok');
  } catch (e) {
    const msg = e.code === 'auth/user-not-found' ? 'No account found with that email.' : e.message;
    setAuthMsg(msg, 'warn');
  }
}

// ── Change password ──
async function changePassword() {
  if (!fbAuth || !fbUser) return;
  const current = document.getElementById('cp-current').value;
  const newPass = document.getElementById('cp-new').value;
  const conf    = document.getElementById('cp-confirm').value;
  if (!current || !newPass) { setAuthMsg('Please fill in all fields.', 'warn'); return; }
  if (newPass.length < 6)   { setAuthMsg('New password must be at least 6 characters.', 'warn'); return; }
  if (newPass !== conf)      { setAuthMsg('New passwords do not match.', 'warn'); return; }
  setAuthMsg('Updating password…');
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(fbUser.email, current);
    await fbUser.reauthenticateWithCredential(credential);
    await fbUser.updatePassword(newPass);
    setAuthMsg('✓ Password updated successfully.', 'ok');
    ['cp-current', 'cp-new', 'cp-confirm'].forEach(id => { document.getElementById(id).value = ''; });
  } catch (e) {
    const msg = ['auth/wrong-password', 'auth/invalid-credential'].includes(e.code)
      ? 'Current password is incorrect.' : e.message;
    setAuthMsg(msg, 'warn');
  }
}

// ── Sign out ──
async function signOut() {
  if (!confirm('Sign out? Your local data stays intact.')) return;
  await fbAuth.signOut();
  closeSyncModal();
}

// ── Delete account ──
async function deleteAccount() {
  if (!fbAuth || !fbUser) return;
  const pass = document.getElementById('del-pass').value;
  if (!pass) { setAuthMsg('Please enter your password to confirm.', 'warn'); return; }
  setAuthMsg('Verifying…');
  try {
    const credential = firebase.auth.EmailAuthProvider.credential(fbUser.email, pass);
    await fbUser.reauthenticateWithCredential(credential);
    if (fbDb) await fbDb.ref('users/' + fbUser.uid).remove();
    await fbUser.delete();
    localStorage.removeItem(STORAGE_KEY);
    db = {}; habits = structuredClone(DEFAULT_HABITS); pinnedTasks = [];
    nextId = 100; reminders = { morningOn: false, morningTime: '08:00', eveningOn: false, eveningTime: '21:00' };
    render();
    closeSyncModal();
    alert('Account deleted. Your local data has also been cleared.');
  } catch (e) {
    const msg = ['auth/wrong-password', 'auth/invalid-credential'].includes(e.code)
      ? 'Wrong password — account not deleted.'
      : e.code === 'auth/requires-recent-login'
      ? 'Session expired — please sign out and sign in again, then retry.'
      : e.message;
    setAuthMsg(msg, 'warn');
  }
}


// ─── Navigation ────────────────────────────────────────────

function collectCurrentDay() {
  collectTaskText();
  const d = getDay(currentDay);
  d.slept = document.getElementById('slept').value;
  d.woke  = document.getElementById('woke').value;
  d.goal  = document.getElementById('main-goal').value;
  d.notes = document.getElementById('notes-ta').value;
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(m => {
    d.meals[m] = document.getElementById('m-' + m).value;
  });
  d.win = document.getElementById('eod-win').value;
  d.tmr = document.getElementById('eod-tmr').value;
}

function moveDay(n) {
  collectCurrentDay();
  const next = shiftDay(currentDay, n);
  if (next > todayStr()) return;
  currentDay = next;
  render();
  if (activeView === 'week') renderWeek();
}

function copyYesterday() {
  const src = db[shiftDay(todayStr(), -1)];
  if (!src) { alert('No data from yesterday.'); return; }
  const d      = getDay(currentDay);
  const copied = (src.tasks ?? []).filter(t => t.text?.trim()).map(t => ({ text: t.text, done: false }));
  d.tasks  = copied.length ? copied : [{ text: '', done: false }];
  d.meals  = { ...(src.meals ?? {}) };
  d.goal   = src.goal ?? '';
  touch(); render();
}


// ─── Input wiring ──────────────────────────────────────────

function wireInputs() {
  function on(id, fn) {
    const el = document.getElementById(id); if (!el) return;
    el.oninput = () => { fn(el.value); touch(); };
  }
  on('slept',     v => { getDay(currentDay).slept = v; renderSleepDuration(); updateScoreStrip(); });
  on('woke',      v => { getDay(currentDay).woke  = v; renderSleepDuration(); updateScoreStrip(); });
  on('main-goal', v => { getDay(currentDay).goal  = v; });
  on('notes-ta',  v => { getDay(currentDay).notes = v; });
  on('eod-win',   v => { getDay(currentDay).win   = v; });
  on('eod-tmr',   v => { getDay(currentDay).tmr   = v; });
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(m => {
    on('m-' + m, v => { getDay(currentDay).meals[m] = v; });
  });
}


// ─── Utility ───────────────────────────────────────────────

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


// ─── Event listeners ───────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Nav
  document.getElementById('prev-btn').addEventListener('click', () => moveDay(-1));
  document.getElementById('next-btn').addEventListener('click', () => moveDay(1));
  document.getElementById('copy-btn').addEventListener('click', copyYesterday);
  document.getElementById('dark-btn').addEventListener('click', toggleDark);
  document.getElementById('sync-btn').addEventListener('click', openSyncModal);

  // View toggle
  document.querySelectorAll('.vt-btn').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  // Tasks / habits / pinned
  document.getElementById('add-task-btn').addEventListener('click', addTask);
  document.getElementById('add-task-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });
  document.getElementById('add-habit-btn').addEventListener('click', addHabit);
  document.getElementById('add-habit-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addHabit(); });
  document.getElementById('add-pin-btn').addEventListener('click', addPinnedTask);
  document.getElementById('add-pin-inp').addEventListener('keydown', e => { if (e.key === 'Enter') addPinnedTask(); });

  // Emoji picker
  document.getElementById('emoji-pick-btn').addEventListener('click', openEmojiPicker);
  document.getElementById('emoji-popup').addEventListener('click', e => {
    const btn = e.target.closest('[data-emoji]');
    if (btn) {
      pickedEmoji = btn.dataset.emoji;
      document.getElementById('emoji-pick-btn').textContent = pickedEmoji;
      closeEmojiPicker();
    } else if (e.target === document.getElementById('emoji-popup')) closeEmojiPicker();
  });

  // Modal close
  document.getElementById('modal-close-btn').addEventListener('click', closeSyncModal);
  document.getElementById('sync-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('sync-modal')) closeSyncModal();
  });

  // Back button
  document.getElementById('auth-back-btn').addEventListener('click', () => {
    showAuthView(fbUser ? 'account' : 'signin');
  });

  // Sign in
  document.getElementById('si-submit').addEventListener('click', signIn);
  document.getElementById('si-email').addEventListener('keydown', e => { if (e.key === 'Enter') signIn(); });
  document.getElementById('si-pass').addEventListener('keydown',  e => { if (e.key === 'Enter') signIn(); });
  document.getElementById('si-to-register').addEventListener('click', () => showAuthView('register'));
  document.getElementById('si-to-forgot').addEventListener('click',   () => showAuthView('forgot'));

  // Register
  document.getElementById('reg-submit').addEventListener('click', register);
  document.getElementById('reg-pass-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') register(); });

  // Forgot password
  document.getElementById('fp-submit').addEventListener('click', sendPasswordReset);
  document.getElementById('fp-email').addEventListener('keydown', e => { if (e.key === 'Enter') sendPasswordReset(); });

  // Account
  document.getElementById('acc-change-pass').addEventListener('click', () => showAuthView('change-pass'));
  document.getElementById('acc-signout').addEventListener('click', signOut);
  document.getElementById('acc-delete').addEventListener('click', () => showAuthView('delete'));

  // Change password
  document.getElementById('cp-submit').addEventListener('click', changePassword);
  document.getElementById('cp-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') changePassword(); });

  // Delete account
  document.getElementById('del-submit').addEventListener('click', deleteAccount);
  document.getElementById('del-pass').addEventListener('keydown', e => { if (e.key === 'Enter') deleteAccount(); });

  // Reminders
  document.getElementById('rem-morning-on').addEventListener('change',   saveReminders);
  document.getElementById('rem-evening-on').addEventListener('change',   saveReminders);
  document.getElementById('rem-morning-time').addEventListener('change', saveReminders);
  document.getElementById('rem-evening-time').addEventListener('change', saveReminders);

});


// ─── Boot ──────────────────────────────────────────────────

loadFromStorage();
applyTheme();

if (!localStorage.getItem(STORAGE_KEY) && window.matchMedia('(prefers-color-scheme: dark)').matches) {
  darkMode = true;
  applyTheme();
}

if (initFirebase()) {
  fbAuth.onAuthStateChanged(async user => {
    fbUser = user;
    updateSyncStatus();
    if (user) {
      setSaveState('syncing', 'syncing…');
      const pulled = await pullFromCloud();
      saveToStorage();
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

if (Notification.permission === 'granted') scheduleReminders();