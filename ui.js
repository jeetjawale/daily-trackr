// ui.js - Minimal DOM UI boundary for app boot
import { state } from './state.js';
import { formatDay, todayStr, esc, getWeekDates, getLast30, shiftDay, parseFuzzyTime } from './utils.js';

let charts = {};

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
  
  const setVal = (id, val) => {
    const el = byId(id);
    if (el) el.value = val || '';
  };
  setVal('slept', day.slept);
  setVal('woke', day.woke);
  setVal('main-goal', day.goal);
  setVal('m-breakfast', day.meals?.breakfast);
  setVal('m-lunch', day.meals?.lunch);
  setVal('m-dinner', day.meals?.dinner);
  setVal('m-snacks', day.meals?.snacks);
  setVal('notes-ta', day.notes);
  setVal('eod-win', day.win);
  setVal('eod-tmr', day.tmr);

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

  // Render week and trends
  if (state.activeView === 'week') renderWeek();
  if (state.activeView === 'trends') renderTrends();
}

function getDayScore(dStr) {
  const day = state.db[dStr] || {};
  const tasks = day.tasks || [];
  const pinned = state.pinnedTasks || [];
  const habits = state.habits || [];

  const tDone = tasks.filter(t => t.done).length;
  const pDone = pinned.filter(t => day.pinnedDone?.[t.id]).length;
  const hDone = habits.filter(h => day.habits?.[h.id]).length;

  const total = tasks.length + pinned.length + habits.length;
  const done = tDone + pDone + hDone;
  return { pct: total === 0 ? 0 : Math.round((done / total) * 100), total, done };
}

function renderWeek() {
  const weekDates = getWeekDates(state.currentDay);
  
  // 1. Week Grid
  const weekGrid = byId('week-grid');
  if (weekGrid) {
    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    updateHTML(weekGrid, weekDates.map((d, i) => {
      const isToday = d === todayStr();
      const isSelected = d === state.currentDay;
      const score = getDayScore(d);
      const isFuture = d > todayStr();
      
      return `
        <div class="week-day-card ${isToday ? 'today-card' : ''} ${isSelected ? 'selected-card' : ''}" ${!isFuture ? `onclick="window.navToDay('${d}')"` : ''} style="${isFuture ? 'cursor:default;opacity:0.4;' : ''}">
          <div class="wdc-dow">${dows[i]}</div>
          <div class="wdc-date">${d.split('-')[2]}</div>
          <div class="wdc-score">${score.pct}%</div>
          <div class="wdc-dots">
            ${Array.from({length: Math.min(score.total, 8)}).map((_, j) => `
              <div class="wdc-dot ${j < score.done ? 'done' : ''}"></div>
            `).join('')}
          </div>
        </div>
      `;
    }).join(''));
  }

  const wddCard = byId('week-day-details-card');
  if (wddCard && state.currentDay <= todayStr()) {
    const selDay = state.db[state.currentDay] || { tasks: [], habits: {}, pinnedDone: {}, meals: {} };
    const pDone = state.pinnedTasks?.filter(p => selDay.pinnedDone?.[p.id]) || [];
    const pNot = state.pinnedTasks?.filter(p => !selDay.pinnedDone?.[p.id]) || [];
    const tDone = selDay.tasks?.filter(t => t.done) || [];
    const tNot = selDay.tasks?.filter(t => !t.done) || [];
    
    if (pDone.length > 0 || pNot.length > 0 || tDone.length > 0 || tNot.length > 0 || (selDay.meals && Object.values(selDay.meals).some(v=>v)) || selDay.win || selDay.notes) {
      let html = `<div class="card" style="margin-top: 9px; padding: 14px;">`;
      html += `<div style="font-weight: 600; font-size: 14px; margin-bottom: 10px; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px;">${formatDay(state.currentDay)}</div>`;
      
      const renderTasks = (list, isDone, isPinned) => list.map(t => `
        <div style="display:flex; align-items:center; gap: 8px; margin-bottom: 6px; font-size: 13px; color: ${isDone ? 'var(--text3)' : 'var(--text2)'}; ${isDone ? 'text-decoration: line-through;' : ''}">
          <div style="width: 14px; height: 14px; border-radius: 4px; border: 1.5px solid ${isDone ? 'var(--text3)' : 'var(--border)'}; display: flex; align-items: center; justify-content: center; font-size: 10px; ${isDone ? 'background: var(--text3); color: var(--bg);' : ''}">${isDone ? '✓' : ''}</div>
          <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${isPinned ? '📌 ' : ''}${esc(t.text)}</div>
        </div>
      `).join('');

      html += renderTasks(pNot, false, true);
      html += renderTasks(tNot, false, false);
      html += renderTasks(pDone, true, true);
      html += renderTasks(tDone, true, false);

      if (selDay.meals) {
        const meals = Object.entries(selDay.meals).filter(([k,v]) => v).map(([k,v]) => `<span style="color:var(--text3); text-transform:capitalize;">${k}:</span> ${esc(v)}`);
        if (meals.length > 0) {
          html += `<div style="margin-top: 10px; font-size: 13px; color: var(--text2);">🍽 ${meals.join(' • ')}</div>`;
        }
      }
      
      if (selDay.win || selDay.notes) {
         html += `<div style="margin-top: 10px; font-size: 13px; color: var(--text2); font-style: italic; border-left: 2px solid var(--border); padding-left: 8px;">📝 ${esc(selDay.win || selDay.notes)}</div>`;
      }

      html += `</div>`;
      updateHTML(wddCard, html);
    } else {
      updateHTML(wddCard, '');
    }
  } else if (wddCard) {
    updateHTML(wddCard, '');
  }

  // 2. Week Summary
  const weekSummary = byId('week-summary');
  if (weekSummary) {
    let sumPct = 0;
    let daysWithData = 0;
    let sleepTotal = 0;
    let sleepDays = 0;

    weekDates.forEach(d => {
      const score = getDayScore(d);
      if (score.total > 0) {
        sumPct += score.pct;
        daysWithData++;
      }
      
      const day = state.db[d] || {};
      if (day.slept && day.woke) {
        const s = parseFuzzyTime(day.slept);
        const w = parseFuzzyTime(day.woke);
        if (s !== null && w !== null) {
          let mins = w - s;
          if (mins < 0) mins += 1440;
          sleepTotal += mins;
          sleepDays++;
        }
      }
    });

    const avgScore = daysWithData === 0 ? 0 : Math.round(sumPct / daysWithData);
    const avgSleep = sleepDays === 0 ? '—' : `${Math.floor((sleepTotal / sleepDays) / 60)}h ${Math.round((sleepTotal / sleepDays) % 60)}m`;

    updateHTML(weekSummary, `
      <div>
        <div class="ws-val">${avgScore}%</div>
        <div class="ws-key">Avg Score</div>
      </div>
      <div>
        <div class="ws-val">${daysWithData}/7</div>
        <div class="ws-key">Tracked</div>
      </div>
      <div>
        <div class="ws-val">${avgSleep}</div>
        <div class="ws-key">Avg Sleep</div>
      </div>
    `);
  }

  // 3. Habit Week Table
  const habitTable = byId('habit-week-table');
  if (habitTable && state.habits?.length > 0) {
    const dows = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    
    let html = `
      <div class="hwt-head" style="grid-template-columns: 1fr ${'24px '.repeat(7)} 40px;">
        <div>Habit</div>
        ${weekDates.map((d, i) => {
          const isFuture = d > todayStr();
          return `<div style="text-align:center;${isFuture ? 'opacity:0.4;' : 'cursor:pointer;'}" ${!isFuture ? `onclick="window.navToDay('${d}')"` : ''} title="${isFuture ? '' : `Go to ${d}`}">${dows[i]}</div>`;
        }).join('')}
        <div style="text-align:right">Strk</div>
      </div>
    `;

    state.habits.forEach(h => {
      let streak = 0;
      let checkDate = todayStr();
      while (true) {
        if (state.db[checkDate]?.habits?.[h.id]) {
          streak++;
          checkDate = shiftDay(checkDate, -1);
        } else {
          break;
        }
      }

      html += `
        <div class="hwt-row" style="grid-template-columns: 1fr ${'24px '.repeat(7)} 40px;">
          <div class="hwt-habit"><span class="h-ico">${h.icon}</span> <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.label)}</span></div>
          ${weekDates.map(d => {
            const isFuture = d > todayStr();
            return `
            <div class="hwt-dots" style="${isFuture ? '' : 'cursor:pointer;'}" ${!isFuture ? `onclick="window.toggleHabit('${h.id}', '${d}')"` : ''}>
              <div class="hwt-dot ${state.db[d]?.habits?.[h.id] ? 'done' : ''}" style="${isFuture ? 'opacity: 0.2;' : ''}">${state.db[d]?.habits?.[h.id] ? '✓' : ''}</div>
            </div>
          `}).join('')}
          <div class="hwt-streak">${streak}</div>
        </div>
      `;
    });
    updateHTML(habitTable, html);
  } else if (habitTable) {
    updateHTML(habitTable, '<div style="padding: 20px; text-align: center; color: var(--text3); font-size: 14px;">No habits defined.</div>');
  }

  // 4. Weekly Review
  const wr = byId('weekly-review');
  if (wr) {
    const start = new Date(weekDates[0] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    const end = new Date(weekDates[6] + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    
    const weekKey = `wr_${weekDates[0]}`;
    if (!state.db[weekKey]) state.db[weekKey] = { highlights: '', lowlights: '' };
    
    updateHTML(wr, `
      <div class="wr-header"><div class="wr-range">${start} – ${end}</div></div>
      <div class="wr-fields">
        <div class="wr-field">
          <label class="wr-lbl">Highlights</label>
          <textarea class="wr-ta" id="wr-high" placeholder="What went well?">${esc(state.db[weekKey].highlights)}</textarea>
        </div>
        <div class="wr-field">
          <label class="wr-lbl">Lowlights / Learnings</label>
          <textarea class="wr-ta" id="wr-low" placeholder="What didn't go well?">${esc(state.db[weekKey].lowlights)}</textarea>
        </div>
      </div>
    `);

    ['wr-high', 'wr-low'].forEach(id => {
      const el = byId(id);
      if (el) {
        el.addEventListener('change', e => {
          const field = id === 'wr-high' ? 'highlights' : 'lowlights';
          state.db[weekKey][field] = e.target.value;
          if (window.triggerSave) window.triggerSave();
        });
      }
    });
  }
}

function renderTrends() {
  const last30 = getLast30();
  
  // 1. Trend stats
  let sumPct = 0;
  let tracked = 0;
  let habitTotal = 0;
  
  const scoreData = [];
  const sleepData = [];
  const habitData = [];
  
  last30.forEach(d => {
    const score = getDayScore(d);
    scoreData.push(score.pct);
    if (score.total > 0) {
      sumPct += score.pct;
      tracked++;
    }
    
    const day = state.db[d] || {};
    let sleepMins = 0;
    if (day.slept && day.woke) {
      const s = parseFuzzyTime(day.slept);
      const w = parseFuzzyTime(day.woke);
      if (s !== null && w !== null) {
        let mins = w - s;
        if (mins < 0) mins += 1440;
        sleepMins = mins;
      }
    }
    sleepData.push(sleepMins / 60);
    
    const habits = state.habits || [];
    const hDone = habits.filter(h => day.habits?.[h.id]).length;
    habitData.push(hDone);
    habitTotal += hDone;
  });

  const ts = byId('trend-stats');
  if (ts) {
    updateHTML(ts, `
      <div class="trend-stat">
        <div class="ts-val">${tracked === 0 ? 0 : Math.round(sumPct / tracked)}%</div>
        <div class="ts-key">30-Day Avg</div>
      </div>
      <div class="trend-stat">
        <div class="ts-val">${habitTotal}</div>
        <div class="ts-key">Habits done</div>
      </div>
    `);
  }
  
  // 2. Charts
  const isDark = state.darkMode;
  const gridColor = isDark ? '#3d3a2c' : '#e8e2d9';
  const textColor = isDark ? '#9a9180' : '#7a7165';

  const getChartOptions = (max = null, stepSize = null) => ({
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { bottom: 20 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { 
        border: { display: false },
        grid: { color: gridColor }, 
        ticks: { 
          color: textColor, 
          font: { family: "inherit", size: 10 },
          ...(stepSize ? { stepSize } : {})
        },
        beginAtZero: true,
        ...(max ? { suggestedMax: max, max: max } : {}) // Force max to ensure exact grid lines
      }
    }
  });

  const createChart = (id, type, data, color, max = null, stepSize = null) => {
    const ctx = byId(id);
    if (!ctx) return;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, {
      type,
      data: {
        labels: last30.map(d => d.split('-')[2]),
        datasets: [{
          data,
          backgroundColor: type === 'bar' ? color : color + '33',
          borderColor: color,
          borderWidth: 2,
          tension: 0.3,
          fill: type === 'line'
        }]
      },
      options: getChartOptions(max, stepSize)
    });
  };

  if (window.Chart) {
    createChart('score-chart', 'line', scoreData, isDark ? '#4ade80' : '#166534', 100, 20); // 0, 20, 40, 60, 80, 100
    createChart('sleep-chart', 'bar', sleepData, isDark ? '#60a5fa' : '#2563eb', 10, 2);    // 0, 2, 4, 6, 8, 10
    createChart('habit-chart', 'bar', habitData, isDark ? '#fbbf24' : '#d97706', 5, 1);     // 0, 1, 2, 3, 4, 5
  }

  // 3. Heatmap (Last 52 weeks = 364 days)
  const heatmap = byId('heatmap-container');
  if (heatmap) {
    const today = new Date(todayStr() + 'T12:00:00');
    const startDt = new Date(today);
    startDt.setDate(today.getDate() - (today.getDay()) - 364); // 52 weeks back from Sunday
    
    const days = [];
    let cur = new Date(startDt);
    while (cur <= today) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    
    const cols = [];
    for (let i = 0; i < days.length; i += 7) {
      cols.push(days.slice(i, i + 7));
    }
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let monthLabels = '';
    let lastMonth = -1;
    
    cols.forEach((col, idx) => {
      // Use the Thursday (index 4) to determine the month of the week
      const midWeekMonth = parseInt(col[4] ? col[4].split('-')[1] : col[0].split('-')[1]) - 1;
      
      if (midWeekMonth !== lastMonth) {
        monthLabels += `<div class="hm-month">${monthNames[midWeekMonth]}</div>`;
        lastMonth = midWeekMonth;
      } else {
        monthLabels += `<div class="hm-month"></div>`;
      }
    });

    let html = `
      <div class="hm-months">${monthLabels}</div>
      <div class="hm-body">
        <div class="hm-dow">
          <div class="hm-dow-lbl"></div>
          <div class="hm-dow-lbl">M</div>
          <div class="hm-dow-lbl"></div>
          <div class="hm-dow-lbl">W</div>
          <div class="hm-dow-lbl"></div>
          <div class="hm-dow-lbl">F</div>
          <div class="hm-dow-lbl"></div>
        </div>
        <div class="hm-grid">
    `;
    
    cols.forEach(col => {
      html += `<div class="hm-col">`;
      col.forEach(d => {
        if (d > todayStr()) {
          html += `<div class="hm-cell"></div>`;
          return;
        }
        const score = getDayScore(d).pct;
        let lv = 0;
        if (score > 0) lv = 1;
        if (score > 33) lv = 2;
        if (score > 66) lv = 3;
        if (score >= 100) lv = 4;
        html += `<div class="hm-cell lv${lv} ${d === todayStr() ? 'hm-today' : ''}" title="${d}: ${score}%"></div>`;
      });
      html += `</div>`;
    });
    
    html += `
        </div>
      </div>
      <div class="hm-legend">
        <span class="hm-leg-lbl">0%</span>
        <div class="hm-cell lv0"></div>
        <div class="hm-cell lv1"></div>
        <div class="hm-cell lv2"></div>
        <div class="hm-cell lv3"></div>
        <div class="hm-cell lv4"></div>
        <span class="hm-leg-lbl">100%</span>
      </div>
    `;
    
    updateHTML(heatmap, html);
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
